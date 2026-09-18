import Foundation
import SQLite3

/// Persistent store for deduplicated usage records.
///
/// `request_id` is the primary key, so re-ingesting the same data is a no-op —
/// which is what makes the incremental pass idempotent. The one exception is
/// `output_tokens`: a streamed message can be seen first as a partial and later
/// as complete, so the upsert keeps the larger value.
final class UsageStore {
    enum StoreError: Error, CustomStringConvertible {
        case sqlite(String)
        var description: String {
            switch self { case .sqlite(let m): return "sqlite: \(m)" }
        }
    }

    private var db: OpaquePointer?
    // SQLite needs to copy bound strings; the C macro isn't exposed to Swift.
    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    init(path: URL) throws {
        guard sqlite3_open(path.path, &db) == SQLITE_OK else {
            throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
        try exec("PRAGMA journal_mode=WAL;")
        try exec("PRAGMA synchronous=NORMAL;")
        try exec("""
            CREATE TABLE IF NOT EXISTS requests (
              request_id   TEXT PRIMARY KEY,
              session_id   TEXT,
              ts           INTEGER,
              model        TEXT NOT NULL,
              input        INTEGER NOT NULL,
              cache_write  INTEGER NOT NULL,
              cache_w5m    INTEGER NOT NULL,
              cache_w1h    INTEGER NOT NULL,
              cache_read   INTEGER NOT NULL,
              output       INTEGER NOT NULL,
              cwd          TEXT,
              git_branch   TEXT,
              is_sidechain INTEGER NOT NULL,
              is_subagent  INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_ts ON requests(ts);
            CREATE INDEX IF NOT EXISTS idx_model ON requests(model);
            CREATE INDEX IF NOT EXISTS idx_cwd ON requests(cwd);
            """)
        try migrate()
    }

    /// Bring an existing database up to the current schema.
    ///
    /// `CREATE TABLE IF NOT EXISTS` above is a no-op on a database that already
    /// exists, so a new column has to be added explicitly or every prior
    /// install would break on the next write. `user_version` is SQLite's
    /// built-in schema counter and costs nothing to read.
    private func migrate() throws {
        // Deliberately NOT gated on `user_version`, which is the usual way to
        // write this and is wrong for this app. The store lives at a fixed path
        // under Application Support and is shared by every checkout on the
        // machine. A build that predates the `provider` column keeps inserting
        // rows with it NULL *after* a newer build has already stamped the
        // version, so a `version < 1` guard leaves them orphaned forever.
        // Measured here: 4,230 NULL rows in an already-stamped v1 database, and
        // the count had grown to 4,319 an hour later. Introspect the column and
        // re-run the backfill every launch; it is an indexed UPDATE over a set
        // that shrinks to nothing once the older build stops running.
        if !(try hasColumn("provider")) {
            try exec("ALTER TABLE requests ADD COLUMN provider TEXT;")
        }
        // Every row predating the column came from Claude Code, which was the
        // only supported source, so backfilling it is exact rather than a guess.
        try exec("""
            UPDATE requests SET provider = 'claude' WHERE provider IS NULL;
            CREATE INDEX IF NOT EXISTS idx_provider ON requests(provider);
            """)

        // Day-level usage for the agents read through the bundled ccusage
        // sidecar. A separate table on purpose: these are daily aggregates, not
        // deduplicated requests, and letting a day total into `requests` would
        // corrupt every per-session, per-hour and per-request average that reads
        // from it. Nothing here can touch the Claude or Codex arithmetic.
        //
        // The primary key is what makes a rescan safe: ccusage always reports a
        // whole day, so re-reading one must replace it rather than add to it.
        try exec("""
            CREATE TABLE IF NOT EXISTS agent_daily (
              agent        TEXT NOT NULL,
              day          TEXT NOT NULL,
              model        TEXT NOT NULL,
              input        INTEGER NOT NULL,
              output       INTEGER NOT NULL,
              cache_write  INTEGER NOT NULL,
              cache_read   INTEGER NOT NULL,
              reasoning    INTEGER NOT NULL,
              day_cost_usd REAL NOT NULL,
              PRIMARY KEY (agent, day, model)
            );
            CREATE INDEX IF NOT EXISTS idx_agent_daily_day ON agent_daily(day);
            PRAGMA user_version = 2;
            """)
    }

    private func hasColumn(_ name: String) throws -> Bool {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, "PRAGMA table_info(requests);", -1, &stmt, nil) == SQLITE_OK
        else { throw StoreError.sqlite(String(cString: sqlite3_errmsg(db))) }
        defer { sqlite3_finalize(stmt) }
        while sqlite3_step(stmt) == SQLITE_ROW {
            if let c = sqlite3_column_text(stmt, 1), String(cString: c) == name { return true }
        }
        return false
    }

    deinit { sqlite3_close(db) }

    static func defaultLocation() throws -> URL {
        try FileIndex.supportDirectory().appending(path: "usage.sqlite")
    }

    private func exec(_ sql: String) throws {
        var err: UnsafeMutablePointer<CChar>?
        guard sqlite3_exec(db, sql, nil, nil, &err) == SQLITE_OK else {
            defer { sqlite3_free(err) }
            throw StoreError.sqlite(err.map { String(cString: $0) } ?? "unknown")
        }
    }

    /// Insert or update records. Returns the number of rows actually written.
    ///
    /// `excluded.output > requests.output` is the whole streaming fix: an
    /// upsert that unconditionally overwrote would be fine, but one that used
    /// `INSERT OR IGNORE` would keep the first partial and lose 12.6% of output
    /// tokens.
    @discardableResult
    func upsert(_ records: some Collection<UsageRecord>) throws -> Int {
        guard !records.isEmpty else { return 0 }
        try exec("BEGIN IMMEDIATE;")
        var stmt: OpaquePointer?
        let sql = """
            INSERT INTO requests
              (request_id, session_id, ts, model, input, cache_write, cache_w5m,
               cache_w1h, cache_read, output, cwd, git_branch, is_sidechain,
               is_subagent, provider)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(request_id) DO UPDATE SET
              output = MAX(requests.output, excluded.output);
            """
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            try? exec("ROLLBACK;")
            throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }

        var written = 0
        for r in records {
            sqlite3_reset(stmt)
            bindText(stmt, 1, r.id)
            bindText(stmt, 2, r.sessionId)
            if let ts = r.timestamp {
                sqlite3_bind_int64(stmt, 3, Int64(ts.timeIntervalSince1970))
            } else {
                sqlite3_bind_null(stmt, 3)
            }
            bindText(stmt, 4, r.model)
            sqlite3_bind_int64(stmt, 5, Int64(r.input))
            sqlite3_bind_int64(stmt, 6, Int64(r.cacheWrite))
            sqlite3_bind_int64(stmt, 7, Int64(r.cacheWrite5m))
            sqlite3_bind_int64(stmt, 8, Int64(r.cacheWrite1h))
            sqlite3_bind_int64(stmt, 9, Int64(r.cacheRead))
            sqlite3_bind_int64(stmt, 10, Int64(r.output))
            bindText(stmt, 11, r.cwd)
            bindText(stmt, 12, r.gitBranch)
            sqlite3_bind_int(stmt, 13, r.isSidechain ? 1 : 0)
            sqlite3_bind_int(stmt, 14, r.isSubagent ? 1 : 0)
            bindText(stmt, 15, r.provider.rawValue)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                try? exec("ROLLBACK;")
                throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
            }
            written += 1
        }
        try exec("COMMIT;")
        return written
    }

    private func bindText(_ stmt: OpaquePointer?, _ i: Int32, _ s: String?) {
        if let s { sqlite3_bind_text(stmt, i, s, -1, Self.transient) }
        else { sqlite3_bind_null(stmt, i) }
    }

    // MARK: - Queries

    func count() throws -> Int {
        try scalarInt("SELECT COUNT(*) FROM requests;")
    }

    func distinctIDCount() throws -> Int {
        try scalarInt("SELECT COUNT(DISTINCT request_id) FROM requests;")
    }

    private func scalarInt(_ sql: String) throws -> Int {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }
        return sqlite3_step(stmt) == SQLITE_ROW ? Int(sqlite3_column_int64(stmt, 0)) : 0
    }

    /// Aggregated token totals grouped by an arbitrary column.
    func totals(groupedBy column: String, since: Date? = nil) throws -> [String: TokenTotals] {
        precondition(["model", "cwd", "git_branch", "provider"].contains(column),
                     "column is interpolated into SQL — allowlist only")
        var sql = """
            SELECT COALESCE(\(column), 'unknown'), COUNT(*), SUM(input), SUM(cache_write),
                   SUM(cache_w5m), SUM(cache_w1h), SUM(cache_read), SUM(output)
            FROM requests
            """
        if since != nil { sql += " WHERE ts >= ?" }
        sql += " GROUP BY 1;"

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }
        if let since { sqlite3_bind_int64(stmt, 1, Int64(since.timeIntervalSince1970)) }

        var out: [String: TokenTotals] = [:]
        while sqlite3_step(stmt) == SQLITE_ROW {
            let key = String(cString: sqlite3_column_text(stmt, 0))
            out[key] = TokenTotals(
                requests: Int(sqlite3_column_int64(stmt, 1)),
                input: Int(sqlite3_column_int64(stmt, 2)),
                cacheWrite: Int(sqlite3_column_int64(stmt, 3)),
                cacheWrite5m: Int(sqlite3_column_int64(stmt, 4)),
                cacheWrite1h: Int(sqlite3_column_int64(stmt, 5)),
                cacheRead: Int(sqlite3_column_int64(stmt, 6)),
                output: Int(sqlite3_column_int64(stmt, 7))
            )
        }
        return out
    }

    func allRecords() throws -> [UsageRecord] {
        var stmt: OpaquePointer?
        let sql = """
            SELECT request_id, session_id, ts, model, input, cache_write, cache_w5m,
                   cache_w1h, cache_read, output, cwd, git_branch, is_sidechain,
                   is_subagent, provider
            FROM requests;
            """
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }

        var out: [UsageRecord] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            func text(_ i: Int32) -> String? {
                sqlite3_column_type(stmt, i) == SQLITE_NULL
                    ? nil : String(cString: sqlite3_column_text(stmt, i))
            }
            out.append(UsageRecord(
                id: text(0) ?? "",
                // A row written before the provider column existed is Claude
                // Code by construction — it was the only source at the time.
                provider: text(14).flatMap(Provider.init(rawValue:)) ?? .claude,
                timestamp: sqlite3_column_type(stmt, 2) == SQLITE_NULL
                    ? nil : Date(timeIntervalSince1970: Double(sqlite3_column_int64(stmt, 2))),
                model: text(3) ?? "",
                input: Int(sqlite3_column_int64(stmt, 4)),
                output: Int(sqlite3_column_int64(stmt, 9)),
                cacheWrite: Int(sqlite3_column_int64(stmt, 5)),
                cacheWrite5m: Int(sqlite3_column_int64(stmt, 6)),
                cacheWrite1h: Int(sqlite3_column_int64(stmt, 7)),
                cacheRead: Int(sqlite3_column_int64(stmt, 8)),
                cwd: text(10),
                gitBranch: text(11),
                sessionId: text(1),
                isSidechain: sqlite3_column_int(stmt, 12) == 1,
                isSubagent: sqlite3_column_int(stmt, 13) == 1
            ))
        }
        return out
    }
}

// MARK: - Sidecar agents

extension UsageStore {
    /// Per-agent rollup of everything the ccusage sidecar reported.
    struct ExternalSummary: Sendable, Equatable {
        var agent: String
        var totals: TokenTotals
        var usd: Double
        var days: Int
        var models: [String]
    }

    /// Replace the sidecar's rows.
    ///
    /// `INSERT OR REPLACE` against `(agent, day, model)`, because ccusage
    /// reports a whole day at a time: re-reading a day must overwrite it rather
    /// than accumulate, or every refresh would inflate today's figure.
    ///
    /// Days that vanish from a tool's own logs are left in place. Several of
    /// these CLIs prune their history, and the point of this app is to remember
    /// spend that already happened, not to forget it when the evidence rotates
    /// away. It is the same reason the Claude store holds 32 days that ccusage
    /// can no longer see.
    @discardableResult
    func replaceExternal(_ rows: some Collection<CCUsageBridge.DailyRow>) throws -> Int {
        guard !rows.isEmpty else { return 0 }
        try exec("BEGIN IMMEDIATE;")
        var stmt: OpaquePointer?
        let sql = """
            INSERT OR REPLACE INTO agent_daily
              (agent, day, model, input, output, cache_write, cache_read, reasoning, day_cost_usd)
            VALUES (?,?,?,?,?,?,?,?,?);
            """
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            try? exec("ROLLBACK;")
            throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }

        var written = 0
        for r in rows {
            sqlite3_reset(stmt)
            bindText(stmt, 1, r.agent)
            bindText(stmt, 2, r.day)
            bindText(stmt, 3, r.model)
            sqlite3_bind_int64(stmt, 4, Int64(r.input))
            sqlite3_bind_int64(stmt, 5, Int64(r.output))
            sqlite3_bind_int64(stmt, 6, Int64(r.cacheWrite))
            sqlite3_bind_int64(stmt, 7, Int64(r.cacheRead))
            sqlite3_bind_int64(stmt, 8, Int64(r.reasoning))
            sqlite3_bind_double(stmt, 9, r.dayCostUSD)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                try? exec("ROLLBACK;")
                throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
            }
            written += 1
        }
        try exec("COMMIT;")
        return written
    }

    /// Rollup per agent, most expensive first.
    ///
    /// Cost needs the inner `MAX(day_cost_usd) GROUP BY agent, day`. ccusage
    /// reports cost per date, not per model, so the day's figure rides on every
    /// model row of that day (see `CCUsageBridge.DailyRow.dayCostUSD`). A plain
    /// `SUM(day_cost_usd)` would multiply each day by the number of models used
    /// that day, silently doubling a two-model day.
    func externalSummaries(since: Date? = nil) throws -> [ExternalSummary] {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        let cutoff = since.map { f.string(from: $0) }
        let filter = cutoff != nil ? "WHERE day >= ?" : ""

        var out: [String: ExternalSummary] = [:]

        try query("""
            SELECT agent, SUM(input), SUM(output), SUM(cache_write), SUM(cache_read),
                   COUNT(DISTINCT day), COUNT(*)
            FROM agent_daily \(filter) GROUP BY agent;
            """, cutoff) { stmt in
            let agent = String(cString: sqlite3_column_text(stmt, 0))
            out[agent] = ExternalSummary(
                agent: agent,
                totals: TokenTotals(
                    requests: Int(sqlite3_column_int64(stmt, 6)),
                    input: Int(sqlite3_column_int64(stmt, 1)),
                    cacheWrite: Int(sqlite3_column_int64(stmt, 3)),
                    cacheRead: Int(sqlite3_column_int64(stmt, 4)),
                    output: Int(sqlite3_column_int64(stmt, 2))),
                usd: 0,
                days: Int(sqlite3_column_int64(stmt, 5)),
                models: [])
        }

        try query("""
            SELECT agent, SUM(cost) FROM (
              SELECT agent, day, MAX(day_cost_usd) AS cost
              FROM agent_daily \(filter) GROUP BY agent, day
            ) GROUP BY agent;
            """, cutoff) { stmt in
            let agent = String(cString: sqlite3_column_text(stmt, 0))
            out[agent]?.usd = sqlite3_column_double(stmt, 1)
        }

        try query("""
            SELECT agent, model FROM agent_daily \(filter)
            GROUP BY agent, model ORDER BY SUM(input + output) DESC;
            """, cutoff) { stmt in
            let agent = String(cString: sqlite3_column_text(stmt, 0))
            out[agent]?.models.append(String(cString: sqlite3_column_text(stmt, 1)))
        }

        return out.values.sorted { $0.usd > $1.usd }
    }

    /// Sidecar spend keyed by day string (`yyyy-MM-dd`) then agent.
    ///
    /// `MAX(day_cost_usd)` rather than `SUM`, for the same reason as
    /// `externalSummaries`: ccusage reports cost per date, so the figure rides
    /// on every model row of that day and summing it multiplies by the model
    /// count. This is the shape the daily chart stacks.
    func externalByDay(since: Date? = nil) throws -> [String: [String: Double]] {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        let cutoff = since.map { f.string(from: $0) }

        var out: [String: [String: Double]] = [:]
        try query("""
            SELECT day, agent, MAX(day_cost_usd) FROM agent_daily
            \(cutoff != nil ? "WHERE day >= ?" : "") GROUP BY day, agent;
            """, cutoff) { stmt in
            let day = String(cString: sqlite3_column_text(stmt, 0))
            let agent = String(cString: sqlite3_column_text(stmt, 1))
            out[day, default: [:]][agent] = sqlite3_column_double(stmt, 2)
        }
        return out
    }

    /// Prepare, optionally bind one text parameter, and walk the rows.
    private func query(_ sql: String, _ bind: String?,
                       _ each: (OpaquePointer?) -> Void) throws {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }
        if let bind { sqlite3_bind_text(stmt, 1, bind, -1, Self.transient) }
        while sqlite3_step(stmt) == SQLITE_ROW { each(stmt) }
    }
}

struct TokenTotals: Sendable, Equatable {
    var requests = 0
    var input = 0
    var cacheWrite = 0
    var cacheWrite5m = 0
    var cacheWrite1h = 0
    var cacheRead = 0
    var output = 0

    var total: Int { input + cacheWrite + cacheRead + output }

    /// Share of prompt tokens served from cache. High is good: reads bill at
    /// 0.1x and skip prefill, while writes re-pay full prefill at a 1.25-2x
    /// premium. A low ratio means cache churn.
    var cacheEfficiency: Double {
        let denom = cacheRead + cacheWrite + input
        return denom == 0 ? 0 : Double(cacheRead) / Double(denom)
    }

    static func + (a: TokenTotals, b: TokenTotals) -> TokenTotals {
        TokenTotals(requests: a.requests + b.requests,
                    input: a.input + b.input,
                    cacheWrite: a.cacheWrite + b.cacheWrite,
                    cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
                    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
                    cacheRead: a.cacheRead + b.cacheRead,
                    output: a.output + b.output)
    }
}
