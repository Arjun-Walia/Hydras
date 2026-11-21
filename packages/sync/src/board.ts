/**
 * The room's whiteboard (Excalidraw), synced through the same Y.Doc as the code.
 *
 * Model:
 *   doc.getMap('board')       : Y.Map<elementId, string>   JSON of one Excalidraw element
 *   doc.getMap('boardFiles')  : Y.Map<fileId, string>      JSON of one image (data URL)
 *
 * Merge rule (the one Excalidraw's own collaboration uses): every element carries a
 * `version` that increases on each local change, and a random `versionNonce`. The higher
 * version wins; on a tie the lower nonce wins, so every client picks the same element.
 * Deleted elements are kept as tombstones (`isDeleted: true`) so a delete can't be undone
 * by a stale copy arriving later.
 *
 * Invariant: this module knows nothing about React or Excalidraw's API; it moves plain
 * element objects in and out of the doc. Writes use BOARD_ORIGIN, which text undo ignores.
 */
import type * as Y from 'yjs'
import { BOARD_ORIGIN } from './origins'

/** The fields we rely on; everything else in an Excalidraw element is carried as-is. */
export interface BoardElement {
  id: string
  version: number
  versionNonce: number
  isDeleted?: boolean
  /** Fractional z-order index (Excalidraw 0.17+). */
  index?: string | null
  [key: string]: unknown
}

export interface BoardFile {
  id: string
  dataURL: string
  mimeType: string
  created: number
  [key: string]: unknown
}

export interface BoardBinding {
  /** Every element in the room, tombstones included, in z-order. */
  elements(): BoardElement[]
  files(): BoardFile[]
  /** Push local changes; only elements newer than the room's copy are written. */
  applyLocal(elements: readonly BoardElement[], files?: readonly BoardFile[]): void
  /** Called with the full element list after a change from someone else (or storage). */
  subscribe(listener: (elements: BoardElement[], files: BoardFile[]) => void): () => void
}

/** Images bigger than this are not synced (they would bloat every client's copy). */
export const MAX_BOARD_FILE_BYTES = 2_000_000

/** True when `incoming` should replace `current` (see the merge rule above). */
export function isNewer(incoming: BoardElement, current: BoardElement | undefined): boolean {
  if (!current) return true
  if (incoming.version !== current.version) return incoming.version > current.version
  return incoming.versionNonce < current.versionNonce
}

/** Merge two element lists by id with the version rule, then order by z-index. */
export function mergeElements(
  local: readonly BoardElement[],
  remote: readonly BoardElement[],
): BoardElement[] {
  const byId = new Map<string, BoardElement>()
  for (const element of local) byId.set(element.id, element)
  for (const element of remote) {
    if (isNewer(element, byId.get(element.id))) byId.set(element.id, element)
  }
  return sortByIndex([...byId.values()])
}

export function sortByIndex(elements: BoardElement[]): BoardElement[] {
  return elements.sort((a, b) => {
    const ai = a.index ?? ''
    const bi = b.index ?? ''
    if (ai !== bi) return ai < bi ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

function parse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

function isElement(value: unknown): value is BoardElement {
  const v = value as BoardElement | null
  return (
    v != null &&
    typeof v.id === 'string' &&
    typeof v.version === 'number' &&
    typeof v.versionNonce === 'number'
  )
}

export function createBoardBinding(doc: Y.Doc): BoardBinding {
  const map = doc.getMap<string>('board')
  const fileMap = doc.getMap<string>('boardFiles')
  /** Parsed elements keyed by id, remembering the JSON they came from (cheap re-reads). */
  const cache = new Map<string, { json: string; element: BoardElement }>()

  const parsedAt = (id: string, json: string): BoardElement | undefined => {
    const hit = cache.get(id)
    if (hit && hit.json === json) return hit.element
    const parsed = parse<unknown>(json)
    if (!isElement(parsed)) return undefined
    cache.set(id, { json, element: parsed })
    return parsed
  }

  /**
   * Callers get copies, never the cached objects: Excalidraw mutates the elements it is
   * given in place, which would silently corrupt the version comparison in applyLocal.
   */
  const readAll = (): BoardElement[] => {
    const out: BoardElement[] = []
    map.forEach((json, id) => {
      const element = parsedAt(id, json)
      if (element) out.push(structuredClone(element))
    })
    return sortByIndex(out)
  }

  const readFiles = (): BoardFile[] => {
    const out: BoardFile[] = []
    fileMap.forEach((json) => {
      const file = parse<BoardFile>(json)
      if (file && typeof file.id === 'string' && typeof file.dataURL === 'string') out.push(file)
    })
    return out
  }

  return {
    elements: readAll,
    files: readFiles,
    applyLocal(elements, files = []) {
      doc.transact(() => {
        for (const element of elements) {
          if (!isElement(element)) continue
          const stored = map.get(element.id)
          const current = stored === undefined ? undefined : parsedAt(element.id, stored)
          if (!isNewer(element, current)) continue
          const json = JSON.stringify(element)
          map.set(element.id, json)
          // Cache a detached copy: Excalidraw mutates its element objects in place, so
          // keeping its reference would make the next change look "not newer".
          cache.set(element.id, { json, element: JSON.parse(json) as BoardElement })
        }
        for (const file of files) {
          if (fileMap.has(file.id) || file.dataURL.length > MAX_BOARD_FILE_BYTES) continue
          fileMap.set(file.id, JSON.stringify(file))
        }
      }, BOARD_ORIGIN)
    },
    subscribe(listener) {
      const notify = (_events: unknown, tx: Y.Transaction) => {
        if (tx.origin === BOARD_ORIGIN) return
        listener(readAll(), readFiles())
      }
      map.observe(notify)
      fileMap.observe(notify)
      return () => {
        map.unobserve(notify)
        fileMap.unobserve(notify)
      }
    },
  }
}
