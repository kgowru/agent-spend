import Foundation

/// Headless mode: `AgentSpend --verify [root]`.
///
/// Prints the same aggregates as `tools/prototype.py` so the two can be diffed
/// directly. The Python oracle is the reference; any divergence here is a
/// parser bug in the Swift ingestor, not a modelling disagreement — both read
/// the same coefficient JSON.
enum CLI {
    /// `AgentSpend --agents [store.sqlite] [agent,agent]`.
    ///
    /// Exercises the whole sidecar path: locate the bundled helper, run it once
    /// per agent, parse, persist, read back. `only` overrides the agent list,
    /// including with agents the sidecar does not normally own, which is how you
    /// exercise the subprocess and parse path against real data on a machine
    /// where none of the fourteen have any. It is a debugging affordance, not a
    /// supported mode.
    static func runAgents(storePath: URL?, only: [String]? = nil) -> Int32 {
        guard let helper = CCUsageBridge.helperURL() else {
            print("""
                no ccusage helper found.
                  Expected at Contents/Helpers/ccusage in the app bundle, or
                  mac/vendor/ccusage in a dev checkout. Run mac/vendor-ccusage.sh.
                """)
            return 1
        }
        print("helper: \(helper.path)")
        let list = only ?? CCUsageBridge.agents
        if only != nil { print("override: \(list.joined(separator: ", "))") }

        let clock = ContinuousClock()
        var rows: [CCUsageBridge.DailyRow] = []
        var errors: [String] = []
        let elapsed = clock.measure {
            for agent in list {
                do { rows.append(contentsOf: try CCUsageBridge.collect(agent: agent)) }
                catch { errors.append(String(describing: error)) }
            }
        }
        let secs = Double(elapsed.components.seconds)
            + Double(elapsed.components.attoseconds) / 1e18
        print("scanned \(list.count) agents in \(String(format: "%.2f", secs))s, \(rows.count) rows")
        for e in errors { print("  ! \(e)") }

        do {
            let path = try storePath ?? UsageStore.defaultLocation()
            print("store:  \(path.path)")
            let store = try UsageStore(path: path)
            let written = try store.replaceExternal(rows)
            print("wrote \(written) rows\n")

            let summaries = try store.externalSummaries()
            if summaries.isEmpty {
                print("""
                    No sidecar agent reported any usage.
                      That is the expected result on a machine that only runs Claude
                      Code and Codex, which are read natively and are not listed here.
                    """)
            } else {
                print("agent        days  \(pad("tokens", 16))       cost  models")
                for s in summaries {
                    print("  \(s.agent.padding(toLength: 11, withPad: " ", startingAt: 0))"
                          + " \(pad(s.days, 4))  \(pad(s.totals.total, 16))"
                          + "  \(String(format: "%9.2f", s.usd))  "
                          + s.models.prefix(3).joined(separator: ", "))
                }
            }
            return errors.isEmpty ? 0 : 2
        } catch {
            print("store error: \(error)")
            return 1
        }
    }

    static func runVerify(root: URL, provider: Provider = .claude) -> Int32 {
        do {
            let (energyModel, pricing) = try Coefficients.load()
            var estimator = Estimator(energy: energyModel, pricing: pricing)

            var index = FileIndex()   // always cold, for a like-for-like compare
            var stats = JSONLIngestor.Stats()
            let clock = ContinuousClock()
            var records: [UsageRecord] = []
            let source = LogSource(provider: provider, root: root)
            let elapsed = clock.measure {
                records = Array(source.ingest(files: nil, index: &index, stats: &stats).values)
            }

            let gb = Double(stats.bytesRead) / 1e9
            print("""
                files=\(stats.filesScanned) (subagent \(stats.subagentFiles))  \
                \(String(format: "%.2f", gb)) GB  rawUsageRows=\(stats.rawUsageRows)  \
                unique=\(records.count)  duplicates=\(stats.duplicates) \
                (\(pct(stats.duplicates, stats.rawUsageRows)))  synthetic=\(stats.synthetic)
                supersededPartials=\(stats.supersededPartials)  \
                parse=\(String(format: "%.2f", Double(elapsed.components.seconds) + Double(elapsed.components.attoseconds) / 1e18))s
                """)

            let unrecognized = Set(records.map(\.model))
                .filter { !estimator.hasCoefficients(for: $0) }
            if !unrecognized.isEmpty {
                print("\n!! NO COEFFICIENTS — counted as ZERO energy and ZERO cost: "
                      + unrecognized.sorted().joined(separator: ", "))
            }

            var totals = TokenTotals()
            for r in records {
                totals.requests += 1
                totals.input += r.input
                totals.cacheWrite += r.cacheWrite
                totals.cacheRead += r.cacheRead
                totals.output += r.output
            }
            print("\ntoken mix")
            for (label, n) in [("cacheRead", totals.cacheRead), ("cacheWrite", totals.cacheWrite),
                               ("output", totals.output), ("input", totals.input)] {
                print("  \(label.padding(toLength: 11, withPad: " ", startingAt: 0))"
                      + " \(pad(n, 16))  \(pct(n, totals.total, decimals: 2))")
            }

            var byModel: [String: (n: Int, wh: Double, usd: Double)] = [:]
            var totalWh = 0.0, totalUsd = 0.0
            for r in records {
                let wh = estimator.wattHours(r) ?? 0
                let usd = estimator.cost(r) ?? 0
                totalWh += wh; totalUsd += usd
                var e = byModel[r.model] ?? (0, 0, 0)
                e.n += 1; e.wh += wh; e.usd += usd
                byModel[r.model] = e
            }

            print("\n\("model".padding(toLength: 20, withPad: " ", startingAt: 0))"
                  + "\(pad("requests", 9)) \(pad("Wh (est)", 12)) \(pad("$", 10))  share")
            for (m, e) in byModel.sorted(by: { $0.value.wh > $1.value.wh }) {
                print("  \(m.padding(toLength: 18, withPad: " ", startingAt: 0))"
                      + " \(pad(e.n, 9)) \(pad(e.wh, 12, 1)) \(pad(e.usd, 10, 2))"
                      + "  \(pct(e.wh, totalWh))")
            }

            let lo = records.reduce(0.0) { $0 + (estimator.wattHours($1, at: .lo) ?? 0) }
            let hi = records.reduce(0.0) { $0 + (estimator.wattHours($1, at: .hi) ?? 0) }
            print("\nTOTAL  \(fmt(totalWh / 1000, 1)) kWh  "
                  + "(band \(fmt(lo / 1000, 1))-\(fmt(hi / 1000, 1)))   $\(fmt(totalUsd, 2))")
            let subWh = records.filter(\.isSubagent)
                .reduce(0.0) { $0 + (estimator.wattHours($1) ?? 0) }
            print("  of which subagents: \(records.filter(\.isSubagent).count) requests, "
                  + "\(fmt(subWh / 1000, 1)) kWh (\(pct(subWh, totalWh)))")

            // Cache reads are ~95% of volume, so this one coefficient moves the
            // total more than any model-choice decision.
            print("\ncacheReadFactor sensitivity (all else held at v)")
            for rf in [0.01, 0.05, 0.10, 0.20, 0.30] {
                estimator.cacheReadFactorOverride = rf
                let t = records.reduce(0.0) { $0 + (estimator.wattHours($1) ?? 0) }
                print("  \(fmt(rf, 2))  \(pad(t / 1000, 10, 1)) kWh   \(fmt(t / totalWh, 2))x")
            }
            estimator.cacheReadFactorOverride = nil

            print("\ncache efficiency: \(pct(totals.cacheRead, totals.cacheRead + totals.cacheWrite + totals.input))"
                  + " of prompt tokens served from cache")
            return 0
        } catch {
            FileHandle.standardError.write(Data("error: \(error)\n".utf8))
            return 1
        }
    }

    // MARK: - Formatting

    private static func fmt(_ d: Double, _ places: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = places
        f.maximumFractionDigits = places
        return f.string(from: NSNumber(value: d)) ?? "\(d)"
    }

    private static func pad(_ n: Int, _ w: Int) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal
        let s = f.string(from: NSNumber(value: n)) ?? "\(n)"
        return String(repeating: " ", count: max(0, w - s.count)) + s
    }

    private static func pad(_ d: Double, _ w: Int, _ places: Int) -> String {
        let s = fmt(d, places)
        return String(repeating: " ", count: max(0, w - s.count)) + s
    }

    private static func pad(_ s: String, _ w: Int) -> String {
        String(repeating: " ", count: max(0, w - s.count)) + s
    }

    private static func pct(_ a: Int, _ b: Int, decimals: Int = 1) -> String {
        b == 0 ? "0%" : fmt(100 * Double(a) / Double(b), decimals) + "%"
    }

    private static func pct(_ a: Double, _ b: Double, decimals: Int = 1) -> String {
        b == 0 ? "0%" : fmt(100 * a / b, decimals) + "%"
    }
}
