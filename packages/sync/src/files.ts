/**
 * File tree on top of the Y.Doc, plus the file-level conflict policy Yjs does not provide.
 *
 * Model: doc.getMap('files') : Y.Map<fileId, Y.Map{ name, createdAt, deletedAt, text: Y.Text }>
 *
 * Policy (vault: Files and Conflict Policy):
 * - Identity is the fileId, never the name, so rename vs edit never loses content.
 * - Concurrent renames: last writer wins on `name` (Y.Map semantics).
 * - Delete is soft (`deletedAt`). Delete vs offline edit: the file lands in Trash *with* the
 *   offline edits inside, because the Y.Text is never dropped.
 * - Duplicate names are allowed in data and disambiguated at render: "x.ts", "x (2).ts".
 *
 * Invariant: every mutation of the files map goes through this module, in a FILES_ORIGIN transaction.
 */
import * as Y from 'yjs'
import type { FileEntry } from '@hydras/shared'
import { FILES_ORIGIN } from './origins'

const FILES_KEY = 'files'
const MAX_PATH_LENGTH = 512
const MAX_SEGMENT_LENGTH = 255

type FileRecord = Y.Map<unknown>

export function filesMap(doc: Y.Doc): Y.Map<FileRecord> {
  return doc.getMap<FileRecord>(FILES_KEY)
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * A file's `name` is its path relative to the project root, with "/" separators
 * ("src/app/main.ts"). Normalizes Windows separators and a leading "./"; rejects absolute
 * paths and ".." so a path can never point outside the opened folder.
 * Returns the normalized path or throws a user-readable error.
 */
export function validateFilePath(raw: string): string {
  const path = raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
  if (path.length === 0) throw new Error('File name cannot be empty')
  if (path.length > MAX_PATH_LENGTH) {
    throw new Error(`File path is longer than ${MAX_PATH_LENGTH} characters`)
  }
  if (hasControlChars(path)) throw new Error('File name contains control characters')
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    throw new Error('Use a path relative to the project root')
  }
  const segments = path.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new Error('File path has an empty, "." or ".." segment')
    }
    if (segment.length > MAX_SEGMENT_LENGTH) throw new Error('A folder or file name is too long')
  }
  return segments.join('/')
}

/** The visible (not trashed) file at `path`, if any. O(files): prefer pathIndex in loops. */
export function findFileByPath(doc: Y.Doc, path: string): string | null {
  let found: string | null = null
  filesMap(doc).forEach((record, id) => {
    if (found) return
    if (record.get('name') === path && record.get('deletedAt') == null) found = id
  })
  return found
}

export interface PathIndex {
  /** path -> id of the visible file at that path. */
  visible: Map<string, string>
  /** path -> id of a trashed file at that path (restorable). */
  trashed: Map<string, string>
}

/**
 * Index every file by path in one pass. Bulk operations (importing a folder with tens of
 * thousands of files) must use this instead of findFileByPath, which is a linear scan.
 */
export function pathIndex(doc: Y.Doc): PathIndex {
  const visible = new Map<string, string>()
  const trashed = new Map<string, string>()
  filesMap(doc).forEach((record, id) => {
    const name = record.get('name')
    if (typeof name !== 'string') return
    if (record.get('deletedAt') == null) {
      if (!visible.has(name)) visible.set(name, id)
    } else if (!trashed.has(name)) trashed.set(name, id)
  })
  return { visible, trashed }
}

/** True while a folder file's contents have not been loaded into the room. */
export function isStub(doc: Y.Doc, id: string): boolean {
  return filesMap(doc).get(id)?.get('stub') === true
}

/** Record fields that change what the file list shows (text edits do not). */
export const LISTED_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'createdAt',
  'deletedAt',
  'stub',
  'size',
])

function getRecord(doc: Y.Doc, id: string): FileRecord {
  const record = filesMap(doc).get(id)
  if (!record) throw new Error(`Unknown file: ${id}`)
  return record
}

function toEntry(id: string, record: FileRecord): FileEntry | null {
  const name = record.get('name')
  const createdAt = record.get('createdAt')
  const deletedAt = record.get('deletedAt')
  if (typeof name !== 'string' || typeof createdAt !== 'number') return null
  const entry: FileEntry = {
    id,
    name,
    createdAt,
    deletedAt: typeof deletedAt === 'number' ? deletedAt : null,
  }
  if (record.get('stub') === true) entry.stub = true
  const size = record.get('size')
  if (typeof size === 'number') entry.size = size
  return entry
}

export interface CreateFileInput {
  name: string
  content?: string
  id?: string
  now?: number
  /** Create a folder file whose contents load later (see FileEntry.stub). */
  stub?: boolean
  size?: number
}

export function createFile(doc: Y.Doc, input: CreateFileInput): string {
  const name = validateFilePath(input.name)
  const id = input.id ?? crypto.randomUUID()
  const record: FileRecord = new Y.Map<unknown>()
  doc.transact(() => {
    filesMap(doc).set(id, record)
    record.set('name', name)
    record.set('createdAt', input.now ?? Date.now())
    record.set('deletedAt', null)
    record.set('text', new Y.Text(input.stub ? '' : (input.content ?? '')))
    if (input.stub) record.set('stub', true)
    if (typeof input.size === 'number') record.set('size', input.size)
  }, FILES_ORIGIN)
  return id
}

export function renameFile(doc: Y.Doc, id: string, rawName: string): void {
  const name = validateFilePath(rawName)
  const record = getRecord(doc, id)
  doc.transact(() => record.set('name', name), FILES_ORIGIN)
}

export function deleteFile(doc: Y.Doc, id: string, now: number = Date.now()): void {
  const record = getRecord(doc, id)
  doc.transact(() => record.set('deletedAt', now), FILES_ORIGIN)
}

export function restoreFile(doc: Y.Doc, id: string): void {
  const record = getRecord(doc, id)
  doc.transact(() => record.set('deletedAt', null), FILES_ORIGIN)
}

export function getFileText(doc: Y.Doc, id: string): Y.Text | null {
  const text = filesMap(doc).get(id)?.get('text')
  return text instanceof Y.Text ? text : null
}

function compareEntries(a: FileEntry, b: FileEntry): number {
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

/** All files (including Trash), oldest first; ties broken by id so every client agrees. */
export function listFiles(doc: Y.Doc): FileEntry[] {
  const entries: FileEntry[] = []
  filesMap(doc).forEach((record, id) => {
    const entry = toEntry(id, record)
    if (entry) entries.push(entry)
  })
  return entries.sort(compareEntries)
}

/** "x.ts" + 2 -> "x (2).ts"; "Makefile" + 2 -> "Makefile (2)"; ".env" + 2 -> ".env (2)". */
export function withCopySuffix(name: string, n: number): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return `${name} (${n})`
  return `${name.slice(0, dot)} (${n})${name.slice(dot)}`
}

/**
 * Display names for files. Pure and deterministic: among visible files the oldest keeps its
 * name and later duplicates get " (2)", " (3)" ... Trashed files keep their own names.
 */
export function resolveDisplayNames(entries: readonly FileEntry[]): Map<string, string> {
  const result = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const entry of [...entries].sort(compareEntries)) {
    if (entry.deletedAt !== null) {
      result.set(entry.id, entry.name)
      continue
    }
    const count = (seen.get(entry.name) ?? 0) + 1
    seen.set(entry.name, count)
    result.set(entry.id, count === 1 ? entry.name : withCopySuffix(entry.name, count))
  }
  return result
}
