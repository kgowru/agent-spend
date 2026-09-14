import Foundation

/// One agent CLI's logs: where they live and which parser understands them.
///
/// Kept as a value type with a switch rather than a protocol with two
/// conformances. There are two formats, they share the offset/tail machinery
/// but nothing else, and a protocol here would add a layer of indirection
/// without removing a single line of the per-format parsing that is the actual
/// work.
struct LogSource: Sendable {
    let provider: Provider
    let root: URL

    /// Every source the app knows how to read.
    ///
    /// Deliberately *not* filtered by whether the directory exists yet. A menu
    /// bar app runs for weeks, and a user who installs Codex on Tuesday would
    /// otherwise never see it: the root was absent at launch, so no source and
    /// no watcher would exist for it — and because the 60s rescan backstop
    /// lives inside the watcher, dropping the source drops the self-heal too.
    /// On a machine where neither directory exists that left zero timers and a
    /// permanent $0.
    ///
    /// An absent root simply enumerates no files, so a tool you never run still
    /// contributes nothing and never appears.
    static func all(
        claudeRoot: URL = JSONLIngestor.defaultRoot(),
        codexRoot: URL = CodexIngestor.defaultRoot()
    ) -> [LogSource] {
        [LogSource(provider: .claude, root: claudeRoot),
         LogSource(provider: .codex, root: codexRoot)]
    }

    /// Parse this source. `files == nil` walks the whole tree.
    func ingest(files: [URL]?,
                index: inout FileIndex,
                stats: inout JSONLIngestor.Stats) -> [String: UsageRecord] {
        switch provider {
        case .claude:
            return files.map { JSONLIngestor.ingest(files: $0, index: &index, stats: &stats) }
                ?? JSONLIngestor.ingest(root: root, index: &index, stats: &stats)
        case .codex:
            return files.map { CodexIngestor.ingest(files: $0, index: &index, stats: &stats) }
                ?? CodexIngestor.ingest(root: root, index: &index, stats: &stats)
        }
    }
}
