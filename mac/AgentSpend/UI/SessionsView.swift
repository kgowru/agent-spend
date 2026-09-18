import SwiftUI

/// What's actually running: recent sessions, what they cost, and when the day's
/// work happened. This is the "where did that number come from" view.
struct SessionsView: View {
    @ObservedObject var engine: UsageEngine
    // Key kept as-is through the rename — changing it would silently reset the
    // scope on every install that had already chosen one.
    @AppStorage("activityScope") private var scopeDays = 1

    var body: some View {
        let since = Calendar.current.startOfDay(for: Date())
            .addingTimeInterval(-Double(scopeDays - 1) * 86_400)
        let sessions = engine.recentSessions(limit: 15, since: since)
        let hours = engine.hourlyActivity(since: since)

        VStack(alignment: .leading, spacing: 14) {
            Picker("", selection: $scopeDays) {
                Text("Today").tag(1); Text("3 days").tag(3); Text("7 days").tag(7)
            }
            .pickerStyle(.segmented).labelsHidden()

            if sessions.isEmpty {
                Text("No activity in this window.")
                    .font(.caption).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 24)
            } else {
                if scopeDays == 1 { HourlyBars(hours: hours) }

                // Flag long context relative to this user's own baseline. An
                // absolute threshold fired on nearly every row here, which makes
                // it decoration rather than a signal.
                let contexts = sessions.map(\.avgContextTokens).sorted()
                let median = contexts[contexts.count / 2]
                let longThreshold = max(150_000, Int(Double(median) * 1.8))

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Sessions, most recent first")
                        Spacer()
                        Text("median context \(Format.tokens(median))")
                            .foregroundStyle(.tertiary)
                    }
                    .font(.caption).foregroundStyle(.secondary)

                    ForEach(sessions) { s in
                        SessionRow(session: s, longThreshold: longThreshold)
                        if s.id != sessions.last?.id { Divider() }
                    }
                }
            }
        }
    }
}

struct SessionRow: View {
    let session: UsageEngine.SessionSummary
    /// Relative to the user's own median, so the flag marks outliers rather
    /// than firing on every row.
    let longThreshold: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline) {
                Text(session.project).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(Format.usd(session.usd)).monospacedDigit()
                Text(Format.wh(session.wh)).foregroundStyle(.secondary)
                    .frame(width: 62, alignment: .trailing)
            }
            .font(.caption)

            HStack(spacing: 5) {
                Text(session.lastActivity.formatted(date: .omitted, time: .shortened))
                if let b = session.branch {
                    Text("·"); Text(b).lineLimit(1)
                }
                Text("·"); Text(session.models.first.map(short) ?? "—")
                if session.models.count > 1 { Text("+\(session.models.count - 1)") }
                Text("·"); Text("\(session.requests) req")
                if session.subagentRequests > 0 {
                    Text("· \(session.subagentRequests) subagent")
                }
            }
            .font(.caption2).foregroundStyle(.secondary).lineLimit(1)

            // Long context is where cost runs away superlinearly, so outliers
            // are worth calling out on the row rather than leaving to inference.
            if session.avgContextTokens > longThreshold {
                Text("avg context \(Format.tokens(session.avgContextTokens)) — "
                     + "well above your median")
                    .font(.caption2).foregroundStyle(.orange)
            }
        }
    }

    private func short(_ m: String) -> String { Format.model(m) }
}

/// When today's work happened. Hovering an hour reads out that hour's spend.
struct HourlyBars: View {
    let hours: [(hour: Int, requests: Int, usd: Double, slices: [AgentSlice])]
    /// Today's sidecar spend. Shown as its own line rather than folded into the
    /// bars: these agents report a day at a time with no timestamps, so placing
    /// them in an hour would be inventing detail the data does not contain.
    var sidecar: [AgentSlice] = []
    @State private var hovered: Int?

    private var present: [String] {
        var seen = Set<String>()
        for h in hours { for s in h.slices where s.usd > 0 { seen.insert(s.agent) } }
        return seen.sorted { AgentPalette.rank($0) < AgentPalette.rank($1) }
    }

    var body: some View {
        let maxV = hours.map(\.usd).max() ?? 0
        let focus = hours.first { $0.hour == hovered }

        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text("By hour").foregroundStyle(.secondary)
                Spacer()
                if let h = focus, h.requests > 0 {
                    Text(String(format: "%02d:00", h.hour)).foregroundStyle(.primary)
                    + Text("  \(Format.usd(h.usd)) · \(Format.count(h.requests)) req")
                        .foregroundStyle(.secondary)
                }
            }
            .font(.caption2).monospacedDigit().lineLimit(1)

            HStack(alignment: .bottom, spacing: 1) {
                ForEach(hours, id: \.hour) { h in
                    ZStack(alignment: .bottom) {
                        Color.clear
                        bar(h, maxV: maxV)
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .onHover { inside in
                        if inside { hovered = h.hour }
                        else if hovered == h.hour { hovered = nil }
                    }
                    .help(tooltip(h))
                }
            }
            .frame(height: 34)
            HStack {
                Text("00"); Spacer(); Text("12"); Spacer(); Text("23")
            }
            .font(.caption2).foregroundStyle(.tertiary)

            // The hovered hour's split, the legend otherwise. Same slot either
            // way so the pane does not resize under the pointer.
            Group {
                if let h = focus, !h.slices.isEmpty {
                    marks(h.slices, showValues: true)
                } else if !present.isEmpty {
                    marks(present.map { AgentSlice(agent: $0, usd: 0) }, showValues: false)
                }
            }
            .frame(height: 14, alignment: .leading)

            if !sidecar.isEmpty {
                HStack(spacing: 6) {
                    ForEach(sidecar) { s in
                        HStack(spacing: 3) {
                            AgentMark(agent: s.agent, size: 9)
                            Text(Format.usd(s.usd)).monospacedDigit().foregroundStyle(.primary)
                        }
                    }
                    Text("today, no hourly detail").foregroundStyle(.tertiary)
                    Spacer(minLength: 0)
                }
                .font(.caption2).lineLimit(1)
            }
        }
    }

    @ViewBuilder
    private func bar(_ h: (hour: Int, requests: Int, usd: Double, slices: [AgentSlice]),
                     maxV: Double) -> some View {
        let height = maxV == 0 ? 2 : max(2, 34 * h.usd / maxV)
        if h.slices.isEmpty {
            RoundedRectangle(cornerRadius: 1)
                .fill(Color.secondary).opacity(0.12).frame(height: 2)
        } else {
            // No gap between segments here. At 34pt tall and 24 bars wide these
            // are a couple of points across, and a separator would eat the
            // segment rather than separate it.
            VStack(spacing: 0) {
                ForEach(h.slices.reversed()) { s in
                    AgentPalette.color(s.agent)
                        .frame(height: max(1, height * (s.usd / max(h.usd, 0.0001))))
                }
            }
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 1.5, topTrailingRadius: 1.5))
            .opacity(hovered == nil || hovered == h.hour ? 1.0 : 0.35)
        }
    }

    private func marks(_ slices: [AgentSlice], showValues: Bool) -> some View {
        HStack(spacing: 8) {
            ForEach(slices) { s in
                HStack(spacing: 3) {
                    AgentMark(agent: s.agent, size: 9)
                    Text(AgentPalette.label(s.agent)).foregroundStyle(.secondary)
                    if showValues {
                        Text(Format.usd(s.usd)).foregroundStyle(.primary).monospacedDigit()
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .font(.caption2).lineLimit(1)
    }

    private func tooltip(_ h: (hour: Int, requests: Int, usd: Double, slices: [AgentSlice])) -> String {
        let head = String(format: "%02d:00 — %@ · %d req", h.hour, Format.usd(h.usd), h.requests)
        guard !h.slices.isEmpty else { return head }
        return head + "\n" + h.slices
            .map { "  \(AgentPalette.label($0.agent))  \(Format.usd($0.usd))" }
            .joined(separator: "\n")
    }
}
