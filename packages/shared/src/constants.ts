/** Fixed values shared by client and server. */

/** Burst of typing grouped into one undo step (ms). */
export const UNDO_CAPTURE_TIMEOUT_MS = 500

/** Seconds of no input before presence becomes idle. */
export const IDLE_AFTER_MS = 30_000

export const DEFAULT_SYNC_URL = 'ws://localhost:1234'

export const ROOM_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/
