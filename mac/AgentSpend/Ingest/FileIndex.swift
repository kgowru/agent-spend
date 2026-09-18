import Foundation

/// Per-file read offsets, so steady-state ingestion touches only new bytes.
///
/// A full cold index of the corpus happens once; after that each pass reads
/// only what was appended. Identity is `(inode, size)`: if the inode changes
/// the file was replaced, and if size shrank below our offset it was truncated
/// — either way, reparse from zero.
struct FileIndex: Codable, Sendable {
    struct Entry: Codable, Sendable {
        var inode: UInt64
        var size: UInt64
        var offset: UInt64
        var mtime: Double
        /// Bytes after the last newline in the previous read — a file being
        /// appended to can be read mid-line.
        var tail: Data
        /// Parser state carried between passes.
        ///
        /// Claude logs repeat everything on every usage row, so its parser
        /// needs none of this. Codex does not: the model and cwd arrive once in
        /// a `turn_context` event and every later `token_count` row depends on
        /// having seen it. Since a resumed pass starts at a byte offset well
        /// past that event, the state has to survive alongside the offset or
        /// every record after the first restart would be unattributable.
        var context: [String: String] = [:]

        init(inode: UInt64, size: UInt64, offset: UInt64, mtime: Double,
             tail: Data, context: [String: String] = [:]) {
            self.inode = inode
            self.size = size
            self.offset = offset
            self.mtime = mtime
            self.tail = tail
            self.context = context
        }

        /// Hand-written so that an index file written before `context` existed
        /// still decodes. Swift's synthesized `init(from:)` ignores property
        /// defaults and throws on a missing key, which would fail the whole
        /// index and silently downgrade the next launch into a full cold
        /// re-read of the entire corpus.
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            inode = try c.decode(UInt64.self, forKey: .inode)
            size = try c.decode(UInt64.self, forKey: .size)
            offset = try c.decode(UInt64.self, forKey: .offset)
            mtime = try c.decode(Double.self, forKey: .mtime)
            tail = try c.decodeIfPresent(Data.self, forKey: .tail) ?? Data()
            context = try c.decodeIfPresent([String: String].self, forKey: .context) ?? [:]
        }
    }

    private(set) var entries: [String: Entry] = [:]

    struct Prepared {
        var offset: UInt64
        var size: UInt64
        var inode: UInt64
        var rotated: Bool
    }

    /// Decide where to start reading this file. Returns nil when there is
    /// nothing new to read.
    mutating func prepare(for url: URL) -> Prepared? {
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
              let size = (attrs[.size] as? NSNumber)?.uint64Value
        else { return nil }
        let inode = (attrs[.systemFileNumber] as? NSNumber)?.uint64Value ?? 0
        let mtime = (attrs[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0

        guard let prior = entries[url.path] else {
            return Prepared(offset: 0, size: size, inode: inode, rotated: false)
        }
        // Replaced or truncated — the offset no longer means anything.
        if prior.inode != inode || size < prior.offset {
            entries[url.path] = nil
            return Prepared(offset: 0, size: size, inode: inode, rotated: true)
        }
        if size == prior.offset, mtime == prior.mtime { return nil }
        return Prepared(offset: prior.offset, size: size, inode: inode, rotated: false)
    }

    func pendingTail(for url: URL) -> Data { entries[url.path]?.tail ?? Data() }

    /// Sticky parser state from the previous pass. Empty after a rotation,
    /// which is correct — a replaced file is reparsed from zero.
    func pendingContext(for url: URL) -> [String: String] { entries[url.path]?.context ?? [:] }

    mutating func record(url: URL, offset: UInt64, size: UInt64, inode: UInt64,
                         tail: Data, context: [String: String] = [:]) {
        let mtime = (try? FileManager.default.attributesOfItem(atPath: url.path))
            .flatMap { ($0[.modificationDate] as? Date)?.timeIntervalSince1970 } ?? 0
        entries[url.path] = Entry(inode: inode, size: size, offset: offset,
                                  mtime: mtime, tail: tail, context: context)
    }

    // MARK: - Persistence

    static func supportDirectory() throws -> URL {
        // Escape hatch for screenshots and demos. Setting HOME is not enough:
        // `FileManager.url(for: .applicationSupportDirectory, in: .userDomainMask)`
        // resolves through the system directory API, which reads the account's
        // real home rather than the environment, so a sandboxed HOME silently
        // renders the LIVE store instead of the seeded one. That failure looks
        // exactly like a successful render, which is the dangerous part: it
        // puts real project names and real dollar figures into an image whose
        // whole purpose is to contain neither.
        if let override = ProcessInfo.processInfo.environment["AGENTSPEND_SUPPORT_DIR"],
           !override.isEmpty {
            let dir = URL(fileURLWithPath: (override as NSString).expandingTildeInPath)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            return dir
        }
        let base = try FileManager.default.url(for: .applicationSupportDirectory,
                                               in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        let dir = base.appending(path: "AgentSpend")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func load() -> FileIndex {
        guard let dir = try? supportDirectory(),
              let data = try? Data(contentsOf: dir.appending(path: "file-index.json")),
              let idx = try? JSONDecoder().decode(FileIndex.self, from: data)
        else { return FileIndex() }
        return idx
    }

    func save() throws {
        let dir = try Self.supportDirectory()
        try JSONEncoder().encode(self).write(to: dir.appending(path: "file-index.json"),
                                             options: .atomic)
    }

    mutating func reset() { entries.removeAll() }
}
