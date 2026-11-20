/**
 * Read-only views of Yjs internals for the sync inspector. Nothing here mutates the doc.
 */
import * as Y from 'yjs'

export interface StateVectorEntry {
  clientId: number
  clock: number
}

/** Which operations from which clients this replica has seen, highest clock first. */
export function describeStateVector(doc: Y.Doc): StateVectorEntry[] {
  const vector = Y.decodeStateVector(Y.encodeStateVector(doc))
  return [...vector.entries()]
    .map(([clientId, clock]) => ({ clientId, clock }))
    .sort((a, b) => b.clock - a.clock)
}

export function docSizeBytes(doc: Y.Doc): number {
  return Y.encodeStateAsUpdate(doc).byteLength
}
