/**
 * @hydras/sync: the only package that touches Yjs and the network.
 * Invariant: imports nothing from React; the UI consumes Readable values and methods.
 */
export { createRoom } from './room'
export type {
  FileBinding,
  FolderState,
  InspectorSnapshot,
  Room,
  RoomOptions,
  UpdateLogEntry,
} from './room'
export { initialConnectionState, isLive, reduceConnection } from './connection'
export type { ConnectionEvent, ConnectionState, ConnectionStatus, MergeReport } from './connection'
export { resolveDisplayNames, validateFilePath, withCopySuffix } from './files'
export { MIRROR_LIMITS } from './folder-mirror'
export type {
  FolderEntry,
  FolderHost,
  LinkOptions,
  MirrorStatus,
  ReadResult,
} from './folder-mirror'
export { buildFileTree } from './file-tree'
export type { TreeNode, TreeFile, TreeFolder } from './file-tree'
export type { Readable } from './observable'
export type { OriginKind } from './origins'
export type { StateVectorEntry } from './inspect'
export type { UndoState } from './undo'
