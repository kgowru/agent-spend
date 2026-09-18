import Foundation

/// Reads the agent CLIs AgentSpend has no native parser for, by shelling out to
/// the bundled `ccusage` binary (MIT, see Resources/LICENSE-ccusage).
///
/// Five things this has to get right, each measured on a real corpus rather than
/// assumed:
///
///  1. **Never ask it for Claude Code.** `ccusage claude` peaks at 1.2 GB
///     resident on this machine, because it loads the whole 1.8 GB of
///     `~/.claude/projects` at once. The native ingestor reads the same data
///     incrementally from a byte offset at a few MB. It also agrees with ccusage
///     exactly, 1.00x per date, while retaining 32 days of history ccusage
///     cannot see at all (Claude Code prunes old sessions; the store never
///     deletes). Asking the sidecar for Claude would cost a gigabyte to get a
///     strictly worse answer.
///  2. **Never ask it for Codex either.** ccusage sums Codex's per-turn
///     `last_token_usage` deltas, so every dropped `token_count` event is lost:
///     18,513,223 tokens against a true 19,206,339 here, a 3.6% undercount. The
///     native parser reads the cumulative running total and matches Codex's own
///     `state_5.sqlite` exactly.
///  3. **Always pass `--offline`.** Without it ccusage fetches LiteLLM and
///     models.dev on every invocation and caches them under `~/.cache/ccusage`.
///     The app promises no network and no telemetry, and that promise does not
///     get a footnote for a subprocess. The embedded pricing snapshot is what
///     `--offline` falls back to, and it is complete.
///  4. **One invocation per agent.** The unified report costs 1.2 GB because it
///     includes Claude. Per agent it is 2 to 68 MB, and since they run in
///     sequence the peak is the largest single agent, not the sum.
///  5. **Read stdout before waiting.** `waitUntilExit()` before draining the
///     pipe deadlocks as soon as output exceeds the 64 KB pipe buffer. The
///     unified report is 124 KB, so this is a real deadlock and not a
///     theoretical one.
enum CCUsageBridge {
    /// Agents the sidecar owns. `claude` and `codex` are deliberately absent:
    /// see points 1 and 2 above. Keep in sync with `agents` in ccusage-lock.json.
    static let agents = [
        "opencode", "amp", "droid", "codebuff", "hermes", "pi",
        "goose", "kilo", "copilot", "gemini", "kimi", "qwen",
        "openclaw", "grok",
    ]

    enum BridgeError: Error, CustomStringConvertible {
        case notBundled
        case failed(agent: String, status: Int32, stderr: String)
        case timedOut(agent: String)
        case undecodable(agent: String, underlying: String)

        var description: String {
            switch self {
            case .notBundled:
                return "the ccusage helper is missing from the app bundle"
            case .failed(let a, let s, let e):
                return "ccusage \(a) exited \(s): \(e.isEmpty ? "no stderr" : e)"
            case .timedOut(let a):
                return "ccusage \(a) timed out"
            case .undecodable(let a, let u):
                return "ccusage \(a) emitted JSON this app does not understand: \(u)"
            }
        }
    }

    /// One agent's usage on one day, already flattened per model.
    struct DailyRow: Sendable, Equatable {
        var agent: String
        var day: String          // YYYY-MM-DD, grouped in local time by ccusage
        var model: String
        var input: Int
        var output: Int
        var cacheWrite: Int
        var cacheRead: Int
        var reasoning: Int
        /// ccusage's own figure for the whole day, carried on every model row of
        /// that day rather than split. It is not divisible: ccusage reports cost
        /// per date, and the per-model breakdown it returns alongside carries no
        /// cost field, so apportioning it by token share would be inventing a
        /// number. Callers that total a day must therefore read this from one
        /// row, not sum it. `UsageStore.externalDailyCost` does exactly that.
        var dayCostUSD: Double
    }

    // MARK: - Locating the helper

    /// Packaged app: `Contents/Helpers/ccusage`. Dev: `mac/vendor/ccusage`.
    ///
    /// Deliberately never falls back to a `ccusage` found on `$PATH`. A binary we
    /// did not pin, verify and sign is not one whose numbers we should put under
    /// a heading that says the dollars are exact, and silently reading a
    /// different version would produce drift nobody could explain.
    static func helperURL() -> URL? {
        let bundled = Bundle.main.bundleURL
            .appending(path: "Contents/Helpers/ccusage")
        if FileManager.default.isExecutableFile(atPath: bundled.path) { return bundled }

        // `swift run` puts us in .build/<config>/; the vendored copy is three
        // levels up next to the sources. Dev convenience only.
        var probe = Bundle.main.bundleURL
        for _ in 0..<4 {
            let candidate = probe.appending(path: "vendor/ccusage")
            if FileManager.default.isExecutableFile(atPath: candidate.path) { return candidate }
            probe = probe.deletingLastPathComponent()
        }
        return nil
    }

    static var isAvailable: Bool { helperURL() != nil }

    // MARK: - Running

    /// Collect every sidecar agent. Errors are per agent and non-fatal: one
    /// tool changing its log format must not take the other thirteen down, and
    /// must not take the native Claude and Codex numbers down either.
    ///
    /// Returns the rows plus whatever went wrong, so the UI can show a specific
    /// "Goose could not be read" rather than a silent zero. A silent zero is the
    /// failure this whole app exists to argue against.
    static func collectAll(since: Date? = nil,
                           timeout: TimeInterval = 20) -> (rows: [DailyRow], errors: [String]) {
        var rows: [DailyRow] = []
        var errors: [String] = []
        for agent in agents {
            do {
                rows.append(contentsOf: try collect(agent: agent, since: since, timeout: timeout))
            } catch {
                errors.append(String(describing: error))
            }
        }
        return (rows, errors)
    }

    static func collect(agent: String,
                        since: Date? = nil,
                        timeout: TimeInterval = 20) throws -> [DailyRow] {
        guard let helper = helperURL() else { throw BridgeError.notBundled }

        var args = [agent, "daily", "--json", "--offline"]
        if let since {
            let f = DateFormatter()
            f.dateFormat = "yyyyMMdd"
            f.timeZone = .current
            args.append(contentsOf: ["--since", f.string(from: since)])
        }

        let (out, err, status) = try run(helper, args, timeout: timeout, agent: agent)
        guard status == 0 else {
            throw BridgeError.failed(agent: agent, status: status, stderr: err)
        }
        return try parse(agent: agent, json: out)
    }

    private static func run(_ url: URL, _ args: [String], timeout: TimeInterval,
                            agent: String) throws -> (Data, String, Int32) {
        let p = Process()
        p.executableURL = url
        p.arguments = args
        // ccusage honours CODEX_HOME, GEMINI_DATA_DIR and friends, so the user's
        // environment is inherited on purpose: someone with a relocated agent
        // directory should still be read correctly. NO_COLOR keeps ANSI escapes
        // out of a stream we are about to hand to JSONDecoder.
        var env = ProcessInfo.processInfo.environment
        env["NO_COLOR"] = "1"
        p.environment = env

        let outPipe = Pipe(), errPipe = Pipe()
        p.standardOutput = outPipe
        p.standardError = errPipe
        try p.run()

        // Drain both pipes on background queues BEFORE waiting. Reading one
        // fully and then the other deadlocks whenever the unread one fills its
        // 64 KB buffer, and waiting first deadlocks on any output at all.
        let group = DispatchGroup()
        var outData = Data(), errData = Data()
        for (pipe, sink) in [(outPipe, 0), (errPipe, 1)] {
            group.enter()
            DispatchQueue.global(qos: .utility).async {
                let d = (try? pipe.fileHandleForReading.readToEnd()) ?? Data()
                if sink == 0 { outData = d } else { errData = d }
                group.leave()
            }
        }

        // A wedged sidecar must not wedge the menu bar. Terminate, then escalate
        // to SIGKILL, because a process blocked in a syscall ignores SIGTERM.
        if group.wait(timeout: .now() + timeout) == .timedOut {
            p.terminate()
            if group.wait(timeout: .now() + 2) == .timedOut { kill(p.processIdentifier, SIGKILL) }
            _ = group.wait(timeout: .now() + 2)
            throw BridgeError.timedOut(agent: agent)
        }
        p.waitUntilExit()
        return (outData, String(data: errData, encoding: .utf8) ?? "", p.terminationStatus)
    }

    // MARK: - Parsing

    /// ccusage's per-agent JSON is not the same shape as its unified JSON, and
    /// is not even self-consistent: a day row carries `costUSD`, while the
    /// `totals` of an agent with no data carries `totalCost`. Both spellings are
    /// accepted rather than guessed at.
    private struct Response: Decodable {
        struct Row: Decodable {
            let date: String
            let inputTokens: Int?
            let outputTokens: Int?
            let cacheCreationTokens: Int?
            let cacheReadTokens: Int?
            let reasoningOutputTokens: Int?
            let costUSD: Double?
            let totalCost: Double?
            let models: [String: Model]?

            var cost: Double { costUSD ?? totalCost ?? 0 }
        }
        struct Model: Decodable {
            let inputTokens: Int?
            let outputTokens: Int?
            let cacheCreationTokens: Int?
            let cacheReadTokens: Int?
            let reasoningOutputTokens: Int?
        }
        let daily: [Row]?
    }

    static func parse(agent: String, json: Data) throws -> [DailyRow] {
        guard !json.isEmpty else { return [] }
        let decoded: Response
        do {
            decoded = try JSONDecoder().decode(Response.self, from: json)
        } catch {
            throw BridgeError.undecodable(agent: agent, underlying: String(describing: error))
        }

        var rows: [DailyRow] = []
        for row in decoded.daily ?? [] {
            // An agent that ran but has no per-model breakdown still spent
            // money. Record it against a sentinel rather than dropping the day,
            // so the total stays right and the gap is visible in the UI.
            let models = row.models ?? [:]
            if models.isEmpty {
                let total = (row.inputTokens ?? 0) + (row.outputTokens ?? 0)
                    + (row.cacheCreationTokens ?? 0) + (row.cacheReadTokens ?? 0)
                guard total > 0 || row.cost > 0 else { continue }
                rows.append(DailyRow(
                    agent: agent, day: row.date, model: "\(agent)-unknown",
                    input: row.inputTokens ?? 0, output: row.outputTokens ?? 0,
                    cacheWrite: row.cacheCreationTokens ?? 0,
                    cacheRead: row.cacheReadTokens ?? 0,
                    reasoning: row.reasoningOutputTokens ?? 0,
                    dayCostUSD: row.cost))
                continue
            }
            for (model, m) in models {
                rows.append(DailyRow(
                    agent: agent, day: row.date, model: model,
                    input: m.inputTokens ?? 0, output: m.outputTokens ?? 0,
                    cacheWrite: m.cacheCreationTokens ?? 0,
                    cacheRead: m.cacheReadTokens ?? 0,
                    reasoning: m.reasoningOutputTokens ?? 0,
                    dayCostUSD: row.cost))
            }
        }
        return rows
    }
}
