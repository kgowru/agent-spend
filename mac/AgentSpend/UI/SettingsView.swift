import ServiceManagement
import SwiftUI

/// Whether AgentSpend opens itself when you log in.
///
/// The truth lives in the system, not in UserDefaults: the user can remove the
/// login item from System Settings at any time, and a stored flag would then
/// show a checkmark for something that no longer happens. So this only ever
/// reads `SMAppService` back, and re-reads it each time Settings opens.
@MainActor
final class LaunchAtLogin: ObservableObject {
    static let shared = LaunchAtLogin()

    @Published private(set) var isEnabled = false

    /// Set once the first-launch default has been applied, so turning the
    /// setting off afterwards sticks instead of being undone at the next launch.
    private static let defaultedKey = "launchAtLoginDefaulted"

    private init() { refresh() }

    func refresh() {
        isEnabled = SMAppService.mainApp.status == .enabled
    }

    /// On by default: a usage tracker that isn't running misses nothing, but it
    /// also shows nothing until you remember to open it.
    ///
    /// Skipped for the dev copy. `dev.sh` reinstalls it on every rebuild, and it
    /// would otherwise start at login alongside the release copy.
    func enableOnFirstLaunch() {
        let defaults = UserDefaults.standard
        guard !AppBuild.isDev, !defaults.bool(forKey: Self.defaultedKey) else { return }
        // `requiresApproval` means the user switched it off in System Settings
        // at some point. That is a choice, so leave it alone.
        let status = SMAppService.mainApp.status
        if status != .enabled, status != .requiresApproval {
            try? SMAppService.mainApp.register()
        }
        refresh()
        // Only marked done once it took, so a failed attempt (say, launched
        // straight from the disk image) gets another go next launch.
        if isEnabled || SMAppService.mainApp.status == .requiresApproval {
            defaults.set(true, forKey: Self.defaultedKey)
        }
    }

    func set(_ on: Bool) {
        // Failure is reflected by `refresh` rather than reported: the checkbox
        // simply stays where it was, which says the same thing.
        try? on ? SMAppService.mainApp.register() : SMAppService.mainApp.unregister()
        refresh()
        // The item exists but the user switched it off in System Settings once
        // before. Only they can turn it back on, so take them there.
        if on, SMAppService.mainApp.status == .requiresApproval {
            SMAppService.openSystemSettingsLoginItems()
        }
    }
}

/// The pane behind the footer's gear: the switches, then how the numbers are
/// worked out.
struct SettingsView: View {
    @ObservedObject var engine: UsageEngine
    var onBack: () -> Void = {}
    @ObservedObject private var login = LaunchAtLogin.shared
    @AppStorage("menuBarMetric") private var metric = MenuBarMetric.cost
    @AppStorage("updateCheckEnabled") private var updateChecks = true

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            BackButton(action: onBack)

            VStack(alignment: .leading, spacing: 6) {
                Text("Menu bar shows").font(.caption).foregroundStyle(.secondary)
                Picker("Menu bar shows", selection: $metric) {
                    ForEach(MenuBarMetric.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.radioGroup)
                .labelsHidden()
            }

            Divider()

            VStack(alignment: .leading, spacing: 6) {
                Text("General").font(.caption).foregroundStyle(.secondary)
                Toggle("Open at login", isOn: Binding(
                    get: { login.isEnabled },
                    set: { login.set($0) }))
                Toggle("Check for updates", isOn: $updateChecks)
            }
            .toggleStyle(.checkbox)

            Divider()

            MethodologyView(engine: engine)
        }
        .onAppear { login.refresh() }
    }
}
