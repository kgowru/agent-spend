import SwiftUI

/// Day-by-day spend. Today's number on its own has no meaning — the useful
/// question is whether today is normal, so the history is the primary view and
/// today is just the top row.
struct TodayView: View {
    @ObservedObject var engine: UsageEngine
    @AppStorage("historyDays") private var days = 1
    @State private var projectsExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if !engine.unrecognizedModels.isEmpty {
                Banner(text: "No price or energy figures yet for "
                       + engine.unrecognizedModels.sorted().joined(separator: ", ")
                       + ", so those requests count as zero.")
            }

            // Selector first: the headline below is the total for whichever
            // window is chosen, so the control has to read as its input. "1d"
            // makes the headline today's spend rather than a period total.
            Picker("", selection: $days) {
                Text("1d").tag(1)
                Text("14d").tag(14); Text("30d").tag(30); Text("90d").tag(90)
            }
            .pickerStyle(.segmented).labelsHidden()

            if days == 1 { todaySection } else { periodSection }
        }
    }

    // MARK: - Today (1d)

    @ViewBuilder
    private var todaySection: some View {
        let start = Calendar.current.startOfDay(for: Date())
        let today = engine.cachedDailySummaries(days: 1).last
        // "Typical" baseline from the trailing 30 days (a 1-day window has no
        // meaningful internal average to compare against). Memoized.
        let baseline = engine.cachedDailySummaries(days: 30).filter { $0.requests > 0 }
        let typical = baseline.isEmpty ? 0
            : baseline.reduce(0) { $0 + $1.usd } / Double(baseline.count)
        let projects = engine.byProject(engine.records(since: start))

        // Traffic-light color for today's spend relative to the 30d average:
        // green while under, yellow as it runs over, red once well past.
        // Uncolored (primary) until there's both a baseline and activity today.
        let overageColor: AnyShapeStyle = {
            guard typical > 0, let t = today, t.requests > 0 else {
                return AnyShapeStyle(.primary)
            }
            let ratio = t.usd / typical
            if ratio < 1.0 { return AnyShapeStyle(.green) }
            if ratio < 1.5 { return AnyShapeStyle(.yellow) }
            return AnyShapeStyle(.red)
        }()

        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Today").font(.caption).foregroundStyle(.secondary)
                Text(Format.usd(today?.usd ?? 0))
                    .font(.system(size: 28, weight: .medium, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(overageColor)
                Text(energyLine(today?.wh ?? 0,
                                partial: engine.energyIsPartial(engine.records(since: start)))
                     + " · \(today?.requests ?? 0) requests")
                    .font(.caption2).foregroundStyle(.secondary)
                Text(Format.homeEnergy(today?.wh ?? 0, engine.energyModel.equivalences))
                    .font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            if typical > 0, let t = today, t.requests > 0 {
                let ratio = t.usd / typical
                // Plain-language comparison instead of a bare "0.2×" multiplier,
                // which readers have to mentally convert. Within ±10% reads as
                // "about normal"; otherwise it's a percentage above/below.
                let pct = Int((abs(ratio - 1) * 100).rounded())
                let phrase = abs(ratio - 1) < 0.1 ? "About normal"
                    : ratio < 1 ? "\(pct)% below normal"
                                : "\(pct)% above normal"
                // Mirror the "Today" column on the left: label, big number,
                // then a smaller detail line underneath.
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Average").font(.caption).foregroundStyle(.secondary)
                    Text(Format.usd(typical))
                        .font(.system(size: 28, weight: .medium, design: .rounded))
                        .monospacedDigit()
                    Text(phrase)
                        .font(.caption2)
                        .foregroundStyle(ratio > 1.5 ? AnyShapeStyle(.orange)
                                                     : AnyShapeStyle(.secondary))
                }
            }
        }


            // What the number actually is. On a flat-rate plan this figure is a
            // list-price equivalent, not money charged, and the gap is large:
            // a fortnight reading $2,272 costs about $50 on Claude Max 5x.
            // Leaving it unqualified is the single biggest overstatement in the
            // app, so it is said plainly rather than buried in the Method pane.
            if let caveat = engine.billing.caveat {
                Text(caveat)
                    .font(.caption2).foregroundStyle(.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }

        if today?.requests ?? 0 == 0 {
            Text("No activity yet today.")
                .font(.caption).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .center).padding(.vertical, 20)
        } else {
            HourlyBars(hours: engine.hourlyActivity(since: start),
                       sidecar: engine.sidecarToday())

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("project today").frame(maxWidth: .infinity, alignment: .leading)
                    Text("cost").frame(width: 58, alignment: .trailing)
                    Text("energy").frame(width: 64, alignment: .trailing)
                }
                .font(.caption2).foregroundStyle(.secondary)
                Divider()
                let shown = projectsExpanded ? projects : Array(projects.prefix(3))
                ForEach(shown, id: \.project) { p in
                    HStack {
                        Text(p.project).lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(Format.usd(p.usd)).frame(width: 58, alignment: .trailing)
                        Text(Format.wh(p.wh)).frame(width: 64, alignment: .trailing)
                            .foregroundStyle(.secondary)
                    }
                    .font(.caption).monospacedDigit()
                }
                if projects.count > 3 {
                    Button(projectsExpanded
                           ? "Show less"
                           : "Show \(projects.count - 3) more") {
                        projectsExpanded.toggle()
                    }
                    .buttonStyle(.borderless)
                    .font(.caption2)
                    .foregroundStyle(.tint)
                    .padding(.top, 2)
                }
            }
        }
    }

    // MARK: - Period (14d / 30d / 90d)

    @ViewBuilder
    private var periodSection: some View {
        let summaries = engine.cachedDailySummaries(days: days)
        let today = summaries.last
        let active = summaries.filter { $0.requests > 0 }
        let avg = active.isEmpty ? 0 : active.reduce(0) { $0 + $1.usd } / Double(active.count)
        let periodUsd = summaries.reduce(0) { $0 + $1.usd }
        let periodWh = summaries.reduce(0) { $0 + $1.wh }
        let windowStart = Calendar.current.startOfDay(for: Date())
            .addingTimeInterval(-Double(days - 1) * 86_400)
        let energyPartial = engine.energyIsPartial(engine.records(since: windowStart))

        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Last \(days) days").font(.caption).foregroundStyle(.secondary)
                Text(Format.usd(periodUsd))
                    .font(.system(size: 28, weight: .medium, design: .rounded))
                    .monospacedDigit()
                Text(energyLine(periodWh, partial: energyPartial)
                     + " · \(Format.count(summaries.reduce(0) { $0 + $1.requests })) requests")
                    .font(.caption2).foregroundStyle(.secondary)
                Text(Format.homeEnergy(periodWh, engine.energyModel.equivalences))
                    .font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("Today").font(.caption).foregroundStyle(.secondary)
                Text(Format.usd(today?.usd ?? 0))
                    .font(.system(size: 28, weight: .medium, design: .rounded))
                    .monospacedDigit()
                if avg > 0, let t = today {
                    let ratio = t.usd / avg
                    Text(String(format: "%.1f× the %@ avg", ratio, "\(days)d"))
                        .font(.caption2)
                        .foregroundStyle(ratio > 1.5 ? AnyShapeStyle(.orange)
                                                     : AnyShapeStyle(.tertiary))
                }
            }
        }


            // What the number actually is. On a flat-rate plan this figure is a
            // list-price equivalent, not money charged, and the gap is large:
            // a fortnight reading $2,272 costs about $50 on Claude Max 5x.
            // Leaving it unqualified is the single biggest overstatement in the
            // app, so it is said plainly rather than buried in the Method pane.
            if let caveat = engine.billing.caveat {
                Text(caveat)
                    .font(.caption2).foregroundStyle(.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }

                DailyBars(summaries: summaries)

        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("day").frame(maxWidth: .infinity, alignment: .leading)
                Text("cost").frame(width: 58, alignment: .trailing)
                Text("energy").frame(width: 64, alignment: .trailing)
                Text("reqs").frame(width: 40, alignment: .trailing)
            }
            .font(.caption2).foregroundStyle(.secondary)
            Divider()

            // Newest first — the recent days are the ones you act on.
            ForEach(summaries.reversed().filter { $0.requests > 0 }) { d in
                HStack {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(dayLabel(d.day))
                        if let p = d.topProject {
                            Text(p).font(.caption2).foregroundStyle(.tertiary).lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Text(Format.usd(d.usd)).frame(width: 58, alignment: .trailing)
                    Text(Format.wh(d.wh)).frame(width: 64, alignment: .trailing)
                        .foregroundStyle(.secondary)
                    Text("\(d.requests)").frame(width: 40, alignment: .trailing)
                        .foregroundStyle(.secondary)
                }
                .font(.caption).monospacedDigit()
            }
        }

        Divider()

        HStack {
            Text("\(active.count) active day\(active.count == 1 ? "" : "s")")
                .font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text("\(Format.usd(avg)) · \(Format.wh(periodWh / Double(max(active.count, 1)))) per active day")
                .font(.caption).monospacedDigit().foregroundStyle(.secondary)
        }
    }

    /// The energy figure, said honestly.
    ///
    /// Energy is withheld for models whose tier would be a price guess, so a
    /// total across a mixed set covers only the Anthropic part. Summing a subset
    /// and printing it bare would read as the whole, which is the exact
    /// silent-partial-number failure this app exists to argue against.
    private func energyLine(_ wh: Double, partial: Bool) -> String {
        partial ? "\(Format.wh(wh)) (Claude Code only)" : Format.wh(wh)
    }

    private func dayLabel(_ d: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(d) { return "Today" }
        if cal.isDateInYesterday(d) { return "Yesterday" }
        return d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }
}

/// Daily cost bars, stacked by agent.
///
/// Colour carries agent identity, which forces two changes from the old
/// single-series chart:
///
///  - **Today is no longer tinted orange.** Orange is a palette slot now, so
///    using it for recency would make one Tuesday look like a different tool.
///    Today is marked with a dot under its bar instead, which is a channel
///    nothing else is using.
///  - **Segments are ordered by the palette, not by that day's size.** A stack
///    that re-sorted per day would put a different agent at the same height on
///    adjacent bars, which is precisely the comparison the eye tries to make.
///
/// Hovering a bar reads out that day's per-agent split; the rest dim so the
/// focus is clear. The legend and the readout are what make the chart legible
/// without relying on colour alone.
struct DailyBars: View {
    let summaries: [UsageEngine.DaySummary]
    @State private var hovered: UsageEngine.DaySummary.ID?

    /// Agents present anywhere in the window, in palette order. Driven by the
    /// window rather than the hovered day so the legend does not reflow as the
    /// pointer moves across the chart.
    /// Gap between day slots, shared by the bars and the today-marker row so the
    /// two stay aligned. Narrows on long windows: at 90 days a 2pt gap spends
    /// 178pt of the 396pt available on whitespace, leaving each bar thinner than
    /// the space beside it.
    private var slotGap: CGFloat { summaries.count > 45 ? 1 : 2 }

    private var present: [String] {
        var seen = Set<String>()
        for d in summaries { for s in d.slices where s.usd > 0 { seen.insert(s.agent) } }
        return seen.sorted { AgentPalette.rank($0) < AgentPalette.rank($1) }
    }

    /// Render-only: forces a hovered bar so `--render` can capture the hover
    /// state, which is otherwise unreachable in a static snapshot and is the
    /// half of this chart that actually answers "how much was Gemini". Counted
    /// from the end, so 0 is today. Unset in every normal launch.
    private var previewHover: Int? {
        ProcessInfo.processInfo.environment["AGENTSPEND_PREVIEW_HOVER"].flatMap(Int.init)
    }

    var body: some View {
        let maxV = summaries.map(\.usd).max() ?? 0
        let previewed = previewHover
            .map { summaries.count - 1 - $0 }
            .flatMap { summaries.indices.contains($0) ? summaries[$0].id : nil }
        let active = hovered ?? previewed
        let focus = summaries.first { $0.id == active }

        VStack(alignment: .leading, spacing: 3) {
            // Readout line. Reserves its own height so the layout does not jump
            // as the hover moves on and off the chart.
            Group {
                if let d = focus {
                    Text(label(d.day)).foregroundStyle(.primary)
                    + Text("  \(Format.usd(d.usd)) · \(Format.wh(d.wh)) · "
                           + "\(Format.count(d.requests)) req").foregroundStyle(.secondary)
                } else {
                    // Deliberately blank rather than a prompt. The line exists to
                    // reserve height so the chart does not jump when the pointer
                    // arrives; telling people to hover is instruction the chart
                    // should not need, and it sat there on every pane load.
                    Text(" ")
                }
            }
            .font(.caption2).monospacedDigit().lineLimit(1)

            HStack(alignment: .bottom, spacing: slotGap) {
                ForEach(summaries) { d in
                    // Full-height, full-slot hover target so the thin bars and
                    // the gaps between them are all easy to land on.
                    ZStack(alignment: .bottom) {
                        Color.clear
                        bar(for: d, maxV: maxV, active: active)
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .onHover { inside in
                        // On exit, only clear if this bar was the focused one, or
                        // moving between adjacent bars would flicker.
                        if inside { hovered = d.id }
                        else if hovered == d.id { hovered = nil }
                    }
                    .help(tooltip(d))
                }
            }
            .frame(height: 54)

            // Today marker. A dot rather than a colour, because every colour is
            // spoken for by an agent.
            //
            // The dot is an OVERLAY on a zero-minimum cell, not a sized view in
            // the row. `Circle().frame(width: 3)` inside the stack is a hard
            // minimum that cannot compress, so at 90 days it demanded
            // 90*3 + 89*2 = 448pt against the 396pt the panel has and pushed the
            // whole pane wider than its own window, clipping the headline on
            // both sides. The bars row above never had that problem because its
            // cells are `Color.clear` with only a height, which is exactly what
            // this mirrors. An overlay is sized by its parent and contributes no
            // width of its own.
            HStack(alignment: .top, spacing: slotGap) {
                ForEach(summaries) { d in
                    Color.clear
                        .frame(height: 3)
                        .frame(maxWidth: .infinity)
                        .overlay {
                            if Calendar.current.isDateInToday(d.day) {
                                Circle().fill(Color.secondary).frame(width: 3, height: 3)
                            }
                        }
                }
            }
            .frame(height: 3)

            HStack {
                Text(summaries.first.map { $0.day.formatted(.dateTime.month(.abbreviated).day()) } ?? "")
                Spacer()
                if maxV > 0 { Text("peak \(Format.usd(maxV))") }
            }
            .font(.caption2).foregroundStyle(.tertiary)

            // The per-agent split when hovering, the legend otherwise. Same slot,
            // so the chart never grows or shrinks under the pointer.
            Group {
                if let d = focus, !d.slices.isEmpty {
                    breakdown(d)
                } else {
                    legend
                }
            }
            .frame(height: 14, alignment: .leading)
        }
    }

    /// One day's stack. Segments are drawn top-down so the rounded cap lands on
    /// the topmost one and the baseline stays square, and a 2pt surface gap
    /// separates them, which is the secondary channel the palette's adjacent
    /// pairs need.
    @ViewBuilder
    private func bar(for d: UsageEngine.DaySummary, maxV: Double,
                     active: UsageEngine.DaySummary.ID?) -> some View {
        let h = maxV == 0 ? 2 : max(2, 54 * d.usd / maxV)
        if d.slices.isEmpty {
            RoundedRectangle(cornerRadius: 1)
                .fill(Color.secondary).opacity(0.12).frame(height: 2)
        } else {
            // The separator is a 1pt gap, and only on bars tall enough to spare
            // it. At 54pt full scale a six-segment stack would otherwise spend
            // 10pt of a short bar on gaps, so a quiet day would read as mostly
            // background with a few floating chips. Below the threshold the
            // colour boundary alone does the separating, which is what the
            // legend and hover readout are there to back up.
            let gap: CGFloat = h >= 18 ? 1 : 0
            let usable = h - gap * CGFloat(max(0, d.slices.count - 1))
            VStack(spacing: gap) {
                ForEach(d.slices.reversed()) { s in
                    AgentPalette.color(s.agent)
                        // 1.5pt floor: a segment worth a few cents still has to
                        // be visible, or the stack quietly stops adding up to
                        // the number printed above it.
                        .frame(height: max(1.5, usable * (s.usd / max(d.usd, 0.0001))))
                }
            }
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 2, topTrailingRadius: 2))
            .opacity(active == nil || active == d.id ? 1.0 : 0.3)
        }
    }

    private var legend: some View {
        HStack(spacing: 8) {
            ForEach(present, id: \.self) { a in
                HStack(spacing: 3) {
                    AgentMark(agent: a, size: 9)
                    // Text stays in ink, never the series colour: the mark
                    // beside it already carries identity, and coloured labels
                    // read as emphasis the data does not mean.
                    Text(AgentPalette.label(a)).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .font(.caption2).lineLimit(1)
    }

    private func breakdown(_ d: UsageEngine.DaySummary) -> some View {
        HStack(spacing: 8) {
            ForEach(d.slices) { s in
                HStack(spacing: 3) {
                    AgentMark(agent: s.agent, size: 9)
                    Text(AgentPalette.label(s.agent)).foregroundStyle(.secondary)
                    Text(Format.usd(s.usd)).foregroundStyle(.primary).monospacedDigit()
                }
            }
            Spacer(minLength: 0)
        }
        .font(.caption2).lineLimit(1)
    }

    private func tooltip(_ d: UsageEngine.DaySummary) -> String {
        let head = "\(label(d.day)): \(Format.usd(d.usd)) · \(Format.wh(d.wh))"
        guard !d.slices.isEmpty else { return head }
        return head + "\n" + d.slices
            .map { "  \(AgentPalette.label($0.agent))  \(Format.usd($0.usd))" }
            .joined(separator: "\n")
    }

    private func label(_ d: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(d) { return "Today" }
        if cal.isDateInYesterday(d) { return "Yesterday" }
        return d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }
}
