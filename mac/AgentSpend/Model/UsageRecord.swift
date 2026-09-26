import Foundation

/// Which agent CLI a record came from.
///
/// Carried on every record because the two tools disagree on things the
/// arithmetic depends on — most importantly whether a reported input count
/// already includes the cached tokens (Codex) or excludes them (Claude Code),
/// and whether cache writes are billable at all. A record that has lost track
/// of its origin cannot be priced correctly.
enum Provider: String, Sendable, Equatable, CaseIterable, Codable {
    case claude
    case codex

    /// What the user calls it.
    var displayName: String {
        switch self {
        case .claude: return "Claude Code"
        case .codex:  return "Codex"
        }
    }
}

/// One deduplicated API request, as recovered from an agent CLI session log.
///
/// The field names follow Anthropic's split — `input` is *uncached* input and
/// `cacheRead` is separate. Parsers for tools that report a cache-inclusive
/// input (Codex does) must subtract before constructing a record, so that
/// everything downstream can assume one convention.
struct UsageRecord: Sendable, Equatable {
    var id: String            // dedup key — message.id for Claude, synthesized for Codex
    var provider: Provider
    var timestamp: Date?
    var model: String         // date-suffix normalized
    var input: Int            // uncached input only
    var output: Int           // includes reasoning tokens, which are a subset
    var cacheWrite: Int
    var cacheWrite5m: Int
    var cacheWrite1h: Int
    var cacheRead: Int
    var cwd: String?
    var gitBranch: String?
    var sessionId: String?
    var isSidechain: Bool
    var isSubagent: Bool

    var project: String { (cwd as NSString?)?.lastPathComponent ?? "unknown" }
    var totalTokens: Int { input + output + cacheWrite + cacheRead }
}

/// Model IDs appear in both alias (`claude-haiku-4-5`) and dated
/// (`claude-haiku-4-5-20251001`) form. Unnormalized, dated rows match no
/// coefficient and are silently counted as zero — which is exactly how a tool
/// like this ends up quietly wrong.
enum ModelID {
    static func normalize(_ raw: String) -> String {
        guard raw.count > 9 else { return raw }
        let suffix = raw.suffix(9)
        guard suffix.first == "-", suffix.dropFirst().allSatisfy(\.isNumber) else { return raw }
        return String(raw.dropLast(9))
    }
}

/// Energy and cost for a set of records.
///
/// Energy is a modeled estimate with a wide band; cost is exact arithmetic on
/// published rates. The UI leads with cost and relative comparisons for that
/// reason.
struct Estimator: Sendable {
    let energy: EnergyModel
    let pricing: PricingModel
    private let prices: [String: PricingModel.Price]
    // O(1) lookups, built once. The equivalents on EnergyModel rebuild a
    // dictionary or linear-scan on every call, and these run once per record in
    // every aggregation pass — with ~23k records and several passes per Insights
    // render, that was ~100k dictionary rebuilds and the bulk of a multi-second
    // stall. Behaviour is identical; only the cost changed.
    private let tierByModel: [String: TierCoefficients]
    private let entryByModel: [String: EnergyModel.ModelEntry]

    /// User-overridable. Cache reads are ~95% of local token volume, so this
    /// single coefficient swings the total by ~4.6x across its plausible range
    /// — the dominant uncertainty in the whole model, and the reason it is a
    /// slider rather than a buried constant.
    var cacheReadFactorOverride: Double?

    init(energy: EnergyModel, pricing: PricingModel) {
        self.energy = energy
        self.pricing = pricing
        self.prices = pricing.allPrices
        var tiers: [String: TierCoefficients] = [:]
        var entries: [String: EnergyModel.ModelEntry] = [:]
        for m in energy.models {
            entries[m.id] = m
            if let t = energy.tiers[m.tier] { tiers[m.id] = t }
        }
        self.tierByModel = tiers
        self.entryByModel = entries
    }

    /// Whether this model can be both priced and costed in energy.
    ///
    /// Cache terms count. `cost` needs them as much as it needs a rate, and
    /// without this check a provider whose terms were never added would return
    /// nil from `cost`, get coerced to zero by every aggregating caller, and
    /// never reach the unrecognized-model banner — the exact silent-zeroing
    /// failure `Resources/README.md` forbids.
    func hasCoefficients(for model: String) -> Bool {
        guard let price = prices[model] else { return false }
        return price.cache != nil || pricing.cacheMultipliers(for: price.provider) != nil
    }

    /// Whether an energy figure can honestly be produced for this model.
    ///
    /// Deliberately separate from pricing. A model can be priced exactly and
    /// still have no defensible energy basis, which is the case for every
    /// non-Anthropic model here: the tier is inferred from price, and price does
    /// not track compute across vendors. `gpt-5-codex` lists below
    /// `claude-opus-4-5` despite being a flagship, and DeepSeek measures around
    /// 8x GPT-4o per query while listing about 10x cheaper. The sign is wrong,
    /// not just the magnitude, so those models carry `basis: "withheld"` and get
    /// a dash rather than a number.
    ///
    /// Conflating the two is what the old single check did, and it would have
    /// put withheld-energy models into the "no coefficients, counted as ZERO"
    /// banner, which is false: their dollars are exact.
    func hasEnergyBasis(for model: String) -> Bool {
        guard let entry = entryByModel[model], entry.basis != "withheld" else { return false }
        return tierByModel[model] != nil
    }

    /// Model metadata (tier, confidence) — O(1), cached.
    func entry(for model: String) -> EnergyModel.ModelEntry? { entryByModel[model] }

    /// Watt-hours at the given band edge. `nil` when the model is unrecognized
    /// — callers must surface that rather than coercing it to zero.
    func wattHours(_ r: UsageRecord, at edge: Band.Edge = .v) -> Double? {
        guard hasEnergyBasis(for: r.model), let t = tierByModel[r.model] else { return nil }
        let eIn = t.whPer1kInput.at(edge)
        let eOut = t.whPer1kOutput.at(edge)
        let readFactor = cacheReadFactorOverride ?? energy.defaults.cacheReadFactor.at(edge)
        let writeFactor = energy.defaults.cacheWriteFactor.at(edge)

        return (Double(r.input) * eIn
                + Double(r.cacheWrite) * eIn * writeFactor
                + Double(r.cacheRead) * eIn * readFactor
                + Double(r.output) * eOut) / 1000.0
    }

    /// USD from published per-MTok rates.
    ///
    /// Cache terms key off the *model's* vendor, not the record's, and fall back
    /// to that vendor's default only when the model states no terms of its own.
    /// OpenAI bills nothing for a cache write where Anthropic charges up to 2x,
    /// and OpenAI is not even internally consistent — GPT-5.6 introduced a write
    /// charge its predecessors did not have. Keying off the model makes a
    /// record whose model was swapped without its provider price correctly
    /// anyway, rather than relying on every call site to keep the two in step.
    func cost(_ r: UsageRecord) -> Double? {
        guard let p = prices[r.model],
              let m = p.cache ?? pricing.cacheMultipliers(for: p.provider) else { return nil }
        let promptTokens = r.input + r.cacheWrite + r.cacheRead
        let long = p.longContext.flatMap { promptTokens > $0.threshold ? $0 : nil }
        let inputScale = long?.input ?? 1.0
        let cacheScale = long?.cache ?? 1.0
        let outputScale = long?.output ?? 1.0
        // Split the write by TTL when the breakdown is present: the 1h premium
        // is 2x vs the 5m 1.25x, and Claude Code leans on 1h caching.
        let write: Double
        if r.cacheWrite5m + r.cacheWrite1h == 0 {
            write = Double(r.cacheWrite) * m.write5m
        } else {
            write = Double(r.cacheWrite5m) * m.write5m + Double(r.cacheWrite1h) * m.write1h
        }
        return (Double(r.input) * p.input * inputScale
                + write * p.input * cacheScale
                + Double(r.cacheRead) * p.input * m.read * cacheScale
                + Double(r.output) * p.output * outputScale) / 1_000_000.0
    }

    /// Replay the same token counts under a different model.
    ///
    /// An **upper bound** on savings: it holds turn count fixed, and a smaller
    /// model may need more turns to reach the same result. Never present the
    /// result as free.
    /// Swapping the model is enough: `cost` resolves cache terms from the
    /// substitute model's own vendor, so a cross-vendor replay already picks up
    /// the right contract without the record's `provider` being touched.
    func counterfactual(_ records: [UsageRecord], as model: String) -> (wh: Double, usd: Double) {
        var wh = 0.0, usd = 0.0
        for r in records {
            var alt = r
            alt.model = model
            wh += wattHours(alt) ?? 0
            usd += cost(alt) ?? 0
        }
        return (wh, usd)
    }
}
