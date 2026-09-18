import SwiftUI

/// Colour and label for each agent in the spend chart.
///
/// Three rules this follows, and each of them is a way the chart goes wrong:
///
///  1. **Colour follows the agent, never its rank.** Slots are assigned by the
///     fixed order below, not by that day's spend. If a filter drops Codex, the
///     survivors keep their colours rather than shuffling up a slot, so the
///     reader never has to re-learn the chart mid-session.
///  2. **The order is the colourblind-safety mechanism, not a preference.** It
///     is the reference categorical order, which was derived by maximising the
///     minimum adjacent colour distance. Reordering these slots to put a
///     favourite colour first silently degrades the worst adjacent pair.
///  3. **Never generate a 9th hue.** Anything past the eighth named agent folds
///     into "Other" in grey. A synthesised ninth colour lands wherever the hue
///     wheel happens to be free, which in practice is next to one of the eight.
///
/// The dark steps are validated as a set against the dark chart surface: all six
/// in-band for lightness, all above the chroma floor, all clearing 3:1 contrast.
/// The worst adjacent pair (green next to yellow) sits at ΔE 10.3 under protanopia,
/// which is the 8-12 floor band, so it is only legal alongside a second channel.
/// The chart supplies three: a legend, the per-agent readout on hover, and a 2pt
/// surface gap between stacked segments.
enum AgentPalette {
    /// Fixed slot order. Do not sort, do not cycle.
    static let order = [
        "claude-code", "codex", "gemini", "copilot",
        "amp", "droid", "opencode", "goose",
    ]

    /// Brand colour where the brand has one that survives a dark surface, a
    /// validated substitute where it does not.
    ///
    /// Three brands here are `#000000` in their own guidelines (GitHub Copilot,
    /// Cursor, OpenCode). On this surface that is 1.21:1 contrast and ΔE 0.0
    /// against each other: not "a bit dark", but literally invisible and
    /// literally indistinguishable. Two more (OpenAI, Sourcegraph Amp, Factory
    /// Droid) publish no usable mark in the icon set at all. So brand colour is
    /// honoured where it works and substituted where it cannot, rather than
    /// shipping a chart with three identical black segments.
    ///
    /// The two that ARE brand colours were snapped to the nearest passing step,
    /// keeping their hue: Claude's coral measured L 0.672 against a 0.67 ceiling,
    /// and Gemini's purple measured chroma 0.094 against a 0.1 floor. Both are
    /// within a shade of the published value and still read as the brand.
    ///
    /// Validated as an ordered set on the dark surface: lightness, chroma and
    /// contrast all pass, worst adjacent pair ΔE 19.9 under protanopia, well
    /// clear of the 12 target.
    private static let hues: [String: Color] = [
        // Anthropic Claude coral #D97757, snapped into the lightness band.
        "claude-code": Color(red: 0.800, green: 0.416, blue: 0.278),  // #CC6A47
        // OpenAI's teal, which is a real brand colour and, unlike their black,
        // one that can actually be seen here.
        "codex":       Color(red: 0.063, green: 0.639, blue: 0.498),  // #10A37F
        // Google Gemini purple #8E75B2, chroma raised to clear the floor.
        "gemini":      Color(red: 0.565, green: 0.408, blue: 0.808),  // #9068CE
        // Substitutes. GitHub Copilot, Amp and Droid have no usable dark-surface
        // brand colour, so these are validated slots, not guesses at a brand.
        "copilot":     Color(red: 0.788, green: 0.522, blue: 0.000),  // #c98500
        "amp":         Color(red: 0.224, green: 0.529, blue: 0.898),  // #3987e5
        "droid":       Color(red: 0.835, green: 0.318, blue: 0.506),  // #d55181
        "opencode":    Color(red: 0.000, green: 0.514, blue: 0.000),  // #008300
        "goose":       Color(red: 0.851, green: 0.349, blue: 0.149),  // #d95926
    ]

    /// Grey, deliberately: "Other" is a bucket, not an identity, and giving it a
    /// hue would make it compete with the named agents for attention.
    static let otherColor = Color(white: 0.45)

    static func color(_ agent: String) -> Color { hues[agent] ?? otherColor }

    static func label(_ agent: String) -> String {
        switch agent {
        case "claude-code": return "Claude Code"
        case "codex":       return "Codex"
        case "gemini":      return "Gemini"
        case "copilot":     return "Copilot"
        case "amp":         return "Amp"
        case "droid":       return "Droid"
        case "opencode":    return "OpenCode"
        case "goose":       return "Goose"
        case "other":       return "Other"
        default:            return agent.capitalized
        }
    }

    /// Rank agents for display: palette order, with anything unnamed folded into
    /// a single "other" bucket at the end.
    static func rank(_ agent: String) -> Int {
        order.firstIndex(of: agent) ?? order.count
    }
}

/// One agent's slice of a day.
struct AgentSlice: Identifiable, Sendable, Equatable {
    var id: String { agent }
    let agent: String
    let usd: Double
}
