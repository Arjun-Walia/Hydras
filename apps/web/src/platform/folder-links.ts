/**
 * Which folder on THIS machine belongs to which room. Per device, never synced: the room
 * is shared, the folder is the host's. Desktop links store the absolute root path in
 * localStorage; browser links store the directory handle in IndexedDB (handles can be
 * structured-cloned there, not into localStorage).
 */
import { readLocal, writeLocal } from '../app/storage'

const DESKTOP_KEY = 'hydras.folderLinks.v1'
const DB_NAME = 'hydras-folder-links'
const STORE = 'handles'

export type FolderLinkRecord =
  | { kind: 'desktop'; root: string; name: string }
  | { kind: 'browser'; handle: FileSystemDirectoryHandle; name: string }

function readDesktopLinks(): Record<string, { root: string; name: string }> {
  try {
    const parsed: unknown = JSON.parse(readLocal(DESKTOP_KEY) ?? '{}')
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, { root: string; name: string }>)
      : {}
  } catch {
    return {}
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idb<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

const BROWSER_MARKER_KEY = 'hydras.browserFolderSlugs.v1'

function readBrowserMarkers(): string[] {
  try {
    const parsed: unknown = JSON.parse(readLocal(BROWSER_MARKER_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

/** Synchronous check used before the room is created (folder rooms skip starter files). */
export function hasFolderLink(slug: string): boolean {
  return slug in readDesktopLinks() || readBrowserMarkers().includes(slug)
}

export async function saveFolderLink(slug: string, link: FolderLinkRecord): Promise<void> {
  if (link.kind === 'desktop') {
    writeLocal(
      DESKTOP_KEY,
      JSON.stringify({ ...readDesktopLinks(), [slug]: { root: link.root, name: link.name } }),
    )
    return
  }
  await idb('readwrite', (store) => store.put({ handle: link.handle, name: link.name }, slug))
  writeLocal(BROWSER_MARKER_KEY, JSON.stringify([...new Set([...readBrowserMarkers(), slug])]))
}

export async function loadFolderLink(slug: string): Promise<FolderLinkRecord | null> {
  const desktop = readDesktopLinks()[slug]
  if (desktop) return { kind: 'desktop', ...desktop }
  try {
    const stored = await idb<{ handle: FileSystemDirectoryHandle; name: string } | undefined>(
      'readonly',
      (store) => store.get(slug),
    )
    return stored ? { kind: 'browser', ...stored } : null
  } catch {
    return null
  }
}

export async function forgetFolderLink(slug: string): Promise<void> {
  const desktop = readDesktopLinks()
  if (slug in desktop) {
    const rest = Object.fromEntries(Object.entries(desktop).filter(([key]) => key !== slug))
    writeLocal(DESKTOP_KEY, JSON.stringify(rest))
  }
  writeLocal(BROWSER_MARKER_KEY, JSON.stringify(readBrowserMarkers().filter((s) => s !== slug)))
  try {
    await idb('readwrite', (store) => store.delete(slug))
  } catch {
    // nothing stored
  }
}
