import SwiftUI

/// Which build this is.
///
/// Keyed off the bundle identifier rather than a compile flag, because the thing
/// that actually needs distinguishing is two *installed copies* running side by
/// side, and `dev.sh` is what gives the dev copy its own id. `#if DEBUG` would be
/// the wrong test: a debug build installed over the release id would still need
/// telling apart, and a release-config dev build would still be the dev one.
enum AppBuild {
    static let isDev = (Bundle.main.bundleIdentifier ?? "").hasSuffix(".dev")

    /// True while `--render` is driving the view tree offscreen.
    ///
    /// The renderer sets `historyDays` itself to capture one image per window,
    /// so anything that resets that key on appear has to stand down or every
    /// snapshot comes out as the same day.
    static let isSnapshotting = CommandLine.arguments.contains("--render")
}

/// Marks the popover as the dev copy.
///
/// Neutral ink on a faint fill, deliberately: every hue in this app now names a
/// specific agent, so a badge wearing one would read as data. This is chrome, so
/// it uses the same `Color.primary.opacity` treatment as the other chips.
struct DevBadge: View {
    var body: some View {
        Text("DEV")
            .font(.system(size: 9, weight: .bold, design: .rounded))
            .kerning(0.4)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 5)
            .padding(.vertical, 1.5)
            .background(Color.primary.opacity(0.10), in: Capsule())
            .overlay(Capsule().strokeBorder(Color.primary.opacity(0.10), lineWidth: 0.5))
            .accessibilityLabel("Development build")
    }
}

struct RootView: View {
    @ObservedObject var engine: UsageEngine
    @State private var tab: Tab
    /// Shared with `TodayView`. Held here too so the panel can reset it on open.
    @AppStorage("historyDays") private var days = 1

    /// `initialTab` lets the renderer snapshot each pane. Otherwise `--tab X`
    /// opens straight to one, which a screenshot can reach without needing
    /// accessibility permission to click.
    init(engine: UsageEngine, initialTab: Tab? = nil) {
        self.engine = engine
        let args = CommandLine.arguments
        let fromArgs = args.firstIndex(of: "--tab").flatMap { i -> Tab? in
            guard args.count > i + 1 else { return nil }
            return Tab(rawValue: args[i + 1].capitalized)
        }
        _tab = State(initialValue: initialTab ?? fromArgs ?? .home)
    }

    enum Tab: String, CaseIterable, Identifiable {
        case home = "Home", sessions = "Sessions", savings = "Savings", method = "Method"
        var id: String { rawValue }

        /// Method is reached from the footer instead. It's reference material
        /// you read once, not a pane you live in.
        static let segments: [Tab] = [.home, .sessions, .savings]
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $tab) {
                ForEach(Tab.segments) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .padding(10)
            // `maxWidth: .infinity` BEFORE the overlay, and it is load-bearing.
            // A segmented picker sizes to its content, so without this the
            // overlay anchors to the control's own trailing edge and the badge
            // lands on top of the "Savings" tab. Widening to the panel first
            // gives the overlay the full width to pin against.
            .frame(maxWidth: .infinity)
            // Overlaid rather than placed in the row: an HStack beside the
            // picker would push the tabs off-centre on the dev copy, so the two
            // builds would lay out differently. An overlay leaves the geometry
            // identical, which is the point of a build marker.
            .overlay(alignment: .topTrailing) {
                if AppBuild.isDev {
                    DevBadge().padding(.top, 9).padding(.trailing, 10)
                }
            }

            Divider()

            ScrollView {
                Group {
                    switch tab {
                    case .home:     HomeView(engine: engine) { tab = .savings }
                    case .sessions: SessionsView(engine: engine)
                    case .savings:  InsightsView(engine: engine)
                    case .method:   MethodologyView(engine: engine)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
            }
            // Fills whatever the definite outer frame leaves over. Safe only
            // because that outer frame is concrete — see below.
            .frame(maxHeight: .infinity)

            Divider()
            FooterView(engine: engine, tab: $tab)
        }
        // A fully definite size, both axes. MenuBarExtra's popover proposes its
        // own height during layout, and anything flexible here (a ScrollView
        // under `maxHeight`, say) can resolve that proposal to zero and render
        // an empty popover — which shipped once. A concrete frame can't.
        .frame(width: 420, height: 540)
        // Open on Today, every time.
        //
        // `historyDays` is @AppStorage, so without this the panel reopens on
        // whatever window you last clicked, which is usually not the one you
        // want when you glance at the menu bar. The question a glance asks is
        // "what am I spending right now", and that is the 1d view.
        //
        // Reset on appear rather than just defaulting the stored value: a
        // default only helps the first launch, and MenuBarExtra re-runs onAppear
        // each time the panel opens (the same hook HomeView uses to clear the
        // recommendations badge).
        .onAppear { if !AppBuild.isSnapshotting { days = 1 } }
        .background(
            // Records what the popover was actually laid out at, so the real
            // thing can be checked without needing to screenshot it. Neither
            // ImageRenderer nor NSHostingController.fittingSize reproduced the
            // collapse; only the live popover does.
            GeometryReader { geo in
                Color.clear.onAppear { LayoutProbe.record(geo.size) }
            }
        )
    }
}

/// Writes the popover's real laid-out size to the support directory on first
/// appearance. Exists because the collapse that shipped was invisible to every
/// offscreen check — the only faithful measurement is the live popover.
enum LayoutProbe {
    static func record(_ size: CGSize) {
        guard let dir = try? FileIndex.supportDirectory() else { return }
        let line = "popover laid out at \(Int(size.width))x\(Int(size.height))"
            + (size.height < 300 ? "  COLLAPSED" : "  ok") + "\n"
        try? line.write(to: dir.appending(path: "layout-probe.txt"),
                        atomically: true, encoding: .utf8)
    }
}

struct FooterView: View {
    @ObservedObject var engine: UsageEngine
    @ObservedObject var updates = UpdateChecker.shared
    @Binding var tab: RootView.Tab
    @AppStorage("menuBarMetric") private var metric = MenuBarMetric.cost
    /// Read here as well as in the checker so switching the setting off hides an
    /// already-found update immediately, rather than at the next launch.
    @AppStorage("updateCheckEnabled") private var updateChecks = true

    var body: some View {
        HStack(spacing: 8) {
            if engine.isRefreshing {
                ProgressView().controlSize(.small)
            } else if let t = engine.lastRefresh {
                Text("updated \(t.formatted(date: .omitted, time: .shortened))")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            // Red, and only present when there's genuinely a newer release — the
            // one place in this footer allowed to draw the eye. It can't live in
            // the menu bar item instead: MenuBarExtra renders its label as a
            // single monochrome template image (see MenuBarLabel), so color there
            // is silently discarded.
            if updateChecks, let update = updates.available {
                Button {
                    NSWorkspace.shared.open(update.url)
                } label: {
                    Text("New version available").foregroundStyle(.red)
                }
                .help("AgentSpend \(update.version) is available. Opens the release page.")
            }
            // Toggles what the menu bar item displays — cost or energy. The icon
            // shows what's on the bar now; clicking swaps to the other.
            Button {
                metric = metric == .energy ? .cost : .energy
            } label: {
                Image(systemName: metric == .energy ? "bolt.fill" : "dollarsign")
            }
            .help("Menu bar shows \(metric == .energy ? "energy" : "cost"). Click to show \(metric == .energy ? "cost" : "energy")")
            // No Refresh button: the FSEvents watcher re-ingests within a couple
            // of seconds of Claude Code writing, with a 60s full-rescan backstop,
            // so the number is already current and the button only ever invited
            // doubt about that. The "updated" timestamp on the left is the honest
            // version of the same reassurance.
            Button(tab == .method ? "Done" : "Method") {
                tab = tab == .method ? .home : .method
            }
            // Last, hard right — the one irreversible action in the row, kept
            // away from the things you click often.
            Button("Quit") { NSApplication.shared.terminate(nil) }
        }
        .buttonStyle(.borderless)
        .font(.caption)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

struct Stat: View {
    let label: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.system(.body, design: .rounded)).monospacedDigit()
        }
    }
}

struct Banner: View {
    let text: String
    /// Supplied when the warning is something you can acknowledge and move on
    /// from. Without it the banner has no close button and simply stays.
    var onDismiss: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(text)
            if let onDismiss {
                Spacer(minLength: 4)
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.orange)
                .help("Dismiss")
                .accessibilityLabel("Dismiss")
            }
        }
        .font(.caption)
        .foregroundStyle(.orange)
        .padding(8)
        .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 6))
    }
}
