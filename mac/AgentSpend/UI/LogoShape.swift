import SwiftUI

/// Draws one of the generated agent logos, scaled to fit its frame.
///
/// The reader handles only absolute `M`, `L`, `C` and `Z`, because
/// `tools/build-agent-logos.py` has already flattened every arc, smooth curve
/// and quadratic into those four. That is the whole point of normalising
/// upstream: arc-to-bezier is the one piece of SVG path maths that is easy to
/// get subtly wrong, and a wrong logo renders as plausible-looking garbage
/// rather than failing loudly.
struct LogoShape: Shape {
    let data: String

    func path(in rect: CGRect) -> Path {
        var p = Path()
        var nums: [CGFloat] = []
        var cmd: Character = "M"

        // Simple Icons draw on a 24x24 grid. Fit that into the frame, preserving
        // aspect so a non-square slot does not stretch someone's trademark.
        let s = min(rect.width, rect.height) / 24.0
        let dx = rect.minX + (rect.width - 24 * s) / 2
        let dy = rect.minY + (rect.height - 24 * s) / 2
        func pt(_ i: Int) -> CGPoint {
            CGPoint(x: dx + nums[i] * s, y: dy + nums[i + 1] * s)
        }

        func flush() {
            switch cmd {
            case "M":
                // A repeated coordinate pair after an M is an implicit lineTo,
                // which the generator already expands, so this only ever sees one.
                if nums.count >= 2 { p.move(to: pt(0)) }
            case "L":
                if nums.count >= 2 { p.addLine(to: pt(0)) }
            case "C":
                if nums.count >= 6 {
                    p.addCurve(to: pt(4), control1: pt(0), control2: pt(2))
                }
            default:
                break
            }
            nums.removeAll(keepingCapacity: true)
        }

        var i = data.startIndex
        while i < data.endIndex {
            let ch = data[i]
            if ch.isLetter {
                flush()
                cmd = ch
                if ch == "Z" || ch == "z" { p.closeSubpath() }
                i = data.index(after: i)
            } else if ch == " " || ch == "," {
                i = data.index(after: i)
            } else {
                var j = i
                while j < data.endIndex, !data[j].isLetter, data[j] != " ", data[j] != "," {
                    j = data.index(after: j)
                }
                nums.append(CGFloat(Double(data[i..<j]) ?? 0))
                i = j
            }
        }
        flush()
        return p
    }
}

/// An agent's mark at a given size: its logo where one exists, a lettermark
/// where none does.
///
/// The fallback is deliberate rather than a placeholder. OpenAI ships no glyph
/// in the icon set this is generated from, and Goose, Droid and Grok have none
/// either, so inventing something logo-shaped for them would put a mark on the
/// screen that the vendor never made. A letter in the agent's own colour is
/// honest about being our label, not their brand.
struct AgentMark: View {
    let agent: String
    var size: CGFloat = 9

    var body: some View {
        Group {
            if let d = AgentLogos.paths[agent] {
                LogoShape(data: d).fill(AgentPalette.color(agent))
            } else {
                Text(AgentPalette.label(agent).prefix(1))
                    .font(.system(size: size * 0.78, weight: .bold, design: .rounded))
                    .foregroundStyle(AgentPalette.color(agent))
                    .frame(width: size, height: size)
            }
        }
        .frame(width: size, height: size)
        // The logo IS the identity channel here, so it needs a name for anyone
        // not reading it visually.
        .accessibilityLabel(AgentPalette.label(agent))
    }
}
