/**
 * Transaction origins. Every Yjs transaction carries one; per-user undo, the
 * pending-changes counter and the folder mirror all depend on telling them apart.
 *
 * - LOCAL_ORIGIN: text edits made by this user outside the editor binding (tests, commands).
 *   The CodeMirror binding adds its own origin to the undo manager at runtime.
 * - FILES_ORIGIN: file-tree mutations. Never tracked by text undo.
 * - DISK_ORIGIN: changes read from the opened folder on disk (git checkout, another editor,
 *   the terminal). Never tracked by undo and never written back to disk (no echo loop).
 * Remote updates carry the provider instance; IndexedDB loads carry the persistence instance.
 */
export const LOCAL_ORIGIN: unique symbol = Symbol('hydras.local')
export const FILES_ORIGIN: unique symbol = Symbol('hydras.files')
export const DISK_ORIGIN: unique symbol = Symbol('hydras.disk')
/** Whiteboard (Excalidraw) writes. Text undo ignores them; Excalidraw keeps its own history. */
export const BOARD_ORIGIN: unique symbol = Symbol('hydras.board')

export type OriginKind = 'local' | 'files' | 'disk' | 'board' | 'remote' | 'storage'

export function classifyOrigin(
  origin: unknown,
  sources: { remote: unknown; storage: unknown },
): OriginKind {
  if (origin === FILES_ORIGIN) return 'files'
  if (origin === DISK_ORIGIN) return 'disk'
  if (origin === BOARD_ORIGIN) return 'board'
  if (origin === sources.remote) return 'remote'
  if (origin === sources.storage) return 'storage'
  return 'local'
}
