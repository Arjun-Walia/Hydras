/**
 * Minimal observable value. The UI reads these through React's useSyncExternalStore;
 * the sync layer stays framework-free.
 * Invariant: `set` replaces the value (never mutates it), and listeners fire only on change.
 */

export interface Readable<T> {
  get(): T
  subscribe(listener: () => void): () => void
}

export interface Writable<T> extends Readable<T> {
  set(next: T): void
  update(fn: (current: T) => T): void
}

export function writable<T>(initial: T): Writable<T> {
  let value = initial
  const listeners = new Set<() => void>()

  const set = (next: T) => {
    if (Object.is(next, value)) return
    value = next
    for (const listener of [...listeners]) listener()
  }

  return {
    get: () => value,
    set,
    update: (fn) => set(fn(value)),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
