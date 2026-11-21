/**
 * Mirror a real folder on disk into a room, both ways.
 *
 *   disk  -> room   on link (import) and whenever the watcher reports a change
 *   room  -> disk   whenever anyone (local or remote) edits, renames or creates a file
 *
 * The folder lives on the machine of whoever opened it (the host). Collaborators edit the
 * room; the host's mirror writes their edits to disk. The platform specifics (Tauri, the
 * browser File System Access API, an in-memory fake in tests) sit behind FolderHost.
 *
 * Policies (safe by default, never destroy files on disk):
 * - Import: disk wins. If the room already has the path, the disk text is applied as a
 *   minimal diff, so open editors and other people's cursors survive.
 * - Deleting or renaming in the room never deletes on disk. A rename writes the new path;
 *   the old file stays until you remove it yourself.
 * - A file deleted on disk goes to the room's Trash (restorable), content intact.
 * - Binary, oversized and ignored files are skipped and counted.
 * - Echo guard: changes read from disk use DISK_ORIGIN and are not written back; writes
 *   we made ourselves are recognised when the watcher reports them and ignored.
 *
 * Big codebases (lazy loading):
 * - Every eligible file is listed in the room immediately, but only files already loaded
 *   in the room plus the shallowest files up to `eagerFiles` / `eagerBytes` have their
 *   text read up front. The rest are stubs: empty text, `stub: true`. A stub is loaded
 *   from disk as soon as anyone opens it (`load(ids)`, driven by who is viewing what).
 * - A stub is NEVER written back to disk: its empty text is not the file's content.
 * - Bulk lookups go through one path index instead of scanning the map per file.
 */
import type * as Y from 'yjs'
import {
  createFile,
  deleteFile,
  filesMap,
  findFileByPath,
  getFileText,
  pathIndex,
  restoreFile,
  type PathIndex,
} from './files'
import { writable, type Readable } from './observable'
import { DISK_ORIGIN } from './origins'
import { applyTextUpdate } from './text-diff'

export interface FolderEntry {
  /** Relative path with "/" separators. */
  path: string
  size: number
}

export type ReadResult = { kind: 'text'; text: string } | { kind: 'binary' } | { kind: 'missing' }

export interface FolderHost {
  /** Folder name shown in the UI. */
  readonly name: string
  /** Every file under the root, already filtered by .gitignore and default ignores. */
  list(): Promise<FolderEntry[]>
  read(path: string): Promise<ReadResult>
  write(path: string, text: string): Promise<void>
  /** Report changed (created, modified or deleted) relative paths. Returns unsubscribe. */
  watch(onChange: (paths: string[]) => void): () => void
}

export const MIRROR_LIMITS = {
  /** Files listed in the room (as loaded files or stubs). */
  maxFiles: 100_000,
  maxFileBytes: 1_000_000,
  readConcurrency: 16,
  /** Files whose text is read during import; the rest load when opened. */
  eagerFiles: 2_000,
  eagerBytes: 20_000_000,
} as const

const depthOf = (path: string) => path.split('/').length

export type MirrorStatus =
  | { state: 'importing'; done: number; total: number }
  | { state: 'live'; files: number; skipped: number; lastWrite: number | null }
  | { state: 'error'; message: string }

export interface FolderLink {
  readonly folderName: string
  readonly status: Readable<MirrorStatus>
  /** Load these files' text from disk if they are still stubs. Safe to call repeatedly. */
  load(ids: Iterable<string>): void
  /** Write any pending room edits to disk now (used before closing). */
  flush(): Promise<void>
  unlink(): void
}

export interface LinkOptions {
  writeDebounceMs?: number
  onError?: (message: string, path?: string) => void
}

/**
 * The room always holds "\n" line endings (the editor and the CRDT must agree on
 * character positions). Each file's own style is remembered and restored on write, so a
 * CRLF file on Windows stays CRLF on disk.
 */
export type LineEnding = 'lf' | 'crlf'

export function normalizeEol(text: string): { text: string; eol: LineEnding } {
  return text.includes('\r\n')
    ? { text: text.replace(/\r\n/g, '\n'), eol: 'crlf' }
    : { text, eol: 'lf' }
}

export function restoreEol(text: string, eol: LineEnding): string {
  return eol === 'crlf' ? text.replace(/\r?\n/g, '\r\n') : text
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** Which listed files to read during import: already-loaded ones, then shallowest first. */
function pickEager(doc: Y.Doc, entries: readonly FolderEntry[], index: PathIndex): Set<string> {
  const eager = new Set<string>()
  for (const entry of entries) {
    const id = index.visible.get(entry.path)
    if (id && filesMap(doc).get(id)?.get('stub') !== true) eager.add(entry.path)
  }
  let bytes = 0
  const byDepth = [...entries].sort(
    (a, b) => depthOf(a.path) - depthOf(b.path) || (a.path < b.path ? -1 : 1),
  )
  for (const entry of byDepth) {
    if (eager.size >= MIRROR_LIMITS.eagerFiles) break
    if (eager.has(entry.path) || bytes + entry.size > MIRROR_LIMITS.eagerBytes) continue
    eager.add(entry.path)
    bytes += entry.size
  }
  return eager
}

/** Never write a stub (its empty text is not the file's content) or a trashed file. */
function isWritable(record: Y.Map<unknown> | undefined): record is Y.Map<unknown> {
  return record != null && record.get('deletedAt') == null && record.get('stub') !== true
}

export function linkFolder(doc: Y.Doc, host: FolderHost, options: LinkOptions = {}): FolderLink {
  const debounceMs = options.writeDebounceMs ?? 250
  const status = writable<MirrorStatus>({ state: 'importing', done: 0, total: 0 })
  /** Last text we know matches disk, per path. The echo guard. */
  const onDisk = new Map<string, string>()
  const eolByPath = new Map<string, LineEnding>()
  const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()
  /** Stub ids with a disk read in flight, so repeated requests don't pile up. */
  const loading = new Set<string>()
  /** Stub ids requested before the import finished. */
  const queued = new Set<string>()
  let skipped = 0
  /** Files listed in the room from this folder (loaded or stub). */
  let listed = 0
  let lastWrite: number | null = null
  let active = true
  let importing = true
  let stopWatching: (() => void) | null = null

  const report = (message: string, path?: string) => options.onError?.(message, path)

  const setLive = () => {
    if (!active) return
    status.set({ state: 'live', files: Math.max(listed, onDisk.size), skipped, lastWrite })
  }

  // ---- disk -> room ------------------------------------------------------------------
  const normalizeRead = (path: string, raw: ReadResult): ReadResult => {
    if (raw.kind !== 'text') return raw
    const { text, eol } = normalizeEol(raw.text)
    eolByPath.set(path, eol)
    return { kind: 'text', text }
  }

  const readEntry = async (path: string): Promise<ReadResult> => {
    try {
      return normalizeRead(path, await host.read(path))
    } catch (error) {
      report(`Could not read ${path}: ${errorMessage(error)}`, path)
      return { kind: 'binary' }
    }
  }

  /** Put disk text into file `id` (minimal diff) and clear its stub flag. */
  const fill = (id: string, text: string) => {
    const record = filesMap(doc).get(id)
    const yText = getFileText(doc, id)
    if (!record || !yText) return
    applyTextUpdate(yText, text, DISK_ORIGIN)
    if (record.get('stub') === true) record.delete('stub')
  }

  const applyFromDisk = (path: string, result: ReadResult, index?: PathIndex) => {
    const id = index ? (index.visible.get(path) ?? null) : findFileByPath(doc, path)
    if (result.kind === 'missing') {
      onDisk.delete(path)
      if (id) doc.transact(() => deleteFile(doc, id), DISK_ORIGIN)
      return
    }
    if (result.kind === 'binary') return
    onDisk.set(path, result.text)
    if (id) {
      doc.transact(() => fill(id, result.text), DISK_ORIGIN)
      return
    }
    const trashed = index ? (index.trashed.get(path) ?? null) : findTrashedByPath(doc, path)
    doc.transact(() => {
      if (trashed) {
        restoreFile(doc, trashed)
        fill(trashed, result.text)
        index?.visible.set(path, trashed)
      } else {
        const created = createFile(doc, { name: path, content: result.text })
        index?.visible.set(path, created)
      }
    }, DISK_ORIGIN)
  }

  const importAll = async () => {
    const all = await host.list()
    const eligible = all.filter((e) => e.size <= MIRROR_LIMITS.maxFileBytes)
    skipped += all.length - eligible.length
    const entries = eligible.slice(0, MIRROR_LIMITS.maxFiles)
    skipped += eligible.length - entries.length

    const index = pathIndex(doc)
    const eager = pickEager(doc, entries, index)
    const toRead = entries.filter((e) => eager.has(e.path))
    status.set({ state: 'importing', done: 0, total: toRead.length })

    let done = 0
    const reads = await mapLimit(toRead, MIRROR_LIMITS.readConcurrency, async (entry) => {
      const result = await readEntry(entry.path)
      done++
      if (active && done % 50 === 0) status.set({ state: 'importing', done, total: toRead.length })
      return [entry.path, result] as const
    })
    if (!active) return

    listed = 0
    doc.transact(() => {
      for (const [path, result] of reads) {
        if (result.kind === 'text') {
          applyFromDisk(path, result, index)
          listed++
        } else skipped++
      }
      for (const entry of entries) {
        if (eager.has(entry.path)) continue
        const id = index.visible.get(entry.path)
        listed++
        if (id) {
          filesMap(doc).get(id)?.set('size', entry.size)
        } else if (!index.trashed.has(entry.path)) {
          // A trashed file at this path stays in Trash; restoring it reloads it later.
          const created = createFile(doc, { name: entry.path, stub: true, size: entry.size })
          index.visible.set(entry.path, created)
        }
      }
    }, DISK_ORIGIN)
  }

  const loadOne = (id: string, path: string) => {
    loading.add(id)
    void readEntry(path).then((result) => {
      loading.delete(id)
      if (!active) return
      const current = filesMap(doc).get(id)
      if (!current || current.get('stub') !== true || current.get('name') !== path) return
      if (result.kind === 'text') {
        onDisk.set(path, result.text)
        doc.transact(() => fill(id, result.text), DISK_ORIGIN)
      } else if (result.kind === 'missing') {
        doc.transact(() => deleteFile(doc, id), DISK_ORIGIN)
      } else {
        report(`${path} is not a text file, so it can't be opened in the editor.`, path)
      }
      setLive()
    })
  }

  /** Read requested stubs' text from disk. Non-stubs and unknown ids are ignored. */
  const loadStubs = (ids: Iterable<string>) => {
    for (const id of ids) {
      const record = filesMap(doc).get(id)
      const path = record?.get('name')
      if (!record || record.get('stub') !== true || typeof path !== 'string') continue
      if (loading.has(id)) continue
      if (importing) queued.add(id)
      else loadOne(id, path)
    }
  }

  const onDiskChange = (paths: string[]) => {
    for (const path of new Set(paths)) {
      const id = findFileByPath(doc, path)
      // A stub has no text in the room yet; it reads the latest disk copy when opened.
      if (id && filesMap(doc).get(id)?.get('stub') === true) continue
      host
        .read(path)
        .then((raw) => {
          if (!active) return
          const result = normalizeRead(path, raw)
          if (result.kind === 'text' && onDisk.get(path) === result.text) return // our own write
          applyFromDisk(path, result)
          setLive()
        })
        .catch((error: unknown) => report(`Could not read ${path}: ${errorMessage(error)}`, path))
    }
  }

  // ---- room -> disk ------------------------------------------------------------------
  const writeNow = async (path: string, text: string) => {
    if (onDisk.get(path) === text) return
    onDisk.set(path, text)
    try {
      await host.write(path, restoreEol(text, eolByPath.get(path) ?? 'lf'))
      lastWrite = Date.now()
      setLive()
    } catch (error) {
      onDisk.delete(path)
      report(`Could not save ${path}: ${errorMessage(error)}`, path)
    }
  }

  const scheduleWrite = (id: string) => {
    const record = filesMap(doc).get(id)
    if (!isWritable(record) || typeof record.get('name') !== 'string') return
    const existing = pendingWrites.get(id)
    if (existing) clearTimeout(existing)
    pendingWrites.set(
      id,
      setTimeout(() => {
        pendingWrites.delete(id)
        const current = filesMap(doc).get(id)
        const currentPath = current?.get('name')
        const text = getFileText(doc, id)
        if (isWritable(current) && typeof currentPath === 'string' && text) {
          void writeNow(currentPath, text.toString())
        }
      }, debounceMs),
    )
  }

  const onRoomChange = (events: Y.YEvent<Y.AbstractType<unknown>>[], tx: Y.Transaction) => {
    if (tx.origin === DISK_ORIGIN || !active || importing) return
    const touched = new Set<string>()
    for (const event of events) {
      const [first] = event.path
      if (typeof first === 'string') touched.add(first)
      else if (event.target === filesMap(doc)) {
        for (const key of (event as Y.YMapEvent<unknown>).keysChanged) touched.add(key)
      }
    }
    for (const id of touched) scheduleWrite(id)
  }

  // ---- lifecycle ---------------------------------------------------------------------
  void importAll()
    .then(() => {
      importing = false
      if (!active) return
      filesMap(doc).observeDeep(onRoomChange)
      stopWatching = host.watch(onDiskChange)
      setLive()
      const waiting = [...queued]
      queued.clear()
      loadStubs(waiting)
    })
    .catch((error: unknown) => {
      importing = false
      if (active) status.set({ state: 'error', message: errorMessage(error) })
    })

  return {
    folderName: host.name,
    status,
    load: loadStubs,
    async flush() {
      const ids = [...pendingWrites.keys()]
      for (const id of ids) {
        clearTimeout(pendingWrites.get(id))
        pendingWrites.delete(id)
        const record = filesMap(doc).get(id)
        const path = record?.get('name')
        const text = getFileText(doc, id)
        if (isWritable(record) && typeof path === 'string' && text) {
          await writeNow(path, text.toString())
        }
      }
    },
    unlink() {
      active = false
      stopWatching?.()
      filesMap(doc).unobserveDeep(onRoomChange)
      for (const timer of pendingWrites.values()) clearTimeout(timer)
      pendingWrites.clear()
    },
  }
}

function findTrashedByPath(doc: Y.Doc, path: string): string | null {
  let found: string | null = null
  filesMap(doc).forEach((record, id) => {
    if (!found && record.get('name') === path && record.get('deletedAt') != null) found = id
  })
  return found
}
