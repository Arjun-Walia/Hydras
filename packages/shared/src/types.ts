/**
 * Cross-layer types. Presence travels in Yjs Awareness (ephemeral);
 * FileEntry mirrors one entry of the persisted `files` map.
 */

export interface UserIdentity {
  /** Stable per-browser id (localStorage), drives the color. */
  id: string
  name: string
  /** Caret / avatar color (oklch string). */
  color: string
  /** Same hue at low alpha, used for selection fills. */
  colorLight: string
}

export interface Viewport {
  fileId: string
  topLine: number
}

export type PresenceStatus = 'active' | 'idle'

/** Where someone's pointer is on the shared whiteboard, in scene coordinates. */
export interface BoardPointer {
  x: number
  y: number
  tool: 'pointer' | 'laser'
  button: 'up' | 'down'
}

/** The awareness payload every client publishes. */
export interface Presence {
  user: UserIdentity
  activeFile: string | null
  viewport: Viewport | null
  status: PresenceStatus
  /** Set while this person has the whiteboard open. */
  boardPointer?: BoardPointer | null
}

/** A peer as the UI sees it: presence plus the Yjs client id it came from. */
export interface Peer extends Presence {
  clientId: number
  isSelf: boolean
}

export interface FileEntry {
  id: string
  name: string
  createdAt: number
  /** Soft-delete timestamp. Non-null means the file is in Trash with content intact. */
  deletedAt: number | null
  /**
   * True for a file from a large opened folder whose contents have not been loaded into
   * the room yet. The folder's host loads it from disk as soon as anyone opens it.
   */
  stub?: boolean
  /** Size on disk in bytes, when known (folder files). */
  size?: number
}
