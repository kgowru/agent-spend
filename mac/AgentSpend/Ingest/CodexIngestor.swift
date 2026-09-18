import Foundation

/// Incremental parser for Codex CLI rollout logs (`~/.codex/sessions`).
///
/// Codex records the same underlying thing as Claude Code — tokens spent per
/// turn — but almost none of the surrounding conventions match, and each
/// mismatch is a way to be quietly wrong:
///
///  1. **Input is cache-inclusive.** `input_tokens` already contains
///     `cached_input_tokens`, the opposite of Anthropic's split. Verified by
///     arithmetic on the real corpus: `total_tokens == input_tokens +
///     output_tokens`, with the cached count a subset of input. Passing the raw
///     figure through would bill ~2.1M cached tokens at the full input rate on
///     a single session here. `UsageRecord.input` is defined as *uncached*
///     input, so the subtraction happens at the boundary.
///  2. **Reasoning tokens are already inside `output_tokens`.** Adding them
///     double-counts the priciest class.
///  3. **No per-message id to dedup on.** Claude has `message.id`; a
///     `token_count` event has nothing. But the event carries both a per-turn
///     delta and a running cumulative total, and the cumulative total is
///     strictly increasing whenever tokens were actually spent — so it is
///     itself a stable, resume-safe identity for the turn. See `recordID`.
///  4. **Model and cwd arrive on a different event.** They come once in
///     `turn_context`; every later `token_count` row depends on having seen it.
///     A resumed pass starts at a byte offset past that event, so the state is
///     persisted in the `FileIndex` entry rather than held only in memory.
enum CodexIngestor {
    /// Keys for the sticky state carried in `FileIndex.Entry.context`.
    private enum ContextKey {
        static let model = "codex.model"
        static let cwd = "codex.cwd"
        static let sessionID = "codex.session"
        static let planType = "codex.plan"
        // Previous cumulative totals, so a turn can be derived as the jump
        // between consecutive events rather than trusted from the event's own
        // delta field. Carried in the FileIndex so a resumed pass that starts
        // mid-file still computes the right first difference.
        static let prevInput = "codex.prev.input"
        static let prevCached = "codex.prev.cached"
        static let prevOutput = "codex.prev.output"
        static let prevWrite = "codex.prev.write"
        static let prevTotal = "codex.prev.total"
        static let segment = "codex.segment"
    }

    /// Stands in for a turn whose `turn_context` was never seen.
    ///
    /// Deliberately not a silent skip and not a guess: this id matches no
    /// pricing or energy entry, so the tokens surface in the app's
    /// unrecognized-model banner instead of being counted as free.
    static let unknownModel = "codex-unknown"

    /// Only a fraction of lines carry usage. Byte-scanning for this before
    /// decoding avoids paying a full JSON parse on the rest, the same trick the
    /// Claude ingestor uses.
    private static let usageMarker = Array(#""token_count""#.utf8)
    private static let contextMarker = Array(#""turn_context""#.utf8)
    private static let metaMarker = Array(#""session_meta""#.utf8)

    static func defaultRoot() -> URL {
        URL(fileURLWithPath: NSHomeDirectory()).appending(path: ".codex/sessions")
    }

    static func sessionFiles(under root: URL) -> [URL] {
        LineScanner.sessionFiles(under: root)
    }

    static func ingest(
        root: URL,
        index: inout FileIndex,
        stats: inout IngestStats
    ) -> [String: UsageRecord] {
        ingest(files: sessionFiles(under: root), index: &index, stats: &stats)
    }

    static func ingest(
        files: [URL],
        index: inout FileIndex,
        stats: inout IngestStats
    ) -> [String: UsageRecord] {
        var best: [String: UsageRecord] = [:]
        LineScanner.scan(files: files, index: &index, stats: &stats) { line, url, context, stats in
            ingest(line: line, file: url, context: &context, into: &best, stats: &stats)
        }
        return best
    }

    private static func ingest(
        line: Data.SubSequence,
        file: URL,
        context: inout [String: String],
        into best: inout [String: UsageRecord],
        stats: inout IngestStats
    ) {
        // Cheap byte reject first: most lines are message/reasoning/tool events
        // that carry none of the three things this parser cares about.
        let hasUsage = LineScanner.contains(line, usageMarker)
        guard hasUsage || LineScanner.contains(line, contextMarker)
                || LineScanner.contains(line, metaMarker) else { return }

        guard let obj = try? JSONSerialization.jsonObject(with: Data(line)) as? [String: Any] else {
            stats.unparseable += 1
            return
        }
        let payload = obj["payload"] as? [String: Any] ?? [:]

        // `session_meta` and `turn_context` only update the carried state.
        switch obj["type"] as? String {
        case "session_meta":
            if let id = payload["id"] as? String { context[ContextKey.sessionID] = id }
            if let cwd = payload["cwd"] as? String { context[ContextKey.cwd] = cwd }
            return
        case "turn_context":
            if let model = payload["model"] as? String {
                context[ContextKey.model] = ModelID.normalize(model)
            }
            if let cwd = payload["cwd"] as? String { context[ContextKey.cwd] = cwd }
            return
        default:
            break
        }

        guard payload["type"] as? String == "token_count",
              let info = payload["info"] as? [String: Any] else { return }

        // The plan is recorded so the UI can say whether these tokens were
        // billed at API rates or absorbed by a subscription. On a ChatGPT plan
        // the dollar figure is a list-price equivalent, not money charged.
        if let limits = payload["rate_limits"] as? [String: Any],
           let plan = limits["plan_type"] as? String {
            context[ContextKey.planType] = plan
        }

        // Derive this turn from the jump between consecutive *cumulative*
        // totals, not from the event's own `last_token_usage`.
        //
        // Both fields are present and usually agree. But Codex silently drops
        // `token_count` events: on the local corpus 11 of 12 native sessions
        // agree to the token, while one lost 693,116 because a single event went
        // missing between two turns. Summing reported deltas there gives
        // 5,749,774 against a true 6,442,890, and 18,513,223 against 19,206,339
        // across the corpus, a 3.6% undercount. ccusage has exactly this bug;
        // its Codex total is precisely the delta sum.
        //
        // A cumulative counter cannot lose a turn: whatever happened between two
        // events is inside the jump. The series telescopes to the final total by
        // construction, and it reproduces every component field exactly against
        // Codex's own state sqlite, reasoning tokens included.
        guard let totals = info["total_token_usage"] as? [String: Any] else { return }

        let curInput = totals["input_tokens"] as? Int ?? 0
        let curCached = totals["cached_input_tokens"] as? Int ?? 0
        let curOutput = totals["output_tokens"] as? Int ?? 0
        let curWrite = totals["cache_write_input_tokens"] as? Int ?? 0
        let curTotal = totals["total_tokens"] as? Int ?? (curInput + curOutput)

        func prev(_ key: String) -> Int { Int(context[key] ?? "") ?? 0 }
        // A cumulative counter going backwards means a new accounting segment
        // (a `/compact`, or a resumed thread), not a negative turn. Rebase to
        // zero and bump the segment so the record ids stay unique.
        let reset = curTotal < prev(ContextKey.prevTotal)
        let base = reset
            ? (input: 0, cached: 0, output: 0, write: 0)
            : (input: prev(ContextKey.prevInput), cached: prev(ContextKey.prevCached),
               output: prev(ContextKey.prevOutput), write: prev(ContextKey.prevWrite))
        if reset { context[ContextKey.segment] = String(prev(ContextKey.segment) + 1) }

        context[ContextKey.prevInput] = String(curInput)
        context[ContextKey.prevCached] = String(curCached)
        context[ContextKey.prevOutput] = String(curOutput)
        context[ContextKey.prevWrite] = String(curWrite)
        context[ContextKey.prevTotal] = String(curTotal)

        let rawInput = curInput - base.input
        let cached = curCached - base.cached
        let output = curOutput - base.output
        let cacheWrite = curWrite - base.write

        // Nothing was spent — the imported "Codex Desktop" session stubs are
        // full of these. Counting them would add empty rows to every session
        // list and drag the per-turn averages down.
        guard rawInput + output + cacheWrite > 0 else { return }

        stats.rawUsageRows += 1

        // Both cached reads and cache writes are *components* of `input_tokens`,
        // not additions to it — `total_tokens == input_tokens + output_tokens`
        // holds exactly across all 262 real turns in the observed corpus, so
        // nothing else can be hiding outside `input_tokens`. Failing to subtract
        // the write would bill those tokens twice: once as fresh input and again
        // at the write rate, 2.25x the truth on GPT-5.6.
        //
        // Caveat worth stating: every observed row has `cache_write_input_tokens
        // == 0`, so the write half of this is reasoned from the arithmetic rather
        // than measured. `cached` is confirmed a subset on all 309 rows.
        let uncached = rawInput - cached - cacheWrite

        // A negative result means the format is not what is assumed above.
        // Counted, not silently clamped: quietly flooring it at zero would turn
        // a broken assumption into a ~10x undercount with nothing to see.
        if uncached < 0 { stats.anomalousTokenSplit += 1 }

        let sessionID = context[ContextKey.sessionID] ?? "unknown"
        // The file path disambiguates when `session_meta` was never seen.
        // Without it every such turn keys off the literal "unknown", and two
        // unrelated sessions reaching the same cumulative total would collide —
        // one silently discarded and reported as an ordinary dedup.
        var scope = sessionID == "unknown" ? "unknown:\(file.path)" : sessionID
        // After a counter reset the cumulative total restarts, so a later
        // segment can reach a value an earlier one already used. Without the
        // segment in the key those two turns collide and one is discarded as a
        // duplicate, which would show up as spend quietly going missing.
        if let seg = context[ContextKey.segment], seg != "0" { scope += "#\(seg)" }
        let key = recordID(session: scope, totals: totals, fallback: rawInput + output)

        if let prior = best[key] {
            stats.duplicates += 1
            guard output > prior.output else { return }
            stats.supersededPartials += 1
        }

        let model = context[ContextKey.model] ?? unknownModel
        best[key] = UsageRecord(
            id: key,
            provider: .codex,
            timestamp: (obj["timestamp"] as? String).flatMap(JSONLIngestor.parseTimestamp),
            model: model,
            input: max(0, uncached),
            output: output,
            cacheWrite: cacheWrite,
            // Codex reports one cache-write figure with no TTL split. Leaving
            // the breakdown at zero makes `Estimator.cost` charge the whole
            // amount at the model's single write rate, which is correct here.
            cacheWrite5m: 0,
            cacheWrite1h: 0,
            cacheRead: cached,
            cwd: context[ContextKey.cwd],
            // Codex rollout logs carry no branch, and there are no subagent
            // transcripts to separate out.
            gitBranch: nil,
            sessionId: sessionID,
            isSidechain: false,
            isSubagent: false
        )
    }

    /// Identity for one turn.
    ///
    /// The running cumulative total is strictly increasing across turns that
    /// actually spent tokens, so `(session, cumulative total)` names a turn
    /// uniquely without needing an ordinal — which matters because an ordinal
    /// could not survive a resume that starts mid-file. Re-reading the same
    /// bytes yields the same key and the same values, so the pass is idempotent.
    ///
    /// `total_tokens` is present on every `token_count` event in the observed
    /// corpus. The fallback covers a `total_token_usage` that is missing
    /// altogether, and is deliberately weaker: a per-turn delta is not
    /// monotonic, so two turns spending the same amount would collide. That is
    /// the right trade against inventing an ordinal that cannot survive a
    /// resume, but it is a fallback, not the contract.
    static func recordID(session: String, totals: [String: Any], fallback: Int) -> String {
        let marker = (totals["total_tokens"] as? Int) ?? fallback
        return "codex:\(session):\(marker)"
    }
}
