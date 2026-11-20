/**
 * File-level conflict policy (vault: Files and Conflict Policy).
 */
import { describe, expect, it } from 'vitest'
import type { FileEntry } from '@hydras/shared'
import {
  createFile,
  deleteFile,
  getFileText,
  listFiles,
  renameFile,
  resolveDisplayNames,
  restoreFile,
  validateFilePath,
  withCopySuffix,
} from './files'
import { makeReplica, syncAll, typeAt } from './test-utils'

describe('files API', () => {
  it('creates, renames, soft-deletes and restores by stable id', () => {
    const doc = makeReplica(1)
    const id = createFile(doc, { name: 'a.ts', content: 'x', now: 1 })

    renameFile(doc, id, 'b.ts')
    deleteFile(doc, id, 5)
    expect(listFiles(doc)).toEqual([{ id, name: 'b.ts', createdAt: 1, deletedAt: 5 }])

    restoreFile(doc, id)
    expect(listFiles(doc)[0]?.deletedAt).toBeNull()
    expect(getFileText(doc, id)?.toString()).toBe('x')
  })

  it('rejects empty, overlong and control-character names', () => {
    expect(() => validateFilePath('   ')).toThrow(/empty/)
    expect(() => validateFilePath('a'.repeat(513))).toThrow(/longer/)
    expect(() => validateFilePath('bad\u0007name')).toThrow(/control/)
    expect(validateFilePath('  ok.ts ')).toBe('ok.ts')
  })

  it('normalizes folder paths and refuses to escape the project root', () => {
    expect(validateFilePath('src\\app\\main.ts')).toBe('src/app/main.ts')
    expect(validateFilePath('./src/main.ts')).toBe('src/main.ts')
    expect(() => validateFilePath('../secrets.txt')).toThrow(/"\.\."/)
    expect(() => validateFilePath('src/../../x')).toThrow(/"\.\."/)
    expect(() => validateFilePath('/etc/passwd')).toThrow(/relative/)
    expect(() => validateFilePath('C:/Windows/x')).toThrow(/relative/)
    expect(() => validateFilePath('src//x.ts')).toThrow(/empty/)
  })

  it('throws a clear error for unknown ids', () => {
    expect(() => renameFile(makeReplica(1), 'nope', 'x')).toThrow(/Unknown file/)
  })
})

describe('conflict policy', () => {
  it('A renames while B edits: both survive', () => {
    const [a, b] = [makeReplica(1), makeReplica(2)]
    const id = createFile(a, { name: 'old.ts', content: 'v1', now: 1 })
    syncAll([a, b])

    renameFile(a, id, 'new.ts')
    typeAt(getFileText(b, id)!, 2, ' + v2')
    syncAll([a, b])

    expect(listFiles(b)[0]?.name).toBe('new.ts')
    expect(getFileText(a, id)?.toString()).toBe('v1 + v2')
  })

  it('A deletes while B edits offline: file is in Trash with B’s edits inside', () => {
    const [a, b] = [makeReplica(1), makeReplica(2)]
    const id = createFile(a, { name: 'doomed.ts', content: 'base', now: 1 })
    syncAll([a, b])

    deleteFile(a, id, 10)
    typeAt(getFileText(b, id)!, 4, ' + offline work')
    syncAll([a, b])

    for (const doc of [a, b]) {
      expect(listFiles(doc)[0]?.deletedAt).toBe(10)
      expect(getFileText(doc, id)?.toString()).toBe('base + offline work')
    }
  })

  it('two users create the same name offline: both files exist, second is suffixed', () => {
    const [a, b] = [makeReplica(1), makeReplica(2)]
    const first = createFile(a, { name: 'x.ts', now: 1, id: 'a' })
    const second = createFile(b, { name: 'x.ts', now: 2, id: 'b' })
    syncAll([a, b])

    const names = resolveDisplayNames(listFiles(a))
    expect(names.get(first)).toBe('x.ts')
    expect(names.get(second)).toBe('x (2).ts')
  })
})

describe('display names', () => {
  const entry = (
    id: string,
    name: string,
    createdAt: number,
    deletedAt: number | null = null,
  ): FileEntry => ({
    id,
    name,
    createdAt,
    deletedAt,
  })

  it('suffixes before the extension and handles dotfiles and extensionless names', () => {
    expect(withCopySuffix('x.ts', 2)).toBe('x (2).ts')
    expect(withCopySuffix('Makefile', 3)).toBe('Makefile (3)')
    expect(withCopySuffix('.env', 2)).toBe('.env (2)')
  })

  it('ignores trashed files when numbering duplicates', () => {
    const names = resolveDisplayNames([
      entry('1', 'a.ts', 1, 9),
      entry('2', 'a.ts', 2),
      entry('3', 'a.ts', 3),
    ])
    expect([names.get('1'), names.get('2'), names.get('3')]).toEqual(['a.ts', 'a.ts', 'a (2).ts'])
  })

  it('is deterministic regardless of input order', () => {
    const list = [entry('b', 'n', 1), entry('a', 'n', 1)]
    expect(resolveDisplayNames(list)).toEqual(resolveDisplayNames([...list].reverse()))
    expect(resolveDisplayNames(list).get('a')).toBe('n')
  })
})
