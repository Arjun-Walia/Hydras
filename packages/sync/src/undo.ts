/**
 * Per-user, per-file undo.
 *
 * Y.UndoManager only records transactions whose origin is in `trackedOrigins`. We track
 * LOCAL_ORIGIN here; the CodeMirror binding adds its own origin when it mounts. Remote
 * updates (origin = provider) and IndexedDB loads (origin = persistence) are never tracked,
 * so undo reverts only this user's changes, even when others edited around them.
 *
 * Known limitation: the stack lives in memory and is cleared on reload.
 */
import * as Y from 'yjs'
import { UNDO_CAPTURE_TIMEOUT_MS } from '@hydras/shared'
import { LOCAL_ORIGIN } from './origins'

export function createUndoManager(
  text: Y.Text,
  captureTimeout: number = UNDO_CAPTURE_TIMEOUT_MS,
): Y.UndoManager {
  return new Y.UndoManager(text, {
    captureTimeout,
    trackedOrigins: new Set<unknown>([LOCAL_ORIGIN]),
  })
}

export interface UndoState {
  canUndo: boolean
  canRedo: boolean
  undoDepth: number
  redoDepth: number
}

export const emptyUndoState: UndoState = {
  canUndo: false,
  canRedo: false,
  undoDepth: 0,
  redoDepth: 0,
}

export function readUndoState(manager: Y.UndoManager): UndoState {
  return {
    canUndo: manager.canUndo(),
    canRedo: manager.canRedo(),
    undoDepth: manager.undoStack.length,
    redoDepth: manager.redoStack.length,
  }
}
