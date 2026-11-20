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

/** The awareness payload every client publishes. */
export interface Presence {
  user: UserIdentity
  activeFile: string | null
  viewport: Viewport | null
  status: PresenceStatus
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
}
