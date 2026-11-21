/**
 * A room created in this tab has no password and no collaborators yet. If the sync
 * host is unreachable, the editor should still open: that is the offline path, and
 * it is also how the public site can be tried when no server is deployed.
 *
 * The mark is per tab, so a shared link to someone else's room never qualifies.
 */
const FRESH_ROOM_KEY = 'hydras:fresh-room'

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

export function rememberFreshRoom(
  slug: string,
  storage: StorageLike | null = browserStorage(),
): void {
  storage?.setItem(FRESH_ROOM_KEY, slug)
}

export function isFreshRoom(slug: string, storage: StorageLike | null = browserStorage()): boolean {
  return storage?.getItem(FRESH_ROOM_KEY) === slug
}
