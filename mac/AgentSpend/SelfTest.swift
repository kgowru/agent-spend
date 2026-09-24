import Foundation

/// `AgentSpend --selftest`
///
/// Covers the behaviours the `--verify` diff against `tools/prototype.py` can't
/// reach: incremental reads, file rotation, partial trailing lines, and the
/// store's upsert rules.
///
/// These are plain assertions rather than XCTest because the installed Xcode
/// predates this macOS and its XCTest can't load — and requiring an Xcode
/// reinstall to run the tests would be a poor trade. No dependencies, runs
/// anywhere the app runs.
struct SelfTest {
    private var failures: [String] = []
    private var passed = 0
    private var tmp: URL!

    static func run() -> Int32 {
        var t = SelfTest()
        return t.execute()
    }

    // MARK: - Assertions

    private mutating func ok(_ cond: Bool, _ what: String, _ line: Int = #line) {
        if cond { passed += 1 } else { failures.append("L\(line): \(what)") }
    }

    private mutating func eq<T: Equatable>(_ a: T, _ b: T, _ what: String, _ line: Int = #line) {
        if a == b { passed += 1 } else { failures.append("L\(line): \(what) — got \(a), want \(b)") }
    }

    private mutating func close(_ a: Double, _ b: Double, _ tol: Double,
                                _ what: String, _ line: Int = #line) {
        if abs(a - b) <= tol { passed += 1 }
        else { failures.append("L\(line): \(what) — got \(a), want \(b)") }
    }

    // MARK: - Fixtures

    private func row(id: String, model: String = "claude-opus-4-8", output: Int = 100,
                     input: Int = 10, cacheRead: Int = 1000, cacheWrite: Int = 50) -> String {
        """
        {"type":"assistant","timestamp":"2026-07-28T03:29:56.267Z","cwd":"/w/proj",\
        "gitBranch":"main","sessionId":"s1","isSidechain":false,"requestId":"req_\(id)",\
        "message":{"id":"\(id)","model":"\(model)","usage":{"input_tokens":\(input),\
        "output_tokens":\(output),"cache_creation_input_tokens":\(cacheWrite),\
        "cache_read_input_tokens":\(cacheRead),\
        "cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":\(cacheWrite)}}}}
        """
    }

    private func project(_ name: String) throws -> URL {
        let d = tmp.appending(path: name)
        try FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    private func ingestAll(_ index: inout FileIndex) -> ([String: UsageRecord], JSONLIngestor.Stats) {
        var stats = JSONLIngestor.Stats()
        let out = JSONLIngestor.ingest(root: tmp, index: &index, stats: &stats)
        return (out, stats)
    }

    private mutating func freshTmp() throws {
        if let tmp { try? FileManager.default.removeItem(at: tmp) }
        tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "te-selftest-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)
    }

    // MARK: - Driver


    // MARK: - ccusage sidecar

    /// The sidecar's failure modes are all silent: a cost that multiplies by the
    /// number of models, a spelling difference that decodes to zero, a rescan
    /// that accumulates instead of replacing. None of them throw, and all of
    /// them move the headline number. Each gets a test.
    private mutating func sidecar() throws {
        // Real shape, captured from `ccusage codex daily --json --offline`. A
        // per-agent report spells the cost `costUSD` and returns `models` as a
        // dict; the unified report uses `totalCost` and an array.
        let twoModelDay = Data("""
        {"daily":[{"date":"2026-05-20","costUSD":5.25,"inputTokens":430945,\
        "outputTokens":25558,"cacheCreationTokens":0,"cacheReadTokens":4713984,\
        "reasoningOutputTokens":15110,"models":{\
        "gpt-5.5":{"inputTokens":430945,"outputTokens":25558,"cacheCreationTokens":0,\
        "cacheReadTokens":4713984,"reasoningOutputTokens":15110,"isFallback":false},\
        "gpt-5.6-sol":{"inputTokens":100,"outputTokens":20,"cacheCreationTokens":5,\
        "cacheReadTokens":50,"reasoningOutputTokens":3,"isFallback":false}}}]}
        """.utf8)

        let rows = try CCUsageBridge.parse(agent: "codex", json: twoModelDay)
        eq(rows.count, 2, "sidecar: two models on a day yield two rows")
        eq(rows.allSatisfy { $0.dayCostUSD == 5.25 }, true,
           "sidecar: the day cost is carried on every model row")
        eq(rows.first(where: { $0.model == "gpt-5.5" })?.cacheRead, 4_713_984,
           "sidecar: per-model cache reads survive the parse")
        eq(rows.first(where: { $0.model == "gpt-5.6-sol" })?.reasoning, 3,
           "sidecar: reasoning tokens survive the parse")

        // An agent installed but never run. ccusage spells the cost `totalCost`
        // here and `costUSD` on a populated row; decoding only one would read
        // the other as zero and quietly under-report.
        let empty = Data("""
        {"daily":[],"totals":{"cacheCreationTokens":0,"cacheReadTokens":0,\
        "inputTokens":0,"outputTokens":0,"totalCost":-0.0,"totalTokens":0}}
        """.utf8)
        eq(try CCUsageBridge.parse(agent: "gemini", json: empty).count, 0,
           "sidecar: an agent with no usage yields no rows")
        eq(try CCUsageBridge.parse(agent: "amp", json: Data()).count, 0,
           "sidecar: empty output yields no rows rather than throwing")

        // A day with tokens but no per-model breakdown must still be counted,
        // against a visible sentinel, or the total silently shrinks.
        let noBreakdown = Data("""
        {"daily":[{"date":"2026-05-21","costUSD":0.5,"inputTokens":10,"outputTokens":5}]}
        """.utf8)
        let sentinel = try CCUsageBridge.parse(agent: "goose", json: noBreakdown)
        eq(sentinel.count, 1, "sidecar: a day with no model breakdown is still recorded")
        eq(sentinel.first?.model, "goose-unknown", "sidecar: attributed to a visible sentinel")

        // THE trap. The day's cost rides on every model row, so a naive
        // SUM(day_cost_usd) doubles a two-model day.
        try freshTmp()
        let store = try UsageStore(path: tmp.appending(path: "sidecar.sqlite"))
        try store.replaceExternal(rows)
        var summaries = try store.externalSummaries()
        eq(summaries.count, 1, "sidecar: one agent summarised")
        close(summaries.first?.usd ?? 0, 5.25, 0.001,
              "sidecar: a two-model day counts its cost once, not twice")
        eq(summaries.first?.totals.cacheRead, 4_714_034, "sidecar: token totals sum across models")
        eq(summaries.first?.days, 1, "sidecar: one distinct day")

        // Rescanning the same day must replace it, not accumulate: ccusage
        // always reports whole days, so an append would inflate on every refresh.
        try store.replaceExternal(rows)
        summaries = try store.externalSummaries()
        close(summaries.first?.usd ?? 0, 5.25, 0.001, "sidecar: a rescan replaces rather than accumulates")
        eq(summaries.first?.totals.cacheRead, 4_714_034, "sidecar: and does not double the tokens")

        // Never ask the sidecar for the two agents parsed natively: ccusage
        // peaks at 1.2 GB on Claude and undercounts Codex by 3.6%.
        eq(CCUsageBridge.agents.contains("claude"), false, "sidecar: claude is not a sidecar agent")
        eq(CCUsageBridge.agents.contains("codex"), false, "sidecar: codex is not a sidecar agent")
        eq(CCUsageBridge.agents.count, 14, "sidecar: fourteen sidecar agents")
    }


    // MARK: - Billing and withheld energy

    /// Both of these are label bugs rather than arithmetic bugs, which is why
    /// they survived so long: nothing throws, the numbers are all "right", and
    /// only the sentence around them is wrong.
    private mutating func billingAndEnergy(_ energy: EnergyModel,
                                           _ pricing: PricingModel) throws {
        try freshTmp()
        func write(_ json: String) throws -> URL {
            let u = tmp.appending(path: "claude-\(UUID().uuidString).json")
            try json.write(to: u, atomically: true, encoding: .utf8)
            return u
        }

        let max5x = try write(#"{"oauthAccount":{"userRateLimitTier":"default_claude_max_5x","billingType":"stripe_subscription","hasExtraUsageEnabled":true}}"#)
        let b1 = Billing.detect(configPath: max5x)
        eq(b1.isSubscription, true, "billing: max 5x is a subscription")
        eq(b1.caveat?.contains("Claude Max 5x"), true, "billing: names the plan")
        eq(b1.caveat?.contains("not your bill"), true, "billing: says it is not a bill")

        let pro = try write(#"{"oauthAccount":{"userRateLimitTier":"default_claude_pro","hasExtraUsageEnabled":false}}"#)
        eq(Billing.detect(configPath: pro).caveat?.contains("flat rate"), true,
           "billing: pro without overage reads as flat rate")

        // An unknown tier on a subscription must still say "not a bill". The
        // failure that matters is falling through to silence, which reads as
        // "this is money you were charged".
        let future = try write(#"{"oauthAccount":{"userRateLimitTier":"default_claude_max_50x_ultra","billingType":"stripe_subscription"}}"#)
        eq(Billing.detect(configPath: future).isSubscription, true,
           "billing: an unrecognised subscription tier is still a subscription")

        let missing = tmp.appending(path: "nope.json")
        eq(Billing.detect(configPath: missing).caveat, nil,
           "billing: no config means no claim either way")

        // Withheld energy must not be confused with an unpriceable model.
        let est = Estimator(energy: energy, pricing: pricing)
        eq(est.hasCoefficients(for: "gpt-5.6-sol"), true,
           "energy: a withheld-energy model is still priceable")
        eq(est.hasCoefficients(for: "gpt-6-astra"), true,
           "energy: gpt-6 Astra is priceable")
        eq(est.hasEnergyBasis(for: "gpt-6-astra"), false,
           "energy: gpt-6 Astra has no energy basis")
        eq(est.hasEnergyBasis(for: "gpt-5.6-sol"), false,
           "energy: gpt has no energy basis")
        eq(est.hasEnergyBasis(for: "claude-opus-5"), true,
           "energy: claude does have one")

        let codex = UsageRecord(id: "c", provider: .codex, timestamp: Date(),
                                model: "gpt-5.6-sol", input: 1000, output: 100,
                                cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0,
                                cacheRead: 5000, cwd: nil, gitBranch: nil,
                                sessionId: nil, isSidechain: false, isSubagent: false)
        eq(est.wattHours(codex), nil, "energy: withheld yields nil, not zero")
        ok((est.cost(codex) ?? 0) > 0, "energy: but its cost is still computed")
    }

    private mutating func execute() -> Int32 {
        do {
            let (energy, pricing) = try Coefficients.load()
            try modelIDs()
            try timestamps()
            try dedup()
            try recursiveWalk()
            try incremental()
            try store()
            try estimator(energy, pricing)
            try codex()
            try codexPricing(pricing)
            try sidecar()
            try billingAndEnergy(energy, pricing)
        } catch {
            failures.append("threw: \(error)")
        }
        if let tmp { try? FileManager.default.removeItem(at: tmp) }

        if failures.isEmpty {
            print("all \(passed) checks passed")
            return 0
        }
        print("\(passed) passed, \(failures.count) FAILED")
        for f in failures { print("  ✗ \(f)") }
        return 1
    }

    // MARK: - Cases

    // MARK: - Codex

    private func codexMeta(session: String = "sess-1", cwd: String = "/w/proj") -> String {
        """
        {"type":"session_meta","timestamp":"2026-07-30T22:11:35.907Z",\
        "payload":{"id":"\(session)","cwd":"\(cwd)","originator":"codex_cli"}}
        """
    }

    private func codexTurnContext(model: String = "gpt-5.6-sol") -> String {
        """
        {"type":"turn_context","timestamp":"2026-07-30T22:11:36.000Z",\
        "payload":{"model":"\(model)","cwd":"/w/proj","effort":"low"}}
        """
    }

    /// `total*` are cumulative; `last*` is the delta for this turn.
    ///
    /// `totalCached` and `totalCacheWrite` default to the turn's own values,
    /// which is right for a first turn and is what a caller means when it passes
    /// only one turn's worth. Multi-turn cases pass the running totals
    /// explicitly. They exist because the parser derives a turn from the jump
    /// between consecutive cumulative blocks, so a fixture that left them at
    /// zero while filling `last_token_usage` would describe a file Codex never
    /// writes and would test the opposite of the real behaviour.
    private func codexTokenCount(lastInput: Int, lastCached: Int, lastOutput: Int,
                                 totalInput: Int, totalOutput: Int,
                                 lastCacheWrite: Int = 0, reasoning: Int = 0,
                                 plan: String = "plus",
                                 totalCached: Int? = nil, totalCacheWrite: Int? = nil,
                                 totalReasoning: Int? = nil) -> String {
        let tCached = totalCached ?? lastCached
        let tWrite = totalCacheWrite ?? lastCacheWrite
        let tReason = totalReasoning ?? reasoning
        return """
        {"type":"event_msg","timestamp":"2026-07-30T22:11:43.378Z",\
        "payload":{"type":"token_count","info":{\
        "total_token_usage":{"input_tokens":\(totalInput),"cached_input_tokens":\(tCached),\
        "cache_write_input_tokens":\(tWrite),"output_tokens":\(totalOutput),\
        "reasoning_output_tokens":\(tReason),"total_tokens":\(totalInput + totalOutput)},\
        "last_token_usage":{"input_tokens":\(lastInput),"cached_input_tokens":\(lastCached),\
        "cache_write_input_tokens":\(lastCacheWrite),"output_tokens":\(lastOutput),\
        "reasoning_output_tokens":\(reasoning),"total_tokens":\(lastInput + lastOutput)},\
        "model_context_window":258400},\
        "rate_limits":{"plan_type":"\(plan)","primary":{"used_percent":2.0}}}}
        """
    }

    private func ingestCodex(_ index: inout FileIndex) -> ([String: UsageRecord], JSONLIngestor.Stats) {
        var stats = JSONLIngestor.Stats()
        let out = CodexIngestor.ingest(root: tmp, index: &index, stats: &stats)
        return (out, stats)
    }

    private mutating func codex() throws {
        try freshTmp()
        let dir = try project("2026/07/30")
        let f = dir.appending(path: "rollout-a.jsonl")

        // One session, two turns. Deltas sum to the running total.
        try ([codexMeta(),
              codexTurnContext(),
              codexTokenCount(lastInput: 1000, lastCached: 900, lastOutput: 50,
                              totalInput: 1000, totalOutput: 50, reasoning: 20),
              codexTokenCount(lastInput: 2000, lastCached: 1800, lastOutput: 30,
                              totalInput: 3000, totalOutput: 80,
                              totalCached: 2700, totalReasoning: 20)]
             .joined(separator: "\n") + "\n")
            .write(to: f, atomically: true, encoding: .utf8)

        var idx = FileIndex()
        let (recs, _) = ingestCodex(&idx)
        eq(recs.count, 2, "codex: one record per token_count turn")

        let sorted = recs.values.sorted { ($0.input) < ($1.input) }
        guard sorted.count == 2 else { return }

        // THE correctness trap: input_tokens includes cached_input_tokens.
        eq(sorted[0].input, 100, "codex: input excludes the cached portion")
        eq(sorted[0].cacheRead, 900, "codex: cached tokens land in cacheRead")
        eq(sorted[1].input, 200, "codex: second turn input excludes cache")
        eq(sorted[1].cacheRead, 1800, "codex: second turn cache read")

        // Reasoning tokens are already inside output_tokens.
        eq(sorted[0].output, 50, "codex: reasoning is not added to output")
        eq(sorted[0].provider, .codex, "codex: provider tagged")
        eq(sorted[0].model, "gpt-5.6-sol", "codex: model carried from turn_context")
        eq(sorted[0].cwd, "/w/proj", "codex: cwd carried from session_meta")
        eq(sorted[0].sessionId, "sess-1", "codex: session id carried")

        // Idempotence: a full reparse from a clean index yields identical keys.
        var idx2 = FileIndex()
        let (again, _) = ingestCodex(&idx2)
        eq(Set(again.keys), Set(recs.keys), "codex: reparse is idempotent")

        // Incremental resume is the reason parser state is persisted: the
        // appended turn is parsed without re-reading the turn_context line.
        // Appended in place: an atomic rewrite would change the inode and be
        // correctly treated as a rotation, which is not what this is testing.
        let h = try FileHandle(forWritingTo: f)
        try h.seekToEnd()
        try h.write(contentsOf: Data((codexTokenCount(
            lastInput: 500, lastCached: 400, lastOutput: 10,
            totalInput: 3500, totalOutput: 90,
            totalCached: 3100, totalReasoning: 20) + "\n").utf8))
        try h.close()
        let (appended, _) = ingestCodex(&idx)
        eq(appended.count, 1, "codex: only the appended turn is re-read")
        eq(appended.values.first?.model, "gpt-5.6-sol",
           "codex: model survives an incremental resume past turn_context")
        eq(appended.values.first?.input, 100, "codex: appended turn input excludes cache")

        // A turn that spent nothing contributes nothing — the imported desktop
        // session stubs are full of these.
        try freshTmp()
        let d2 = try project("2026/07/31")
        try ([codexMeta(session: "empty"),
              codexTokenCount(lastInput: 0, lastCached: 0, lastOutput: 0,
                              totalInput: 0, totalOutput: 0)]
             .joined(separator: "\n") + "\n")
            .write(to: d2.appending(path: "rollout-b.jsonl"), atomically: true, encoding: .utf8)
        var idx3 = FileIndex()
        let (empty, _) = ingestCodex(&idx3)
        eq(empty.count, 0, "codex: zero-token turns are dropped")

        // Usage with no turn_context must surface, not vanish. It is tagged
        // with an id that matches no coefficient, so the app's unrecognized
        // banner catches it rather than silently counting it as free.
        try freshTmp()
        let d3 = try project("2026/08/01")
        try ([codexMeta(session: "nomodel"),
              codexTokenCount(lastInput: 100, lastCached: 0, lastOutput: 10,
                              totalInput: 100, totalOutput: 10)]
             .joined(separator: "\n") + "\n")
            .write(to: d3.appending(path: "rollout-c.jsonl"), atomically: true, encoding: .utf8)
        var idx4 = FileIndex()
        let (nomodel, _) = ingestCodex(&idx4)
        eq(nomodel.count, 1, "codex: usage without a model is kept")
        eq(nomodel.values.first?.model, CodexIngestor.unknownModel,
           "codex: unattributable usage is flagged, not dropped")

        // An index written before the context field existed must still decode.
        // Swift's synthesized Decodable ignores property defaults and throws on
        // a missing key, which would discard the whole index and silently turn
        // the next launch into a full cold re-read of the corpus.
        let legacy = #"{"entries":{"/a/b.jsonl":{"inode":1,"size":2,"offset":2,"mtime":3.5,"tail":""}}}"#
        if let decoded = try? JSONDecoder().decode(FileIndex.self, from: Data(legacy.utf8)) {
            passed += 1
            eq(decoded.entries["/a/b.jsonl"]?.offset, 2, "legacy index keeps its offset")
            eq(decoded.entries["/a/b.jsonl"]?.context.isEmpty, true,
               "legacy index gets an empty context")
        } else {
            failures.append("legacy file-index.json must still decode")
        }

        // Keys from the two parsers must not collide: Claude uses the raw
        // message id, Codex a namespaced synthetic one. A collision would make
        // one tool's turn silently overwrite the other's.
        ok(CodexIngestor.recordID(session: "s", totals: [:], fallback: 5).hasPrefix("codex:"),
           "codex keys are namespaced away from claude message ids")

        try multiSource()
    }

    /// Two sources, one shared index, one merged result — the shape
    /// `UsageEngine.parseOffMain` drives.
    private mutating func multiSource() throws {
        try freshTmp()
        let claudeRoot = try project("claude")
        let codexRoot = try project("codex")
        try (row(id: "m1") + "\n")
            .write(to: claudeRoot.appending(path: "s.jsonl"), atomically: true, encoding: .utf8)
        try ([codexMeta(), codexTurnContext(),
              codexTokenCount(lastInput: 1000, lastCached: 900, lastOutput: 50,
                              totalInput: 1000, totalOutput: 50)]
             .joined(separator: "\n") + "\n")
            .write(to: codexRoot.appending(path: "r.jsonl"), atomically: true, encoding: .utf8)

        let sources = [LogSource(provider: .claude, root: claudeRoot),
                       LogSource(provider: .codex, root: codexRoot)]
        var idx = FileIndex()
        var stats = JSONLIngestor.Stats()
        var merged: [String: UsageRecord] = [:]
        for s in sources {
            merged.merge(s.ingest(files: nil, index: &idx, stats: &stats)) { a, b in
                b.output > a.output ? b : a
            }
        }
        eq(merged.count, 2, "both sources contribute records")
        eq(Set(merged.values.map(\.provider)), [.claude, .codex],
           "each record keeps its own provider")

        // Scoping: a watcher only ever reports paths beneath its own root, and
        // handing a Codex rollout to the Claude parser would not error — it
        // would just silently find nothing. The prefix filter is what prevents
        // that, so it has to actually select.
        let codexFile = codexRoot.appending(path: "r.jsonl")
        let scoped = [codexFile].filter { $0.path.hasPrefix(codexRoot.path) }
        eq(scoped.count, 1, "codex path scopes to the codex source")
        ok([codexFile].filter { $0.path.hasPrefix(claudeRoot.path) }.isEmpty,
           "codex path does not scope to the claude source")
    }

    /// The cache contract differs by vendor and, within OpenAI, by model
    /// version. Getting this wrong is invisible in the UI but wrong in the total.
    private mutating func codexPricing(_ pricing: PricingModel) throws {
        let est = Estimator(energy: try Coefficients.load().0, pricing: pricing)

        // gpt-5.6 charges 1.25x input to write the cache; gpt-5.5 charges nothing.
        let write = UsageRecord(id: "w", provider: .codex, timestamp: nil,
                                model: "gpt-5.6-sol", input: 0, output: 0,
                                cacheWrite: 1_000_000, cacheWrite5m: 0, cacheWrite1h: 0,
                                cacheRead: 0, cwd: nil, gitBranch: nil, sessionId: nil,
                                isSidechain: false, isSubagent: false)
        close(est.cost(write) ?? -1, 5.0, 1e-9, "gpt-5.6 cache write bills at 1.25x input")

        var older = write; older.model = "gpt-5.5"
        close(est.cost(older) ?? -1, 0.0, 1e-9, "gpt-5.5 cache write is free")

        // Cache reads are 0.1x input across the OpenAI catalogue.
        var read = write
        read.cacheWrite = 0
        read.cacheRead = 1_000_000
        close(est.cost(read) ?? -1, 0.4, 1e-9, "gpt-5.6 cache read bills at 0.1x input")

        // GPT-6 Astra charges standard rates through 272K prompt tokens, then
        // applies 2x input/cache and 1.5x output to the entire request.
        var astra = UsageRecord(id: "astra", provider: .codex, timestamp: nil,
                                model: "gpt-6-astra", input: 72_000, output: 10_000,
                                cacheWrite: 100_000, cacheWrite5m: 0, cacheWrite1h: 0,
                                cacheRead: 100_000, cwd: nil, gitBranch: nil,
                                sessionId: nil, isSidechain: false, isSubagent: false)
        close(est.cost(astra) ?? -1, 2.57, 1e-9,
              "gpt-6 Astra uses standard rates at the 272K boundary")
        astra.input += 1
        close(est.cost(astra) ?? -1, 4.89002, 1e-9,
              "gpt-6 Astra applies the long-context surcharge to the full request")

        // An Anthropic record must still use Anthropic's terms.
        let claude = UsageRecord(id: "c", provider: .claude, timestamp: nil,
                                 model: "claude-opus-4-8", input: 0, output: 0,
                                 cacheWrite: 1_000_000, cacheWrite5m: 0, cacheWrite1h: 1_000_000,
                                 cacheRead: 0, cwd: nil, gitBranch: nil, sessionId: nil,
                                 isSidechain: false, isSubagent: false)
        close(est.cost(claude) ?? -1, 10.0, 1e-9, "claude 1h cache write still bills at 2x")

        // Cache writes are a component of input_tokens, not an addition, so the
        // parser must subtract them. Billing them twice is 2.25x on GPT-5.6.
        var idx = FileIndex()
        var st = IngestStats()
        try freshTmp()
        let d = try project("2026/09/01")
        try ([codexMeta(session: "cw"), codexTurnContext(),
              codexTokenCount(lastInput: 10_000, lastCached: 2_000, lastOutput: 100,
                              totalInput: 10_000, totalOutput: 100, lastCacheWrite: 3_000)]
             .joined(separator: "\n") + "\n")
            .write(to: d.appending(path: "r.jsonl"), atomically: true, encoding: .utf8)
        let cw = CodexIngestor.ingest(root: tmp, index: &idx, stats: &st)
        eq(cw.values.first?.input, 5_000, "codex: cache writes are subtracted from input too")
        eq(cw.values.first?.cacheWrite, 3_000, "codex: cache writes still counted once")
        eq(cw.values.first?.cacheRead, 2_000, "codex: cache reads counted once")
        eq(st.anomalousTokenSplit, 0, "codex: a consistent row is not flagged")

        // Every priced model must resolve to energy AND cache terms — a model
        // that prices at nil is coerced to $0 by every caller, so the check
        // that feeds the unrecognized banner has to cover all three.
        for p in pricing.models {
            ok(est.hasCoefficients(for: p.id), "\(p.id) has price, energy and cache terms")
        }
        // Every provider needs cache terms, or its records silently cost $0.
        for provider in Provider.allCases {
            ok(pricing.cacheMultipliers(for: provider) != nil,
               "provider \(provider.rawValue) has cache terms")
        }

        // Counterfactuals must not quote one vendor's models against another's
        // tokens — that is advice to change tool, which these logs can't support.
        for (provider, models) in UsageEngine.counterfactualCandidates {
            for m in models {
                eq(pricing.allPrices[m]?.provider, provider,
                   "counterfactual candidate \(m) belongs to \(provider.rawValue)")
            }
        }
    }

    private mutating func modelIDs() throws {
        eq(ModelID.normalize("claude-haiku-4-5-20251001"), "claude-haiku-4-5",
           "dated ID normalizes")
        eq(ModelID.normalize("claude-opus-4-5-20251101"), "claude-opus-4-5",
           "dated ID normalizes")
        // Aliases, and anything merely ending in digits, must be untouched.
        eq(ModelID.normalize("claude-opus-4-8"), "claude-opus-4-8", "alias untouched")
        eq(ModelID.normalize("claude-sonnet-5"), "claude-sonnet-5", "alias untouched")
        eq(ModelID.normalize("claude-fable-5"), "claude-fable-5", "alias untouched")
    }

    private mutating func timestamps() throws {
        close(JSONLIngestor.parseTimestamp("2026-07-28T03:29:56.267Z")?
            .timeIntervalSince1970 ?? -1, 1785209396.267, 0.001, "fractional seconds")
        close(JSONLIngestor.parseTimestamp("2026-07-28T03:29:56Z")?
            .timeIntervalSince1970 ?? -1, 1785209396, 0.001, "no fractional part")
        close(JSONLIngestor.parseTimestamp("1970-01-01T00:00:00Z")?
            .timeIntervalSince1970 ?? -1, 0, 0.001, "unix epoch")
        // Leap day, to exercise the civil-date algorithm.
        close(JSONLIngestor.parseTimestamp("2024-02-29T12:00:00Z")?
            .timeIntervalSince1970 ?? -1, 1709208000, 0.001, "leap day")
        ok(JSONLIngestor.parseTimestamp("not-a-date") == nil, "garbage rejected")
    }

    private mutating func dedup() throws {
        // A streaming message is logged repeatedly with a growing output count.
        // Keeping the first would undercount output — the priciest token class.
        try freshTmp()
        let f = try project("p").appending(path: "s.jsonl")
        try ([row(id: "m1", output: 3), row(id: "m1", output: 412), row(id: "m1", output: 87)]
            .joined(separator: "\n") + "\n").write(to: f, atomically: true, encoding: .utf8)

        var index = FileIndex()
        let (recs, stats) = ingestAll(&index)
        eq(recs.count, 1, "streamed repeats collapse to one record")
        eq(recs["m1"]?.output, 412, "keeps the completed message, not the first partial")
        eq(stats.duplicates, 2, "duplicate count")
        eq(stats.rawUsageRows, 3, "raw row count")

        try freshTmp()
        let g = try project("p").appending(path: "s.jsonl")
        try ([row(id: "m1"), row(id: "m2", model: "<synthetic>")].joined(separator: "\n") + "\n")
            .write(to: g, atomically: true, encoding: .utf8)
        var idx2 = FileIndex()
        let (r2, s2) = ingestAll(&idx2)
        eq(r2.count, 1, "synthetic rows excluded")
        eq(s2.synthetic, 1, "synthetic counted")
    }

    private mutating func recursiveWalk() throws {
        // Subagent logs nest two levels below session logs; a one-level glob
        // misses 77% of a real corpus.
        try freshTmp()
        let p = try project("proj")
        try (row(id: "top") + "\n").write(to: p.appending(path: "session.jsonl"),
                                          atomically: true, encoding: .utf8)
        let sub = p.appending(path: "session-id/subagents")
        try FileManager.default.createDirectory(at: sub, withIntermediateDirectories: true)
        try (row(id: "sub") + "\n").write(to: sub.appending(path: "agent-x.jsonl"),
                                          atomically: true, encoding: .utf8)

        var index = FileIndex()
        let (recs, stats) = ingestAll(&index)
        eq(recs.count, 2, "finds both session and subagent transcripts")
        eq(stats.subagentFiles, 1, "subagent file counted")
        eq(recs["sub"]?.isSubagent, true, "subagent flagged")
        eq(recs["top"]?.isSubagent, false, "session not flagged as subagent")
    }

    private mutating func incremental() throws {
        try freshTmp()
        let f = try project("p").appending(path: "s.jsonl")
        try (row(id: "m1") + "\n").write(to: f, atomically: true, encoding: .utf8)

        var index = FileIndex()
        let (first, _) = ingestAll(&index)
        eq(first.count, 1, "initial read")

        let (second, stats2) = ingestAll(&index)
        ok(second.isEmpty, "unchanged file is not re-read")
        eq(Int(stats2.bytesRead), 0, "no bytes re-read when nothing changed")

        var h = try FileHandle(forWritingTo: f)
        try h.seekToEnd()
        try h.write(contentsOf: Data((row(id: "m2") + "\n").utf8))
        try h.close()
        let (third, _) = ingestAll(&index)
        eq(Array(third.keys), ["m2"], "only the appended record comes back")

        // Partial trailing line: files are appended to live, so a read can land
        // mid-line. The remainder must be buffered, not dropped or misparsed.
        try freshTmp()
        let g = try project("p").appending(path: "s.jsonl")
        let full = row(id: "m1") + "\n"
        let cut = full.index(full.startIndex, offsetBy: full.count / 2)
        try String(full[..<cut]).write(to: g, atomically: true, encoding: .utf8)

        var idx = FileIndex()
        let (partial, _) = ingestAll(&idx)
        ok(partial.isEmpty, "half a line does not parse")

        h = try FileHandle(forWritingTo: g)
        try h.seekToEnd()
        try h.write(contentsOf: Data(String(full[cut...]).utf8))
        try h.close()
        let (complete, cstats) = ingestAll(&idx)
        eq(complete.count, 1, "completed line appears exactly once")
        eq(complete["m1"]?.output, 100, "buffered line parses intact")
        eq(cstats.unparseable, 0, "no parse errors from the split")

        // Truncation invalidates the stored offset entirely.
        try freshTmp()
        let t = try project("p").appending(path: "s.jsonl")
        try ([row(id: "m1"), row(id: "m2")].joined(separator: "\n") + "\n")
            .write(to: t, atomically: true, encoding: .utf8)
        var idx3 = FileIndex()
        _ = ingestAll(&idx3)
        try (row(id: "m3") + "\n").write(to: t, atomically: true, encoding: .utf8)
        let (after, stats3) = ingestAll(&idx3)
        eq(stats3.rotatedFiles, 1, "truncation detected")
        eq(Array(after.keys), ["m3"], "reparsed from zero after truncation")
    }

    private mutating func store() throws {
        try freshTmp()
        let s = try UsageStore(path: tmp.appending(path: "t.sqlite"))
        let base = UsageRecord(id: "m1", provider: .claude, timestamp: Date(timeIntervalSince1970: 1785209396),
                               model: "claude-opus-4-8", input: 10, output: 50, cacheWrite: 5,
                               cacheWrite5m: 0, cacheWrite1h: 5, cacheRead: 100, cwd: "/w/p",
                               gitBranch: "main", sessionId: "sess", isSidechain: false,
                               isSubagent: false)
        try s.upsert([base])
        try s.upsert([base])
        eq(try s.count(), 1, "re-ingest does not duplicate")
        eq(try s.count(), try s.distinctIDCount(), "request_id stays unique")

        var grown = base; grown.output = 900
        try s.upsert([grown])
        eq(try s.allRecords().first?.output, 900, "later, fuller output count wins")

        var stale = base; stale.output = 7
        try s.upsert([stale])
        eq(try s.allRecords().first?.output, 900, "a stale partial cannot clobber it")
        eq(try s.count(), 1, "still one row")

        // Full field round-trip.
        try freshTmp()
        let s2 = try UsageStore(path: tmp.appending(path: "t2.sqlite"))
        let r = UsageRecord(id: "m1", provider: .claude, timestamp: Date(timeIntervalSince1970: 1785209396),
                            model: "claude-fable-5", input: 1, output: 2, cacheWrite: 3,
                            cacheWrite5m: 4, cacheWrite1h: 5, cacheRead: 6, cwd: "/w/proj",
                            gitBranch: "feat", sessionId: "sess", isSidechain: true,
                            isSubagent: true)
        try s2.upsert([r])
        eq(try s2.allRecords().first, r, "all fields round-trip through sqlite")

        func mk(_ id: String, _ model: String, _ out: Int) -> UsageRecord {
            UsageRecord(id: id, provider: .claude, timestamp: Date(), model: model, input: 1, output: out,
                        cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 10,
                        cwd: nil, gitBranch: nil, sessionId: nil, isSidechain: false,
                        isSubagent: false)
        }
        try freshTmp()
        let s3 = try UsageStore(path: tmp.appending(path: "t3.sqlite"))
        try s3.upsert([mk("a", "claude-opus-4-8", 10), mk("b", "claude-opus-4-8", 20),
                       mk("c", "claude-sonnet-5", 5)])
        let t = try s3.totals(groupedBy: "model")
        eq(t["claude-opus-4-8"]?.output, 30, "grouped output sums")
        eq(t["claude-opus-4-8"]?.requests, 2, "grouped request counts")
        eq(t["claude-sonnet-5"]?.output, 5, "grouped by model")
    }

    private mutating func estimator(_ energy: EnergyModel, _ pricing: PricingModel) throws {
        var est = Estimator(energy: energy, pricing: pricing)

        let r = UsageRecord(id: "m", provider: .claude, timestamp: nil, model: "claude-opus-4-8", input: 1000,
                            output: 1000, cacheWrite: 1000, cacheWrite5m: 1000, cacheWrite1h: 0,
                            cacheRead: 1000, cwd: nil, gitBranch: nil, sessionId: nil,
                            isSidechain: false, isSubagent: false)
        // frontier-large: 0.30 Wh/1k in, 1.20 Wh/1k out; read 0.10x, write 1.0x
        let wantWh = (1000 * 0.30 + 1000 * 0.30 * 1.0 + 1000 * 0.30 * 0.10 + 1000 * 1.20) / 1000.0
        close(est.wattHours(r) ?? -1, wantWh, 1e-9, "energy matches hand computation")
        // $5/MTok in, $25/MTok out; 5m write premium 1.25x, read 0.1x
        let wantUsd = (1000 * 5.0 + 1000 * 1.25 * 5.0 + 1000 * 5.0 * 0.1 + 1000 * 25.0) / 1_000_000
        close(est.cost(r) ?? -1, wantUsd, 1e-12, "cost matches hand computation")

        // The 1h cache-write premium is 2x vs the 5m 1.25x.
        func w(_ w5: Int, _ w1h: Int) -> UsageRecord {
            UsageRecord(id: "m", provider: .claude, timestamp: nil, model: "claude-opus-4-8", input: 0, output: 0,
                        cacheWrite: w5 + w1h, cacheWrite5m: w5, cacheWrite1h: w1h, cacheRead: 0,
                        cwd: nil, gitBranch: nil, sessionId: nil, isSidechain: false,
                        isSubagent: false)
        }
        close(est.cost(w(1_000_000, 0)) ?? -1, 6.25, 1e-9, "5m cache write priced at 1.25x")
        close(est.cost(w(0, 1_000_000)) ?? -1, 10.0, 1e-9, "1h cache write priced at 2x")

        // Silently coercing an unknown model to zero is the failure mode that
        // makes a tool like this quietly wrong.
        let unknown = UsageRecord(id: "m", provider: .claude, timestamp: nil, model: "claude-from-the-future",
                                  input: 100, output: 100, cacheWrite: 0, cacheWrite5m: 0,
                                  cacheWrite1h: 0, cacheRead: 0, cwd: nil, gitBranch: nil,
                                  sessionId: nil, isSidechain: false, isSubagent: false)
        ok(est.wattHours(unknown) == nil, "unknown model yields nil energy, not zero")
        ok(est.cost(unknown) == nil, "unknown model yields nil cost, not zero")
        ok(!est.hasCoefficients(for: unknown.model), "unknown model reported as unrecognized")

        for m in energy.models {
            ok(est.hasCoefficients(for: m.id), "cataloged model \(m.id) resolves")
        }

        let big = UsageRecord(id: "m", provider: .claude, timestamp: nil, model: "claude-opus-4-8", input: 1000,
                              output: 1000, cacheWrite: 1000, cacheWrite5m: 0,
                              cacheWrite1h: 1000, cacheRead: 100_000, cwd: nil, gitBranch: nil,
                              sessionId: nil, isSidechain: false, isSubagent: false)
        let lo = est.wattHours(big, at: .lo) ?? 0
        let mid = est.wattHours(big, at: .v) ?? 0
        let hi = est.wattHours(big, at: .hi) ?? 0
        ok(lo < mid && mid < hi, "band is ordered lo < v < hi")

        // ~95% of real token volume is cache reads, so this one coefficient
        // moves the total more than any model-choice decision does.
        let realistic = UsageRecord(id: "m", provider: .claude, timestamp: nil, model: "claude-opus-4-8",
                                    input: 8_000, output: 17_000, cacheWrite: 215_000,
                                    cacheWrite5m: 0, cacheWrite1h: 215_000,
                                    cacheRead: 4_250_000, cwd: nil, gitBranch: nil,
                                    sessionId: nil, isSidechain: false, isSubagent: false)
        est.cacheReadFactorOverride = 0.01
        let low = est.wattHours(realistic) ?? 0
        est.cacheReadFactorOverride = 0.30
        let high = est.wattHours(realistic) ?? 1
        ok(high / low > 4.0, "cacheReadFactor swings the total ~4.6x across its band")
        est.cacheReadFactorOverride = nil

        let rs = [UsageRecord(id: "m", provider: .claude, timestamp: nil, model: "claude-opus-4-8", input: 1000,
                              output: 1000, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0,
                              cacheRead: 10_000, cwd: nil, gitBranch: nil, sessionId: nil,
                              isSidechain: false, isSubagent: false)]
        let haiku = est.counterfactual(rs, as: "claude-haiku-4-5")
        ok(haiku.wh > 0 && haiku.wh < (est.wattHours(rs[0]) ?? 0),
           "counterfactual on a smaller model is cheaper but non-zero")

        // Cache efficiency is a prompt-side measure; output is never cacheable.
        let tt = TokenTotals(requests: 1, input: 100, cacheWrite: 100, cacheWrite5m: 0,
                             cacheWrite1h: 100, cacheRead: 800, output: 999_999)
        close(tt.cacheEfficiency, 0.8, 1e-12, "cache efficiency ignores output tokens")
    }
}
