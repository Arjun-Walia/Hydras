/**
 * Per-user undo scenarios from the vault's "Per-User Undo" table. These are the cases the
 * problem statement calls out as breaking in ways teams debug by hand.
 * captureTimeout is 0 so every edit is its own undo step and tests stay deterministic.
 */
import { describe, expect, it } from 'vitest'
import { createUndoManager, readUndoState } from './undo'
import { connect, deleteAt, makeReplica, syncAll, typeAt } from './test-utils'

function setup() {
  const a = makeReplica(1)
  const b = makeReplica(2)
  const disconnect = connect(a, b)
  const textA = a.getText('file')
  const textB = b.getText('file')
  const undoA = createUndoManager(textA, 0)
  const undoB = createUndoManager(textB, 0)
  return { a, b, textA, textB, undoA, undoB, disconnect }
}

describe('per-user undo', () => {
  it('A types "foo", B types "bar" after it, A undoes: only "foo" goes', () => {
    const { textA, textB, undoA } = setup()
    typeAt(textA, 0, 'foo')
    typeAt(textB, 3, 'bar')
    expect(textA.toString()).toBe('foobar')

    undoA.undo()

    expect(textA.toString()).toBe('bar')
    expect(textB.toString()).toBe('bar')
  })

  it('undo with nothing local on the stack is a no-op and never reverts others', () => {
    const { textA, textB, undoA } = setup()
    typeAt(textB, 0, 'theirs')

    expect(readUndoState(undoA).canUndo).toBe(false)
    undoA.undo()

    expect(textA.toString()).toBe('theirs')
  })

  it('remote edits inside my text do not get undone with it', () => {
    const { textA, textB, undoA } = setup()
    typeAt(textA, 0, 'hello world')
    typeAt(textB, 5, ',')
    expect(textA.toString()).toBe('hello, world')

    undoA.undo()

    expect(textA.toString()).toBe(',')
  })

  it('A types offline, reconnects, undoes: only the offline typing is reverted', () => {
    const { a, b, textA, textB, undoA, disconnect } = setup()
    typeAt(textA, 0, 'shared\n')
    disconnect()

    typeAt(textA, 7, 'mine offline')
    typeAt(textB, 0, 'theirs ')
    syncAll([a, b])
    expect(textA.toString()).toBe(textB.toString())

    undoA.undo()
    syncAll([a, b])

    expect(textA.toString()).toBe('theirs shared\n')
    expect(textB.toString()).toBe('theirs shared\n')
  })

  it('redo still applies my change after a remote edit landed in between', () => {
    const { textA, textB, undoA } = setup()
    typeAt(textA, 0, 'abc')
    undoA.undo()
    typeAt(textB, 0, 'X')

    undoA.redo()

    // Both survive; their relative order is Yjs's deterministic choice, not ours to assert.
    expect([...textA.toString()].sort().join('')).toBe('Xabc')
    expect(textA.toString()).toContain('abc')
  })

  it('A types, B deletes it, A undoes: no crash and B’s delete stands', () => {
    const { textA, textB, undoA } = setup()
    typeAt(textA, 0, 'temp')
    deleteAt(textB, 0, 4)

    expect(() => undoA.undo()).not.toThrow()
    expect(textA.toString()).toBe('')
  })
})
