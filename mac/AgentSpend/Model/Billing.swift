import Foundation

/// How the tokens you spent are actually paid for.
///
/// This exists because the app's most prominent number was mislabelled. Every
/// figure here is computed from published per-token rates, which is exactly
/// right for comparing one model against another, and is *not* a bill if you
/// are on a flat-rate plan. On a Claude Max 5x subscription at $100/month, a
/// fortnight that reads "$2,272" cost you about $50. Calling that "spend"
/// without qualification overstates it by more than an order of magnitude.
///
/// Read from Claude Code's own config rather than asked for: `~/.claude.json`
/// already knows, and making the user tell the app something it can see would
/// be a worse experience and a worse default.
///
/// Exactly four keys are read, all from `oauthAccount`, and none is stored,
/// logged, or transmitted. The file also holds an email address and an
/// organization id; those are never touched. The Method pane says so.
struct Billing: Sendable, Equatable {
    enum Plan: Sendable, Equatable {
        /// Flat-rate subscription. The dollar figure is a list-price equivalent.
        case subscription(name: String)
        /// Billed per token. The dollar figure is what you were charged.
        case payPerToken
        /// No config found, or a shape this does not recognise.
        case unknown
    }

    var plan: Plan = .unknown
    /// Paying overage on top of a subscription, so *some* of this is real money.
    var hasExtraUsage = false

    /// What to call the headline figure.
    var headlineNoun: String {
        switch plan {
        case .subscription: return "List price"
        case .payPerToken:  return "Spend"
        case .unknown:      return "Spend"
        }
    }

    /// The qualifier that goes under the headline. `nil` when the number really
    /// is money charged, so the honest case stays uncluttered.
    var caveat: String? {
        switch plan {
        case .subscription(let name):
            // Self-contained sentences. An earlier draft opened with "at API
            // rates", continuing the headline, but two lines sit between the two
            // on screen and it read as a fragment.
            return hasExtraUsage
                ? "List price, not your bill. You are on \(name) with extra usage on, so some of this was charged and the rest was included."
                : "List price, not your bill. You are on \(name), which is flat rate."
        case .payPerToken, .unknown:
            return nil
        }
    }

    var isSubscription: Bool {
        if case .subscription = plan { return true }
        return false
    }

    // MARK: - Detection

    /// Claude Code's rate-limit tiers, as they appear in `~/.claude.json`.
    ///
    /// Matched on a prefix rather than exactly: Anthropic appends qualifiers to
    /// these strings, and a tier we half-recognise should still be reported as a
    /// subscription rather than falling through to "this is a bill", which is
    /// the reading that overstates the number.
    private static let tiers: [(prefix: String, name: String)] = [
        ("default_claude_max_20x", "Claude Max 20x"),
        ("default_claude_max_5x",  "Claude Max 5x"),
        ("default_claude_max",     "Claude Max"),
        ("default_claude_pro",     "Claude Pro"),
        ("default_team",           "Claude Team"),
        ("default_enterprise",     "Claude Enterprise"),
    ]

    static func detect(configPath: URL? = nil) -> Billing {
        let url = configPath ?? URL(fileURLWithPath: NSHomeDirectory())
            .appending(path: ".claude.json")
        guard let data = try? Data(contentsOf: url),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let account = root["oauthAccount"] as? [String: Any]
        else { return Billing() }

        var out = Billing()
        out.hasExtraUsage = account["hasExtraUsageEnabled"] as? Bool ?? false

        let tier = account["userRateLimitTier"] as? String ?? ""
        if let match = tiers.first(where: { tier.hasPrefix($0.prefix) }) {
            out.plan = .subscription(name: match.name)
        } else if account["billingType"] as? String == "stripe_subscription" {
            // A subscription whose tier string is new to us. Still flat rate,
            // so still not a bill; just unnamed.
            out.plan = .subscription(name: "a subscription")
        } else if !tier.isEmpty || account["billingType"] != nil {
            out.plan = .payPerToken
        }
        return out
    }
}
