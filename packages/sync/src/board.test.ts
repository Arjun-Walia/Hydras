/**
 * Whiteboard sync: version-based merge, tombstones, images and convergence between
 * replicas that edit the same element concurrently.
 */
import { describe, expect, it } from 'vitest'
import { createBoardBinding, isNewer, mergeElements, type BoardElement } from './board'
import { connect, makeReplica, syncAll } from './test-utils'

const el = (id: string, version: number, extra: Partial<BoardElement> = {}): BoardElement => ({
  id,
  version,
  versionNonce: 100,
  index: `a${id}`,
  type: 'rectangle',
  ...extra,
})

describe('board merge rule', () => {
  it('takes the higher version, and the lower nonce on a tie', () => {
    expect(isNewer(el('1', 3), el('1', 2))).toBe(true)
    expect(isNewer(el('1', 2), el('1', 3))).toBe(false)
    expect(isNewer(el('1', 2, { versionNonce: 5 }), el('1', 2, { versionNonce: 9 }))).toBe(true)
    expect(isNewer(el('1', 2, { versionNonce: 9 }), el('1', 2, { versionNonce: 5 }))).toBe(false)
  })

  it('merges by id and orders by z-index', () => {
    const merged = mergeElements([el('b', 1), el('a', 5)], [el('a', 6, { x: 9 }), el('c', 1)])
    expect(merged.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(merged[0]?.x).toBe(9)
  })
})

describe('board binding', () => {
  it('syncs elements between replicas and notifies only for remote changes', () => {
    const [a, b] = [makeReplica(1), makeReplica(2)]
    connect(a, b)
    const boardA = createBoardBinding(a)
    const boardB = createBoardBinding(b)
    const seenByA: number[] = []
    const seenByB: number[] = []
    boardA.subscribe((els) => seenByA.push(els.length))
    boardB.subscribe((els) => seenByB.push(els.length))

    boardA.applyLocal([el('r1', 1)])
    expect(boardB.elements().map((e) => e.id)).toEqual(['r1'])
    expect(seenByB).toEqual([1])
    expect(seenByA).toEqual([]) // own writes don't echo
  })

  it('ignores stale versions, so an old copy cannot resurrect a deleted shape', () => {
    const doc = makeReplica(1)
    const board = createBoardBinding(doc)
    board.applyLocal([el('r1', 1)])
    board.applyLocal([el('r1', 2, { isDeleted: true })])
    board.applyLocal([el('r1', 1)])
    expect(board.elements()[0]).toMatchObject({ version: 2, isDeleted: true })
  })

  it('converges when two people move the same shape while offline', () => {
    const [a, b] = [makeReplica(1), makeReplica(2)]
    const boardA = createBoardBinding(a)
    const boardB = createBoardBinding(b)
    boardA.applyLocal([el('r1', 1)])
    syncAll([a, b])

    boardA.applyLocal([el('r1', 2, { x: 10, versionNonce: 7 })])
    boardB.applyLocal([el('r1', 2, { x: 20, versionNonce: 3 })])
    syncAll([a, b])

    // Both wrote the same key at the same version: Yjs keeps one value per key,
    // deterministically, so the replicas agree on which edit stands.
    expect(boardA.elements()).toEqual(boardB.elements())
  })

  it('syncs small images and skips oversized ones', () => {
    const [a, b] = [makeReplica(1), makeReplica(2)]
    connect(a, b)
    const boardA = createBoardBinding(a)
    const boardB = createBoardBinding(b)
    const file = {
      id: 'f1',
      dataURL: 'data:image/png;base64,AAAA',
      mimeType: 'image/png',
      created: 1,
    }
    const huge = { ...file, id: 'f2', dataURL: 'x'.repeat(3_000_000) }
    boardA.applyLocal([], [file, huge])
    expect(boardB.files().map((f) => f.id)).toEqual(['f1'])
  })

  it('keeps writing when the caller mutates its element objects in place (Excalidraw does)', () => {
    const [a, b] = [makeReplica(1), makeReplica(2)]
    connect(a, b)
    const boardA = createBoardBinding(a)
    const boardB = createBoardBinding(b)
    const live = el('r1', 1, { width: 0 })
    boardA.applyLocal([live])
    live.version = 2
    live.width = 120
    boardA.applyLocal([live])
    live.version = 3
    live.width = 240
    boardA.applyLocal([live])
    expect(boardB.elements()[0]).toMatchObject({ version: 3, width: 240 })
  })

  it('hands out copies, so mutating what elements() returned cannot corrupt the binding', () => {
    const [a, b] = [makeReplica(1), makeReplica(2)]
    connect(a, b)
    const boardA = createBoardBinding(a)
    const boardB = createBoardBinding(b)
    boardA.applyLocal([el('r1', 1)])
    const [given] = boardB.elements()
    given!.version = 2
    given!.x = 50
    boardB.applyLocal([given!])
    expect(boardA.elements()[0]).toMatchObject({ version: 2, x: 50 })
  })

  it('skips malformed elements', () => {
    const doc = makeReplica(1)
    const board = createBoardBinding(doc)
    board.applyLocal([{ id: 'x' } as unknown as BoardElement, el('ok', 1)])
    expect(board.elements().map((e) => e.id)).toEqual(['ok'])
  })
})
