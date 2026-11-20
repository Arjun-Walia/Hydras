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
 */
import type * as Y from 'yjs'
import { createFile, deleteFile, filesMap, findFileByPath, getFileText, restoreFile } from './files'
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
  maxFiles: 5000,
  maxFileBytes: 1_000_000,
  readConcurrency: 16,
} as const

export type MirrorStatus =
  | { state: 'importing'; done: number; total: number }
  | { state: 'live'; files: number; skipped: number; lastWrite: number | null }
  | { state: 'error'; message: string }

export interface FolderLink {
  readonly folderName: string
  readonly status: Readable<MirrorStatus>
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

export function linkFolder(doc: Y.Doc, host: FolderHost, options: LinkOptions = {}): FolderLink {
  const debounceMs = options.writeDebounceMs ?? 250
  const status = writable<MirrorStatus>({ state: 'importing', done: 0, total: 0 })
  /** Last text we know matches disk, per path. The echo guard. */
  const onDisk = new Map<string, string>()
  const eolByPath = new Map<string, LineEnding>()
  const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()
  let skipped = 0
  let lastWrite: number | null = null
  let active = true
  let stopWatching: (() => void) | null = null

  const report = (message: string, path?: string) => options.onError?.(message, path)

  const setLive = () => {
    if (!active) return
    const files = [...onDisk.keys()].length
    status.set({ state: 'live', files, skipped, lastWrite })
  }

  // ---- disk -> room ------------------------------------------------------------------
  const normalizeRead = (path: string, raw: ReadResult): ReadResult => {
    if (raw.kind !== 'text') return raw
    const { text, eol } = normalizeEol(raw.text)
    eolByPath.set(path, eol)
    return { kind: 'text', text }
  }

  const applyFromDisk = (path: string, result: ReadResult) => {
    const id = findFileByPath(doc, path)
    if (result.kind === 'missing') {
      onDisk.delete(path)
      if (id) doc.transact(() => deleteFile(doc, id), DISK_ORIGIN)
      return
    }
    if (result.kind === 'binary') return
    onDisk.set(path, result.text)
    if (id) {
      const text = getFileText(doc, id)
      if (text) applyTextUpdate(text, result.text, DISK_ORIGIN)
      return
    }
    const trashed = findTrashedByPath(doc, path)
    doc.transact(() => {
      if (trashed) {
        restoreFile(doc, trashed)
        const text = getFileText(doc, trashed)
        if (text) applyTextUpdate(text, result.text, DISK_ORIGIN)
      } else {
        createFile(doc, { name: path, content: result.text })
      }
    }, DISK_ORIGIN)
  }

  const importAll = async () => {
    const all = await host.list()
    const eligible = all.filter((e) => e.size <= MIRROR_LIMITS.maxFileBytes)
    skipped += all.length - eligible.length
    const entries = eligible.slice(0, MIRROR_LIMITS.maxFiles)
    skipped += eligible.length - entries.length
    status.set({ state: 'importing', done: 0, total: entries.length })

    let done = 0
    const reads = await mapLimit(entries, MIRROR_LIMITS.readConcurrency, async (entry) => {
      let result: ReadResult
      try {
        result = normalizeRead(entry.path, await host.read(entry.path))
      } catch (error) {
        report(`Could not read ${entry.path}: ${errorMessage(error)}`, entry.path)
        result = { kind: 'binary' }
      }
      done++
      if (active && done % 50 === 0) status.set({ state: 'importing', done, total: entries.length })
      return [entry.path, result] as const
    })
    if (!active) return

    doc.transact(() => {
      for (const [path, result] of reads) {
        if (result.kind === 'text') applyFromDisk(path, result)
        else skipped++
      }
    }, DISK_ORIGIN)
  }

  const onDiskChange = (paths: string[]) => {
    for (const path of new Set(paths)) {
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
    const path = record?.get('name')
    if (typeof path !== 'string' || record?.get('deletedAt') != null) return
    const existing = pendingWrites.get(id)
    if (existing) clearTimeout(existing)
    pendingWrites.set(
      id,
      setTimeout(() => {
        pendingWrites.delete(id)
        const current = filesMap(doc).get(id)
        const currentPath = current?.get('name')
        const text = getFileText(doc, id)
        if (typeof currentPath === 'string' && text && current?.get('deletedAt') == null) {
          void writeNow(currentPath, text.toString())
        }
      }, debounceMs),
    )
  }

  const onRoomChange = (events: Y.YEvent<Y.AbstractType<unknown>>[], tx: Y.Transaction) => {
    if (tx.origin === DISK_ORIGIN || !active || status.get().state === 'importing') return
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
      if (!active) return
      filesMap(doc).observeDeep(onRoomChange)
      stopWatching = host.watch(onDiskChange)
      setLive()
    })
    .catch((error: unknown) => {
      if (active) status.set({ state: 'error', message: errorMessage(error) })
    })

  return {
    folderName: host.name,
    status,
    async flush() {
      const ids = [...pendingWrites.keys()]
      for (const id of ids) {
        clearTimeout(pendingWrites.get(id))
        pendingWrites.delete(id)
        const path = filesMap(doc).get(id)?.get('name')
        const text = getFileText(doc, id)
        if (typeof path === 'string' && text) await writeNow(path, text.toString())
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
