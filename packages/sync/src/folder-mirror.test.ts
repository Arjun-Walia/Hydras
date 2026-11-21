/**
 * Folder mirror against an in-memory folder: import, write-back, external changes,
 * echo suppression and the never-delete-on-disk policy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { findFileByPath, getFileText, listFiles, renameFile, deleteFile } from './files'
import { MIRROR_LIMITS, linkFolder, type FolderHost, type ReadResult } from './folder-mirror'
import { LOCAL_ORIGIN } from './origins'

class MemoryFolder implements FolderHost {
  readonly name = 'project'
  files = new Map<string, string>()
  binaries = new Set<string>()
  writes: string[] = []
  private listener: ((paths: string[]) => void) | null = null

  constructor(initial: Record<string, string>) {
    for (const [path, text] of Object.entries(initial)) this.files.set(path, text)
  }
  async list() {
    return [...this.files.keys(), ...this.binaries].map((path) => ({
      path,
      size: this.files.get(path)?.length ?? 10,
    }))
  }
  async read(path: string): Promise<ReadResult> {
    if (this.binaries.has(path)) return { kind: 'binary' }
    const text = this.files.get(path)
    return text === undefined ? { kind: 'missing' } : { kind: 'text', text }
  }
  async write(path: string, text: string) {
    this.files.set(path, text)
    this.writes.push(path)
    this.listener?.([path]) // real watchers report our own writes too
  }
  watch(onChange: (paths: string[]) => void) {
    this.listener = onChange
    return () => {
      this.listener = null
    }
  }
  /** Simulate another program changing the disk. */
  external(path: string, text: string | null) {
    if (text === null) this.files.delete(path)
    else this.files.set(path, text)
    this.listener?.([path])
  }
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(300)
}

const textOf = (doc: Y.Doc, path: string) => {
  const id = findFileByPath(doc, path)
  return id ? getFileText(doc, id)?.toString() : undefined
}

describe('folder mirror', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('imports every text file with its folder path and skips binaries', async () => {
    const folder = new MemoryFolder({ 'README.md': '# hi', 'src/main.ts': 'run()' })
    folder.binaries.add('logo.png')
    const doc = new Y.Doc()
    const link = linkFolder(doc, folder)
    await settle()

    expect(textOf(doc, 'src/main.ts')).toBe('run()')
    expect(textOf(doc, 'README.md')).toBe('# hi')
    expect(link.status.get()).toMatchObject({ state: 'live', files: 2, skipped: 1 })
  })

  it('writes room edits back to disk, debounced', async () => {
    const folder = new MemoryFolder({ 'a.ts': 'one' })
    const doc = new Y.Doc()
    linkFolder(doc, folder)
    await settle()

    const text = getFileText(doc, findFileByPath(doc, 'a.ts')!)!
    doc.transact(() => text.insert(3, ' two'), LOCAL_ORIGIN)
    doc.transact(() => text.insert(7, ' three'), LOCAL_ORIGIN)
    await settle()

    expect(folder.files.get('a.ts')).toBe('one two three')
    expect(folder.writes).toEqual(['a.ts'])
  })

  it('applies external disk changes as a diff and does not echo them back', async () => {
    const folder = new MemoryFolder({ 'a.ts': 'const x = 1\n' })
    const doc = new Y.Doc()
    linkFolder(doc, folder)
    await settle()

    folder.external('a.ts', 'const x = 2\n')
    folder.external('b.ts', 'new file')
    await settle()

    expect(textOf(doc, 'a.ts')).toBe('const x = 2\n')
    expect(textOf(doc, 'b.ts')).toBe('new file')
    expect(folder.writes).toEqual([])
  })

  it('moves a file deleted on disk to Trash and brings it back if it reappears', async () => {
    const folder = new MemoryFolder({ 'a.ts': 'keep me' })
    const doc = new Y.Doc()
    linkFolder(doc, folder)
    await settle()

    folder.external('a.ts', null)
    await settle()
    expect(findFileByPath(doc, 'a.ts')).toBeNull()
    expect(listFiles(doc)[0]?.deletedAt).not.toBeNull()

    folder.external('a.ts', 'back again')
    await settle()
    expect(textOf(doc, 'a.ts')).toBe('back again')
    expect(listFiles(doc)).toHaveLength(1)
  })

  it('never deletes on disk; a rename writes the new path and keeps the old file', async () => {
    const folder = new MemoryFolder({ 'old.ts': 'content', 'gone.ts': 'still here' })
    const doc = new Y.Doc()
    linkFolder(doc, folder)
    await settle()

    renameFile(doc, findFileByPath(doc, 'old.ts')!, 'src/new.ts')
    deleteFile(doc, findFileByPath(doc, 'gone.ts')!)
    await settle()

    expect(folder.files.get('src/new.ts')).toBe('content')
    expect(folder.files.get('old.ts')).toBe('content')
    expect(folder.files.get('gone.ts')).toBe('still here')
  })

  it('imports into an existing room as a diff, keeping file identity', async () => {
    const doc = new Y.Doc()
    const first = linkFolder(doc, new MemoryFolder({ 'a.ts': 'v1' }))
    await settle()
    const id = findFileByPath(doc, 'a.ts')
    first.unlink()

    linkFolder(doc, new MemoryFolder({ 'a.ts': 'v2' }))
    await settle()
    expect(findFileByPath(doc, 'a.ts')).toBe(id)
    expect(textOf(doc, 'a.ts')).toBe('v2')
  })

  it('edits CRLF files as LF in the room and writes them back as CRLF', async () => {
    const folder = new MemoryFolder({ 'win.ts': 'a\r\nb\r\n' })
    const doc = new Y.Doc()
    linkFolder(doc, folder)
    await settle()
    expect(textOf(doc, 'win.ts')).toBe('a\nb\n')

    const text = getFileText(doc, findFileByPath(doc, 'win.ts')!)!
    doc.transact(() => text.insert(4, 'c\n'), LOCAL_ORIGIN)
    await settle()
    expect(folder.files.get('win.ts')).toBe('a\r\nb\r\nc\r\n')
  })

  it('stops writing after unlink', async () => {
    const folder = new MemoryFolder({ 'a.ts': 'x' })
    const doc = new Y.Doc()
    const link = linkFolder(doc, folder)
    await settle()
    link.unlink()

    const text = getFileText(doc, findFileByPath(doc, 'a.ts')!)!
    doc.transact(() => text.insert(1, 'y'), LOCAL_ORIGIN)
    await settle()
    expect(folder.files.get('a.ts')).toBe('x')
  })
})

describe('folder mirror: big codebases', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** A folder deeper than the eager budget, so most files become stubs. */
  const bigFolder = (count: number) => {
    const files: Record<string, string> = { 'README.md': '# big' }
    for (let i = 0; i < count; i++)
      files[`pkg${i % 50}/src/deep/file${i}.ts`] = `export const n${i} = ${i}\n`
    return new MemoryFolder(files)
  }

  it('lists every file but only reads the eager budget, shallowest first', async () => {
    const folder = bigFolder(MIRROR_LIMITS.eagerFiles + 500)
    const doc = new Y.Doc()
    const link = linkFolder(doc, folder)
    await settle()

    const entries = listFiles(doc)
    expect(entries).toHaveLength(MIRROR_LIMITS.eagerFiles + 501)
    expect(entries.filter((e) => e.stub)).toHaveLength(501)
    expect(textOf(doc, 'README.md')).toBe('# big')
    expect(link.status.get()).toMatchObject({
      state: 'live',
      files: MIRROR_LIMITS.eagerFiles + 501,
    })
  })

  it('loads a stub from disk when it is opened, and never writes a stub back', async () => {
    const folder = bigFolder(MIRROR_LIMITS.eagerFiles + 10)
    const doc = new Y.Doc()
    const link = linkFolder(doc, folder)
    await settle()

    const stub = listFiles(doc).find((e) => e.stub)!
    expect(getFileText(doc, stub.id)!.toString()).toBe('')
    // Renaming a stub must not write its empty text over the real file.
    renameFile(doc, stub.id, `${stub.name}.renamed`)
    await settle()
    expect(folder.writes).toEqual([])
    renameFile(doc, stub.id, stub.name)

    link.load([stub.id])
    await settle()
    const loaded = listFiles(doc).find((e) => e.id === stub.id)!
    expect(loaded.stub).toBeUndefined()
    expect(getFileText(doc, stub.id)!.toString()).toBe(folder.files.get(stub.name))
    expect(folder.writes).toEqual([])
  })

  it('queues a load requested during import', async () => {
    const folder = bigFolder(MIRROR_LIMITS.eagerFiles + 5)
    const doc = new Y.Doc()
    const link = linkFolder(doc, folder)
    link.load(['not-yet-known'])
    await settle()
    const stub = listFiles(doc).find((e) => e.stub)!
    link.load([stub.id, stub.id])
    await settle()
    expect(listFiles(doc).find((e) => e.id === stub.id)!.stub).toBeUndefined()
  })

  it('imports 30,000 files without a quadratic path lookup', async () => {
    const folder = bigFolder(30_000)
    const doc = new Y.Doc()
    const started = performance.now()
    const link = linkFolder(doc, folder)
    await settle()
    expect(link.status.get().state).toBe('live')
    expect(listFiles(doc)).toHaveLength(30_001)
    expect(performance.now() - started).toBeLessThan(15_000)
  })
})
