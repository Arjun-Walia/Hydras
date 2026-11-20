/**
 * Test helpers: in-memory replicas wired together by hand, so tests control exactly
 * when updates are delivered (live, partitioned, duplicated, reordered).
 * Not exported from the package entry point.
 */
import * as Y from 'yjs'
import { LOCAL_ORIGIN } from './origins'

/** Origin used when a test delivers an update from another replica. */
export const REMOTE_ORIGIN: unique symbol = Symbol('test.remote')

export function makeReplica(clientId: number): Y.Doc {
  const doc = new Y.Doc()
  doc.clientID = clientId
  return doc
}

/** Apply everything `from` has that `to` lacks, using the real state-vector diff. */
export function syncOneWay(from: Y.Doc, to: Y.Doc): void {
  const diff = Y.encodeStateAsUpdate(from, Y.encodeStateVector(to))
  Y.applyUpdate(to, diff, REMOTE_ORIGIN)
}

export function syncAll(docs: readonly Y.Doc[]): void {
  for (const a of docs) for (const b of docs) if (a !== b) syncOneWay(a, b)
}

/** Keep two replicas live-connected: every update on one is applied to the other. */
export function connect(a: Y.Doc, b: Y.Doc): () => void {
  const forward = (target: Y.Doc) => (update: Uint8Array, origin: unknown) => {
    if (origin !== REMOTE_ORIGIN) Y.applyUpdate(target, update, REMOTE_ORIGIN)
  }
  const ab = forward(b)
  const ba = forward(a)
  a.on('update', ab)
  b.on('update', ba)
  return () => {
    a.off('update', ab)
    b.off('update', ba)
  }
}

export function typeAt(text: Y.Text, index: number, value: string): void {
  text.doc?.transact(() => text.insert(index, value), LOCAL_ORIGIN)
}

export function deleteAt(text: Y.Text, index: number, length: number): void {
  text.doc?.transact(() => text.delete(index, length), LOCAL_ORIGIN)
}
