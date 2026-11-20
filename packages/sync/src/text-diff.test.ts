import fc from 'fast-check'
import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { applyTextUpdate, diffText } from './text-diff'

describe('diffText', () => {
  it('finds the single changed region', () => {
    expect(diffText('hello world', 'hello brave world')).toEqual({
      index: 6,
      deleteCount: 0,
      insert: 'brave ',
    })
    expect(diffText('abc', 'abc')).toBeNull()
    expect(diffText('abcdef', 'abXYef')).toEqual({ index: 2, deleteCount: 2, insert: 'XY' })
  })

  it('never splits an emoji surrogate pair', () => {
    const edit = diffText('a😀b', 'a😃b')!
    expect(edit.insert).toBe('😃')
    expect(edit.deleteCount).toBe(2)
  })

  it('always reproduces the target text', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (prev, next) => {
        const text = new Y.Doc().getText('t')
        text.insert(0, prev)
        applyTextUpdate(text, next, 'test')
        expect(text.toString()).toBe(next)
      }),
      { numRuns: 300 },
    )
  })
})

describe('applyTextUpdate', () => {
  it('keeps a concurrent edit elsewhere in the file', () => {
    const a = new Y.Doc()
    const b = new Y.Doc()
    a.getText('t').insert(0, 'line one\nline two\n')
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))

    applyTextUpdate(a.getText('t'), 'line ONE\nline two\n', 'disk') // external change on host
    b.getText('t').insert(b.getText('t').length, 'line three\n') // collaborator typing

    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    expect(a.getText('t').toString()).toBe('line ONE\nline two\nline three\n')
    expect(b.getText('t').toString()).toBe(a.getText('t').toString())
  })
})
