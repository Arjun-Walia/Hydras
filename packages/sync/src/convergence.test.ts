/**
 * Property tests for the headline guarantee: no lost characters, regardless of delivery
 * order, duplication, or network partitions. We don't re-prove Yjs; we prove our usage of it
 * (one Y.Text per file, state-vector exchange on reconnect) holds end to end.
 */
import * as Y from 'yjs'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { REMOTE_ORIGIN, makeReplica, syncAll } from './test-utils'
import { LOCAL_ORIGIN } from './origins'

const REPLICAS = 4

type Op =
  | { kind: 'insert'; replica: number; at: number; value: string }
  | { kind: 'delete'; replica: number; at: number; length: number }

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('insert' as const),
    replica: fc.integer({ min: 0, max: REPLICAS - 1 }),
    at: fc.double({ min: 0, max: 1, noNaN: true }),
    value: fc.string({ minLength: 1, maxLength: 4 }),
  }),
  fc.record({
    kind: fc.constant('delete' as const),
    replica: fc.integer({ min: 0, max: REPLICAS - 1 }),
    at: fc.double({ min: 0, max: 1, noNaN: true }),
    length: fc.integer({ min: 1, max: 3 }),
  }),
)

function applyOp(doc: Y.Doc, op: Op): void {
  const text = doc.getText('file')
  const index = Math.floor(op.at * text.length)
  doc.transact(() => {
    if (op.kind === 'insert') text.insert(index, op.value)
    else if (text.length > index) text.delete(index, Math.min(op.length, text.length - index))
  }, LOCAL_ORIGIN)
}

function replicas(): Y.Doc[] {
  return Array.from({ length: REPLICAS }, (_, i) => makeReplica(i + 1))
}

function texts(docs: readonly Y.Doc[]): string[] {
  return docs.map((d) => d.getText('file').toString())
}

describe('convergence', () => {
  it('replicas converge after random edits delivered in random order with duplicates', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), fc.integer(), (ops, seed) => {
        const docs = replicas()
        const log: Uint8Array[] = []
        docs.forEach((d) =>
          d.on('update', (u: Uint8Array, origin: unknown) => {
            if (origin === LOCAL_ORIGIN) log.push(u)
          }),
        )
        for (const op of ops) applyOp(docs[op.replica]!, op)

        // Deliver every update to every replica in a shuffled order, each one twice.
        const delivery = fc.sample(
          fc.shuffledSubarray([...log, ...log], { minLength: log.length * 2 }),
          {
            seed,
            numRuns: 1,
          },
        )[0]!
        for (const doc of docs) for (const u of delivery) Y.applyUpdate(doc, u, REMOTE_ORIGIN)

        const result = texts(docs)
        expect(new Set(result).size).toBe(1)
      }),
      { numRuns: 150 },
    )
  })

  it('a partitioned network merges into one document with every surviving insert', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 12 }),
        (words) => {
          const docs = replicas()
          // Two groups edit independently (offline from each other).
          words.forEach((word, i) => {
            const doc = docs[i % REPLICAS]!
            const text = doc.getText('file')
            doc.transact(() => text.insert(text.length, `${word}|`), LOCAL_ORIGIN)
            syncAll(i % 2 === 0 ? [docs[0]!, docs[2]!] : [docs[1]!, docs[3]!])
          })

          syncAll(docs)

          const merged = texts(docs)
          expect(new Set(merged).size).toBe(1)
          for (const word of words) expect(merged[0]).toContain(`${word}|`)
          expect(merged[0]!.length).toBe(words.reduce((n, w) => n + w.length + 1, 0))
        },
      ),
      { numRuns: 150 },
    )
  })

  it('applying the same update twice is a no-op (idempotent reconnect)', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 30 }), (ops) => {
        const [source, target] = [makeReplica(1), makeReplica(2)]
        for (const op of ops) applyOp(source, op)
        const update = Y.encodeStateAsUpdate(source)

        Y.applyUpdate(target, update, REMOTE_ORIGIN)
        const once = Y.encodeStateVector(target)
        const textOnce = target.getText('file').toString()
        Y.applyUpdate(target, update, REMOTE_ORIGIN)

        expect(target.getText('file').toString()).toBe(textOnce)
        expect(Y.encodeStateVector(target)).toEqual(once)
      }),
    )
  })
})
