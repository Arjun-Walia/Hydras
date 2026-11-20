/**
 * localStorage access that never throws (private windows, blocked storage).
 * Used only for per-browser conveniences: identity and theme.
 */
export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the value just won't persist across reloads.
  }
}
