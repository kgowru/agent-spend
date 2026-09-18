import Foundation

/// Coordinates ingest → store → estimate, and holds the state the UI renders.
@MainActor
final class UsageEngine: ObservableObject {
    @Published private(set) var records: [UsageRecord] = []
    @Published private(set) var stats = JSONLIngestor.Stats()
    @Published private(set) var lastRefresh: Date?
    @Published private(set) var isRefreshing = false
    @Published private(set) var errorMessage: String?
    /// Models seen in the logs with no coefficient entry. Surfaced in the UI —
    /// counting them as zero would quietly understate everything.
    @Published private(set) var unrecognizedModels: Set<String> = []

    @Published var cacheReadFactor: Double {
        didSet { estimator.cacheReadFactorOverride = cacheReadFactor }
    }

    /// In-memory mirror of the store, keyed by `message.id`. Kept so a refresh
    /// can merge just the new rows instead of re-reading all ~22k records from
    /// SQLite — the watcher fires every couple of seconds during an active
    /// session, and a full reload each time is exactly the kind of waste this
    /// app exists to point at.
    private var byID: [String: UsageRecord] = [:]

    private(set) var estimator: Estimator
    private var index: FileIndex
    private let store: UsageStore
    /// One entry per agent CLI whose log directory exists. A tool the user has
    /// never run contributes no source, so it leaves no trace in the UI rather
    /// than showing an empty section.
    private let sources: [LogSource]
    private var watchers: [ProjectsWatcher] = []

    // Memoization. The derived analytics are pure functions of (records,
    // cacheReadFactor). Caching them against a data-version means an open pane
    // recomputes only when the data genuinely changes — not on every incidental
    // @Published tick (the refresh spinner toggling, the "updated" timestamp),
    // and not when the watcher fires for a change that added no usage rows.
    // Deliberately NOT @Published: it's a cache, not state, and publishing it
    // would defeat the point.
    private var dataVersion = 0
    private struct DerivedCache {
        var version = -1
        var factor = Double.nan
        var insights: InsightsResult?
        var liveRecs: [Recommendation]?
        var sessions400: [SessionSummary]?
        var dailyByDays: [Int: [DaySummary]] = [:]
    }
    private var derived = DerivedCache()

    private func freshCache() -> DerivedCache {
        if derived.version == dataVersion, derived.factor == cacheReadFactor {
            return derived
        }
        derived = DerivedCache(version: dataVersion, factor: cacheReadFactor)
        return derived
    }

    convenience init(root: URL = JSONLIngestor.defaultRoot()) throws {
        // The single-root form is what `--verify` and the tests use to point at
        // a frozen Claude corpus, so it stays exactly as specific as it was.
        try self.init(sources: [LogSource(provider: .claude, root: root)])
    }

    init(sources: [LogSource]) throws {
        let (energy, pricing) = try Coefficients.load()
        self.sources = sources
        self.estimator = Estimator(energy: energy, pricing: pricing)
        self.cacheReadFactor = energy.defaults.cacheReadFactor.v
        self.index = FileIndex.load()
        self.store = try UsageStore(path: try UsageStore.defaultLocation())
        self.byID = Dictionary(((try? store.allRecords()) ?? []).map { ($0.id, $0) }) { a, _ in a }
        self.records = Array(byID.values)
        self.externalDaily = (try? store.externalByDay()) ?? [:]
        self.dataVersion = 1
        recomputeUnrecognized()
    }

    /// Begin watching for new session activity. Separate from `init` so the
    /// headless `--verify` / `--render` / `--selftest` paths don't start one.
    func startWatching() {
        guard watchers.isEmpty else { return }
        // One watcher per source: FSEvents streams are rooted, and the two log
        // directories are nowhere near each other in the filesystem. A change
        // reports only the paths under its own root, so the refresh can still
        // re-parse just those files rather than rescanning everything.
        watchers = sources.map { source in
            ProjectsWatcher(root: source.root) { [weak self] changed in
                Task { @MainActor in await self?.refresh(files: changed) }
            }
        }
    }

    func stopWatching() {
        watchers.forEach { $0.stop() }
        watchers = []
    }

    var energyModel: EnergyModel { estimator.energy }

    /// Re-ingest. `files == nil` walks the whole tree (launch, manual refresh,
    /// periodic backstop); otherwise only the paths the watcher flagged.
    func refresh(files: [URL]? = nil) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        // Parsing runs off the main actor; everything it touches is a value
        // type, so the result crosses back cleanly.
        let result = await Self.parseOffMain(sources: sources, files: files, index: index)

        do {
            try store.upsert(result.records.values)
            try result.index.save()
            index = result.index

            // Merge with the same max-output rule the store uses: a streamed
            // message can arrive first as a partial and later as complete, and
            // a stale partial must never clobber the finished count.
            var changed = false
            for (id, r) in result.records {
                if let prior = byID[id], r.output <= prior.output { continue }
                byID[id] = r
                changed = true
            }
            if changed {
                records = Array(byID.values)
                dataVersion += 1   // invalidates the memoized analytics
            }
            stats = result.stats
            lastRefresh = Date()
            errorMessage = nil
            recomputeUnrecognized()
        } catch {
            errorMessage = String(describing: error)
        }
    }

    private struct ParseResult: Sendable {
        var records: [String: UsageRecord]
        var index: FileIndex
        var stats: JSONLIngestor.Stats
    }

    private nonisolated static func parseOffMain(sources: [LogSource], files: [URL]?,
                                                 index: FileIndex) async -> ParseResult {
        await Task.detached(priority: .utility) {
            var idx = index
            var stats = JSONLIngestor.Stats()
            var out: [String: UsageRecord] = [:]

            // Compare against the resolved root. FSEvents hands back
            // canonicalized paths, so a symlinked `~/.codex` or a home reached
            // through `/System/Volumes/Data` would fail a raw prefix test —
            // every source would scope to nothing and live refresh would become
            // a silent no-op that still stamped a fresh "updated" time.
            let roots = sources.map { ($0, $0.root.resolvingSymlinksInPath().path) }
            var matchedAny = false

            for (source, resolvedRoot) in roots {
                let scoped = files?.filter {
                    let p = $0.resolvingSymlinksInPath().path
                    return p.hasPrefix(resolvedRoot) || $0.path.hasPrefix(source.root.path)
                }
                if let scoped {
                    if scoped.isEmpty { continue }
                    matchedAny = true
                }
                out.merge(source.ingest(files: scoped, index: &idx, stats: &stats)) { a, b in
                    b.output > a.output ? b : a
                }
            }

            // Paths that matched no root at all: rather than drop them, let
            // every source try. A parser handed the other's format finds no
            // usage marker and contributes nothing, so this is safe — and it
            // degrades to the old unscoped behaviour instead of losing updates.
            if let files, !files.isEmpty, !matchedAny {
                for (source, _) in roots {
                    out.merge(source.ingest(files: files, index: &idx, stats: &stats)) { a, b in
                        b.output > a.output ? b : a
                    }
                }
            }
            return ParseResult(records: out, index: idx, stats: stats)
        }.value
    }

    private func recomputeUnrecognized() {
        unrecognizedModels = Set(records.map(\.model).filter { !estimator.hasCoefficients(for: $0) })
    }

    // MARK: - Derived views

    func records(since: Date) -> [UsageRecord] {
        records.filter { ($0.timestamp ?? .distantPast) >= since }
    }

    func totalWattHours(_ rs: [UsageRecord], at edge: Band.Edge = .v) -> Double {
        rs.reduce(0) { $0 + (estimator.wattHours($1, at: edge) ?? 0) }
    }

    func totalCost(_ rs: [UsageRecord]) -> Double {
        rs.reduce(0) { $0 + (estimator.cost($1) ?? 0) }
    }

    func tokenTotals(_ rs: [UsageRecord]) -> TokenTotals {
        rs.reduce(into: TokenTotals()) { acc, r in
            acc.requests += 1
            acc.input += r.input
            acc.cacheWrite += r.cacheWrite
            acc.cacheWrite5m += r.cacheWrite5m
            acc.cacheWrite1h += r.cacheWrite1h
            acc.cacheRead += r.cacheRead
            acc.output += r.output
        }
    }

    struct ModelRow: Identifiable, Sendable {
        var id: String { model }
        let model: String
        let totals: TokenTotals
        let wh: Double
        let usd: Double
        let confidence: String
    }

    func byModel(_ rs: [UsageRecord]) -> [ModelRow] {
        var grouped: [String: [UsageRecord]] = [:]
        for r in rs { grouped[r.model, default: []].append(r) }
        return grouped.map { model, rows in
            ModelRow(model: model,
                     totals: tokenTotals(rows),
                     wh: totalWattHours(rows),
                     usd: totalCost(rows),
                     confidence: estimator.entry(for: model)?.confidence ?? "none")
        }
        .sorted { $0.wh > $1.wh }
    }

    func byProject(_ rs: [UsageRecord]) -> [(project: String, wh: Double, usd: Double)] {
        var grouped: [String: [UsageRecord]] = [:]
        for r in rs { grouped[r.project, default: []].append(r) }
        return grouped.map { (project: $0.key,
                              wh: totalWattHours($0.value),
                              usd: totalCost($0.value)) }
            .sorted { $0.wh > $1.wh }
    }

    /// Daily energy for the trailing `days`, oldest first — the sparkline.
    func dailyWattHours(days: Int = 14) -> [(day: Date, wh: Double)] {
        dailySummaries(days: days).map { (day: $0.day, wh: $0.wh) }
    }

    struct DaySummary: Identifiable, Sendable {
        var id: Date { day }
        let day: Date
        let wh: Double
        let usd: Double
        let requests: Int
        let totals: TokenTotals
        /// Model that accounted for the most spend that day.
        let topModel: String?
        let topProject: String?
        /// That day's spend split by agent, in palette order so the stack is in
        /// the same order on every bar. A stack whose segment order changed with
        /// the day's ranking would make a reader compare different things at the
        /// same height from one bar to the next.
        var slices: [AgentSlice] = []
    }

    /// Sidecar spend by day, refreshed alongside the records. Kept separate from
    /// `records` because these are day-level aggregates, not requests: letting
    /// them into the record list would corrupt every per-request average.
    @Published private(set) var externalDaily: [String: [String: Double]] = [:]

    private static let dayKey: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f
    }()

    /// Day-by-day spend, oldest first. Days with no activity are included as
    /// zeroes so gaps in the history are visible rather than silently skipped.
    func dailySummaries(days: Int = 14) -> [DaySummary] {
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date()).addingTimeInterval(-Double(days - 1) * 86_400)

        var byDay: [Date: [UsageRecord]] = [:]
        for r in records {
            guard let ts = r.timestamp, ts >= start else { continue }
            byDay[cal.startOfDay(for: ts), default: []].append(r)
        }

        return (0..<days).map { i in
            let day = cal.startOfDay(for: start.addingTimeInterval(Double(i) * 86_400))
            let rows = byDay[day] ?? []
            // Native providers, then whatever the sidecar reported for that day.
            var byAgent: [String: Double] = [:]
            for r in rows {
                let key = r.provider == .claude ? "claude-code" : r.provider.rawValue
                byAgent[key, default: 0] += estimator.cost(r) ?? 0
            }
            for (agent, usd) in externalDaily[Self.dayKey.string(from: day)] ?? [:] {
                byAgent[agent, default: 0] += usd
            }

            // Fold anything past the eight named slots into one grey bucket
            // rather than minting a ninth hue nobody can name.
            var named: [AgentSlice] = []
            var other = 0.0
            for (agent, usd) in byAgent where usd > 0 {
                if AgentPalette.rank(agent) < AgentPalette.order.count {
                    named.append(AgentSlice(agent: agent, usd: usd))
                } else {
                    other += usd
                }
            }
            named.sort { AgentPalette.rank($0.agent) < AgentPalette.rank($1.agent) }
            if other > 0 { named.append(AgentSlice(agent: "other", usd: other)) }

            return DaySummary(
                day: day,
                wh: totalWattHours(rows),
                // The headline must equal the stack, so it is the sum of the
                // slices rather than a separately-derived figure. A chart whose
                // bar disagrees with the number above it is worse than no chart.
                usd: totalCost(rows) + (externalDaily[Self.dayKey.string(from: day)]?
                    .values.reduce(0, +) ?? 0),
                requests: rows.count,
                totals: tokenTotals(rows),
                topModel: byModel(rows).first?.model,
                topProject: byProject(rows).first?.project,
                slices: named
            )
        }
    }

    struct SessionSummary: Identifiable, Sendable {
        let id: String
        /// Which CLI ran this session. Carried so advice about it can be priced
        /// under the right vendor's terms rather than a hardcoded one.
        let provider: Provider
        let project: String
        let branch: String?
        let started: Date
        let lastActivity: Date
        let models: [String]
        let requests: Int
        let wh: Double
        let usd: Double
        let totals: TokenTotals
        let subagentRequests: Int

        /// Average prompt size per request. A high value means long context,
        /// which is where energy and cost actually run away — prefill attention
        /// is O(n^2) and each decode step re-reads a growing KV cache.
        var avgContextTokens: Int {
            requests == 0 ? 0 : (totals.cacheRead + totals.cacheWrite + totals.input) / requests
        }
    }

    /// Sessions ordered by most recent activity.
    func recentSessions(limit: Int = 12, since: Date? = nil) -> [SessionSummary] {
        var grouped: [String: [UsageRecord]] = [:]
        for r in records {
            guard let sid = r.sessionId else { continue }
            if let since, (r.timestamp ?? .distantPast) < since { continue }
            grouped[sid, default: []].append(r)
        }

        return grouped.compactMap { sid, rows -> SessionSummary? in
            let stamps = rows.compactMap(\.timestamp)
            guard let last = stamps.max(), let first = stamps.min() else { return nil }
            var models: [String: Double] = [:]
            for r in rows { models[r.model, default: 0] += estimator.cost(r) ?? 0 }
            return SessionSummary(
                id: sid,
                provider: rows.first?.provider ?? .claude,
                project: rows.first?.project ?? "unknown",
                branch: rows.first(where: { $0.gitBranch != nil })?.gitBranch,
                started: first,
                lastActivity: last,
                models: models.sorted { $0.value > $1.value }.map(\.key),
                requests: rows.count,
                wh: totalWattHours(rows),
                usd: totalCost(rows),
                totals: tokenTotals(rows),
                subagentRequests: rows.filter(\.isSubagent).count
            )
        }
        .sorted { $0.lastActivity > $1.lastActivity }
        .prefix(limit)
        .map { $0 }
    }

    /// Requests bucketed by hour of the day, for the activity histogram.
    /// Requests bucketed by hour, split by agent.
    ///
    /// Native providers only. The sidecar agents report a day at a time and
    /// carry no timestamps, so there is no honest hour to put them in;
    /// `sidecarToday` surfaces them separately rather than smearing a daily
    /// total across 24 bars it was never measured against.
    func hourlyActivity(since: Date)
        -> [(hour: Int, requests: Int, usd: Double, slices: [AgentSlice])] {
        let cal = Calendar.current
        var buckets: [Int: (Int, Double, [String: Double])] = [:]
        for r in records {
            guard let ts = r.timestamp, ts >= since else { continue }
            let h = cal.component(.hour, from: ts)
            var e = buckets[h] ?? (0, 0, [:])
            let usd = estimator.cost(r) ?? 0
            e.0 += 1
            e.1 += usd
            e.2[r.provider == .claude ? "claude-code" : r.provider.rawValue, default: 0] += usd
            buckets[h] = e
        }
        return (0..<24).map { hour in
            let b = buckets[hour]
            let slices = (b?.2 ?? [:])
                .filter { $0.value > 0 }
                .map { AgentSlice(agent: $0.key, usd: $0.value) }
                .sorted { AgentPalette.rank($0.agent) < AgentPalette.rank($1.agent) }
            return (hour: hour, requests: b?.0 ?? 0, usd: b?.1 ?? 0, slices: slices)
        }
    }

    /// Today's sidecar spend per agent, which has no hourly detail to show.
    func sidecarToday() -> [AgentSlice] {
        let key = Self.dayKey.string(from: Date())
        return (externalDaily[key] ?? [:])
            .filter { $0.value > 0 }
            .map { AgentSlice(agent: $0.key, usd: $0.value) }
            .sorted { AgentPalette.rank($0.agent) < AgentPalette.rank($1.agent) }
    }

    /// Candidate substitutes, per provider.
    ///
    /// Scoped to one vendor for the same reason the tier-downshift
    /// recommendation is: replaying Codex tokens under Anthropic rates answers
    /// "what if I used a different tool", which these logs cannot support, and
    /// the UI strips the `claude-` prefix so the row would not even reveal that
    /// a different vendor was being quoted.
    nonisolated static let counterfactualCandidates: [Provider: [String]] = [
        .claude: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
        .codex: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
    ]

    /// Savings if the same tokens had run on `model`. Upper bound — holds turn
    /// count fixed, and a cheaper model may need more turns.
    ///
    /// Records are bucketed by provider and each bucket replayed only against
    /// its own vendor's models, so a mixed corpus produces one row per
    /// candidate per vendor rather than one meaningless cross-vendor total.
    func counterfactuals(_ rs: [UsageRecord], candidates: [String]? = nil)
        -> [(model: String, wh: Double, usd: Double, whRatio: Double, usdSaved: Double)] {
        var byProvider: [Provider: [UsageRecord]] = [:]
        for r in rs { byProvider[r.provider, default: []].append(r) }

        var out: [Counterfactual] = []
        for (provider, recs) in byProvider.sorted(by: { $0.key.rawValue < $1.key.rawValue }) {
            let models = candidates ?? Self.counterfactualCandidates[provider] ?? []
            let baseWh = totalWattHours(recs)
            let baseUsd = totalCost(recs)
            for m in models where estimator.hasCoefficients(for: m) {
                let (wh, usd) = estimator.counterfactual(recs, as: m)
                out.append((model: m, wh: wh, usd: usd,
                            whRatio: baseWh == 0 ? 0 : wh / baseWh,
                            usdSaved: baseUsd - usd))
            }
        }
        return out
    }

    // MARK: - Memoized products for the panes

    typealias Counterfactual = (model: String, wh: Double, usd: Double,
                                whRatio: Double, usdSaved: Double)

    struct InsightsResult: Sendable {
        let recommendations: [Recommendation]
        let counterfactuals: [Counterfactual]
        let totalUsd: Double
        let totalWh: Double
        let headlineSavings: Double
    }

    /// Everything the Insights pane needs, computed once per data change. This
    /// is the expensive one (grouping, per-session summaries, ranked
    /// recommendations); memoizing it is what makes the tab open instantly on an
    /// unchanged corpus instead of recomputing every time the view redraws.
    func insightsResult() -> InsightsResult {
        var cache = freshCache()
        if let cached = cache.insights { return cached }

        let sessions = cachedSessions400()
        let projects = byProject(records)
        let recs = Recommender.build(records: records, estimator: estimator,
                                     sessions: sessions, projects: projects)
        let result = InsightsResult(
            recommendations: recs,
            counterfactuals: counterfactuals(records),
            totalUsd: totalCost(records),
            totalWh: totalWattHours(records),
            headlineSavings: recs.compactMap(\.savingUsd).reduce(0, +))

        cache.insights = result
        derived = cache
        return result
    }

    /// The same analysis run over today alone.
    ///
    /// The Savings pane answers "what should I change about how I work", from
    /// the whole corpus. This answers a different question — "is what I'm doing
    /// right now costing me" — and the whole-corpus recommendations can't: a
    /// habit you fixed last week still dominates a 90-day ranking, and the
    /// session burning money this afternoon is a rounding error against it.
    ///
    /// Thresholds inside the recommender are absolute dollars, so on a quiet
    /// day this correctly returns nothing rather than manufacturing advice.
    func liveRecommendations() -> [Recommendation] {
        var cache = freshCache()
        if let r = cache.liveRecs { return r }

        let start = Calendar.current.startOfDay(for: Date())
        let today = records(since: start)
        let recs = today.isEmpty ? [] : Recommender.build(
            records: today,
            estimator: estimator,
            sessions: recentSessions(limit: 100, since: start),
            projects: byProject(today))
            // Concentration and bare observations are orientation, not actions
            // — "most of your spend is one project" is worth knowing once, not
            // worth a slot in a two-item strip you glance at mid-task. The
            // Savings pane still ranks them.
            .filter { $0.kind != .concentration && $0.kind != .observation }

        cache.liveRecs = recs
        derived = cache
        return recs
    }

    /// A stable fingerprint of today's actionable recommendations. Built from
    /// their ids — which are identity-based (model / session / project), not the
    /// dollar figures that drift through the day — so it only changes when a
    /// genuinely different suggestion appears. The menu bar uses it to tell
    /// advice the user hasn't opened the popover to see yet ("!") from advice
    /// they already have.
    func liveRecsSignature() -> String {
        liveRecommendations().map(\.id).sorted().joined(separator: ",")
    }

    /// The full session list (used by Insights and, filtered, by Activity),
    /// memoized so both panes share one grouping pass.
    func cachedSessions400() -> [SessionSummary] {
        var cache = freshCache()
        if let s = cache.sessions400 { return s }
        let s = recentSessions(limit: 400)
        cache.sessions400 = s
        derived = cache
        return s
    }

    /// Memoized day-by-day history. History is the default pane, so this runs on
    /// every launch; caching it keeps window switches and incidental redraws off
    /// the hot path.
    func cachedDailySummaries(days: Int) -> [DaySummary] {
        var cache = freshCache()
        if let d = cache.dailyByDays[days] { return d }
        let d = dailySummaries(days: days)
        cache.dailyByDays[days] = d
        derived = cache
        return d
    }
}
