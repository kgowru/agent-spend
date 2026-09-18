import Foundation

/// The parts of ingestion that are the same whatever wrote the log: walk the
/// tree, read only what was appended, split on newlines, and carry a partial
/// trailing line to the next pass.
///
/// This exists as one copy on purpose. It is the logic that loses or
/// double-counts spend when it is wrong — a mis-seeked offset or a dropped
/// partial line is invisible in the UI and shows up only as a total that is
/// quietly off — so a second copy is a second place for that to happen, and
/// the two would drift the first time either was touched.
enum LineScanner {
    /// Every `.jsonl` beneath `root`, at any depth.
    ///
    /// Recursive for both formats, for different reasons: Claude nests subagent
    /// transcripts under `<session>/subagents/`, and Codex shards by date under
    /// `sessions/YYYY/MM/DD/`. A one-level glob misses most of either.
    static func sessionFiles(under root: URL) -> [URL] {
        guard let e = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        return e.compactMap { $0 as? URL }
            .filter { $0.pathExtension == "jsonl" && !$0.hasDirectoryPath }
            .sorted { $0.path < $1.path }
    }

    /// Read the unread tail of each file and hand out complete lines.
    ///
    /// `handle` receives one line at a time along with the file's sticky parser
    /// state, which it may mutate; whatever it leaves there is persisted with
    /// the read offset so the next pass resumes with it. Formats that repeat
    /// everything on each row (Claude) simply ignore it.
    /// `stats` is handed to `handle` rather than captured, because Swift's
    /// exclusivity rules forbid a closure touching the same `inout` the
    /// enclosing call already holds.
    static func scan(
        files: [URL],
        index: inout FileIndex,
        stats: inout IngestStats,
        handle: (_ line: Data.SubSequence, _ url: URL,
                 _ context: inout [String: String], _ stats: inout IngestStats) -> Void
    ) {
        for url in files {
            stats.filesScanned += 1
            if url.path.contains("/subagents/") { stats.subagentFiles += 1 }

            guard let entry = index.prepare(for: url) else { continue }
            if entry.rotated { stats.rotatedFiles += 1 }

            guard let handle_ = try? FileHandle(forReadingFrom: url) else { continue }
            defer { try? handle_.close() }

            do { try handle_.seek(toOffset: entry.offset) } catch { continue }
            guard let chunk = try? handle_.readToEnd(), !chunk.isEmpty else { continue }
            stats.bytesRead += Int64(chunk.count)

            // A file being appended to can end mid-line. Keep the remainder and
            // prepend it next pass rather than dropping or misparsing it.
            var data = index.pendingTail(for: url)
            data.append(chunk)
            // A rotated file is reparsed from zero, so its carried state has to
            // go too — otherwise stale context is applied to a new file's rows.
            var context = entry.rotated ? [:] : index.pendingContext(for: url)

            var lineStart = data.startIndex
            while let nl = data[lineStart...].firstIndex(of: 0x0A) {
                handle(data[lineStart..<nl], url, &context, &stats)
                lineStart = nl + 1
            }

            let tail = data[lineStart...]
            index.record(url: url,
                         offset: entry.offset + UInt64(chunk.count),
                         size: entry.size,
                         inode: entry.inode,
                         tail: tail.isEmpty ? Data() : Data(tail),
                         context: context)
        }
    }

    /// Substring search over raw bytes — cheaper than decoding to a String,
    /// and the majority of lines in both formats carry no usage at all.
    ///
    /// Self-contained: a haystack shorter than the needle returns false rather
    /// than relying on the caller to have checked, because the index arithmetic
    /// below would otherwise step before `startIndex`.
    static func contains(_ haystack: Data.SubSequence, _ needle: [UInt8]) -> Bool {
        guard let first = needle.first else { return true }
        guard haystack.count >= needle.count else { return false }
        var i = haystack.startIndex
        let limit = haystack.index(haystack.endIndex, offsetBy: -needle.count)
        while i <= limit {
            guard let hit = haystack[i...].firstIndex(of: first), hit <= limit else { return false }
            var match = true
            for (k, b) in needle.enumerated() where haystack[hit + k] != b {
                match = false
                break
            }
            if match { return true }
            i = hit + 1
        }
        return false
    }
}

/// Counters for one ingest pass, across every source.
///
/// Provider-neutral rather than owned by one parser. Some counters only ever
/// move for one format — Codex has no subagent transcripts and no `<synthetic>`
/// model — and the verify output says so rather than printing a measured-looking
/// zero.
struct IngestStats: Sendable {
    var filesScanned = 0
    var subagentFiles = 0
    var bytesRead: Int64 = 0
    var rawUsageRows = 0
    var duplicates = 0
    var supersededPartials = 0
    var synthetic = 0
    var unparseable = 0
    var rotatedFiles = 0
    /// Rows whose token fields contradict the format the parser assumes — for
    /// Codex, a cached-plus-write count exceeding the reported input. Nonzero
    /// means a total is understated, so it is surfaced rather than absorbed.
    var anomalousTokenSplit = 0
}
