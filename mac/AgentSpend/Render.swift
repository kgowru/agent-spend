import AppKit
import SwiftUI

/// `AgentSpend --render <dir>`
///
/// Renders each pane offscreen to a PNG. Verifying the UI by screenshotting the
/// live menu bar needs accessibility permission and captures whatever else is
/// on screen; this renders only our own view tree, deterministically, into a
/// file. Reads from the store populated by a prior run, so it needs no ingest.
@MainActor
enum Render {
    static func run(to dir: String) -> Int32 {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.accessory)

        do {
            let out = URL(fileURLWithPath: (dir as NSString).expandingTildeInPath)
            try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
            // Detected sources, so a render shows what the shipped app shows.
            let engine = try UsageEngine(sources: LogSource.all())

            if engine.records.isEmpty {
                print("store is empty — run the app once so it can ingest, then retry")
                return 1
            }

            // The History headline is the total for the selected window, so
            // the windows must actually produce different totals — otherwise
            // the selector looks live but the number never moves.
            var lastUsd = -1.0
            for window in [1, 14, 30, 90] {
                let s = engine.dailySummaries(days: window)
                let usd = s.reduce(0) { $0 + $1.usd }
                let wh = s.reduce(0) { $0 + $1.wh }
                let reqs = s.reduce(0) { $0 + $1.requests }
                print(String(format: "  %2dd  $%-9.0f %7.1f kWh  %6d reqs", window, usd,
                             wh / 1000, reqs))
                guard usd > lastUsd else {
                    print("  FAIL: \(window)d total did not exceed the shorter window")
                    return 1
                }
                lastUsd = usd
                // Snapshot each window so the headline can be eyeballed too.
                UserDefaults.standard.set(window, forKey: "historyDays")
                try snap(HomeView(engine: engine), "content-home-\(window)d", out)
            }
            UserDefaults.standard.set(14, forKey: "historyDays")

            // Panes on their own: verifies the CONTENT is right. ImageRenderer
            // cannot rasterize a ScrollView's children, so this has to bypass
            // RootView's scroll container to show anything at all.
            try snap(HomeView(engine: engine), "content-home", out)
            try snap(SessionsView(engine: engine), "content-sessions", out)
            try snap(InsightsView(engine: engine), "content-savings", out)
            try snap(MethodologyView(engine: engine), "content-method", out)

            // The only part of the app that sits next to Apple's own status
            // items, so its size and alignment are judged against them.
            try snap(MenuBarLabel(engine: engine), "menubar-label", out, width: nil)

            // Render the WHOLE RootView at its natural size, with no frame
            // imposed — this is what MenuBarExtra does, and rendering only the
            // inner panes is exactly how an empty popover shipped once already.
            for tab in RootView.Tab.allCases {
                let size = try snap(RootView(engine: engine, initialTab: tab),
                                    "pane-\(tab.rawValue.lowercased())", out, width: nil)
                let ok = size.height > 300
                print(String(format: "  %-10s %.0fx%.0f  %@", (tab.rawValue as NSString).utf8String!,
                             size.width, size.height,
                             ok ? "ok" : "COLLAPSED — popover would render empty"))
                if !ok { return 1 }
            }

            print("rendered \(RootView.Tab.allCases.count) panes from "
                  + "\(engine.records.count) records to \(out.path)")

            // The check that actually matters. MenuBarExtra hosts its popover
            // through AppKit, so NSHostingController.fittingSize is the size the
            // real popover gets — ImageRenderer proposes a concrete size and
            // reports a healthy 535 even for a layout that collapses in the
            // popover, which is exactly how an empty menu bar shipped once.
            for tab in RootView.Tab.allCases {
                let host = NSHostingController(rootView: RootView(engine: engine,
                                                                  initialTab: tab))
                let fitting = host.view.fittingSize
                let ok = fitting.height > 300
                print(String(format: "  hosted %-9s %.0fx%.0f  %@",
                             (tab.rawValue as NSString).utf8String!,
                             fitting.width, fitting.height,
                             ok ? "ok" : "COLLAPSED — popover renders empty"))
                if !ok { return 1 }
            }

            // Minimum WIDTH, per history window.
            //
            // The popover is a hard 420pt and its ScrollView only scrolls
            // vertically, so a pane that cannot compress below that does not
            // scroll: it overflows sideways and the window clips the headline on
            // both edges. `snap()` cannot catch this, because forcing
            // `.frame(width: 396)` makes SwiftUI squeeze the content rather than
            // report that it did not fit. Only an unconstrained fitting size
            // tells the truth, which is the same reason the height check above
            // uses NSHostingController instead of ImageRenderer.
            //
            // This shipped once: a 3pt today-marker dot per day, written as
            // `Circle().frame(width: 3)` inside a flexible cell, is an
            // incompressible minimum. At 90 days that demanded 90*3 + 89*2 = 448pt.
            let previousWindow = UserDefaults.standard.integer(forKey: "historyDays")
            for window in [1, 14, 30, 90] {
                UserDefaults.standard.set(window, forKey: "historyDays")
                let host = NSHostingController(rootView: TodayView(engine: engine))
                // Propose a 1pt width and read back what it can actually shrink
                // to. `fittingSize` is the wrong metric here: it reports the
                // IDEAL width, which grows with the day count (989pt at 90d)
                // even for a layout that compresses to 396 without complaint.
                // The minimum is what decides whether the popover clips.
                let minW = host.sizeThatFits(in: CGSize(width: 1, height: 10_000)).width
                let fits = minW <= 396.5   // half a point for rounding
                print(String(format: "  width %3dd  min %4.0fpt  %@", window, minW,
                             fits ? "fits"
                                  : "OVERFLOWS — pane is wider than its own window"))
                if !fits { return 1 }
            }
            UserDefaults.standard.set(previousWindow == 0 ? 14 : previousWindow,
                                      forKey: "historyDays")

            // ImageRenderer can't rasterize interactive controls, so the Slider
            // shows as a placeholder above. Its appearance is stock SwiftUI; the
            // part that could genuinely be wrong is the binding, so exercise
            // that directly rather than trusting a screenshot.
            let before = engine.totalWattHours(engine.records)
            engine.cacheReadFactor = 0.01
            let low = engine.totalWattHours(engine.records)
            engine.cacheReadFactor = 0.30
            let high = engine.totalWattHours(engine.records)
            engine.cacheReadFactor = 0.10
            let restored = engine.totalWattHours(engine.records)

            guard low < before, high > before, high / low > 4.0,
                  abs(restored - before) < 1e-6 else {
                print("FAIL: cacheReadFactor binding did not drive recomputation "
                      + "(before \(before), low \(low), high \(high), restored \(restored))")
                return 1
            }
            print(String(format: "cacheReadFactor binding OK: %.1f kWh at 0.01 → "
                                 + "%.1f kWh at 0.30 (%.1fx), restores to %.1f kWh",
                         low / 1000, high / 1000, high / low, restored / 1000))
            return 0
        } catch {
            FileHandle.standardError.write(Data("render failed: \(error)\n".utf8))
            return 1
        }
    }

    @discardableResult
    private static func snap(_ view: some View, _ name: String, _ dir: URL,
                             width: CGFloat? = 396) throws -> CGSize {
        // The app lives in a dark menu bar, so a light render judges the palette
        // against a surface it never actually sits on. ImageRenderer does not
        // inherit the system appearance, so the scheme has to be stated.
        let dark = ProcessInfo.processInfo.environment["AGENTSPEND_RENDER_DARK"] != nil
        let surface = dark ? Color(red: 0.117, green: 0.117, blue: 0.113)   // #1e1e1d
                           : Color(nsColor: .windowBackgroundColor)
        let scheme: ColorScheme = dark ? .dark : .light
        let base = width.map {
            view.frame(width: $0, alignment: .topLeading).padding(12)
                .background(surface).environment(\.colorScheme, scheme).eraseToAny()
        } ?? view.background(surface).environment(\.colorScheme, scheme).eraseToAny()
        let renderer = ImageRenderer(content: base)
        renderer.scale = 2
        guard let image = renderer.nsImage,
              let tiff = image.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:])
        else { throw CocoaError(.fileWriteUnknown) }
        try png.write(to: dir.appending(path: "\(name).png"))
        return image.size
    }
}


private extension View {
    func eraseToAny() -> AnyView { AnyView(self) }
}
