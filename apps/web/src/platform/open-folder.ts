/**
 * "Open folder": pick a folder (native dialog on desktop, File System Access API in
 * Chrome/Edge), start a new room for it, remember the link, and go there.
 */
import type { Room } from '@hydras/sync'
import { ROOM_SLUG_PATTERN } from '@hydras/shared'
import { isDesktopApp } from '../app/platform'
import { navigate } from '../app/route'
import { canOpenFoldersInBrowser, pickBrowserFolder, BrowserFolderHost } from './browser-folder'
import { pickDesktopFolder, DesktopFolderHost } from './desktop-folder'
import { saveFolderLink } from './folder-links'

export function canOpenFolders(): boolean {
  return isDesktopApp() || canOpenFoldersInBrowser()
}

/** "My Project_v2" -> "my-project-v2-3fa1". Always passes ROOM_SLUG_PATTERN. */
export function slugForFolder(name: string, random: () => number = Math.random): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36) || 'project'
  const suffix = Math.floor(random() * 0x10000)
    .toString(16)
    .padStart(4, '0')
  const slug = `${base}-${suffix}`
  return ROOM_SLUG_PATTERN.test(slug) ? slug : `project-${suffix}`
}

/** Returns false if the user cancelled. Throws on real errors. */
export async function openFolder(): Promise<boolean> {
  if (isDesktopApp()) {
    const picked = await pickDesktopFolder()
    if (!picked) return false
    const slug = slugForFolder(picked.name)
    await saveFolderLink(slug, { kind: 'desktop', root: picked.root, name: picked.name })
    navigate(`/r/${slug}`)
    return true
  }
  const handle = await pickBrowserFolder()
  if (!handle) return false
  const slug = slugForFolder(handle.name)
  await saveFolderLink(slug, { kind: 'browser', handle, name: handle.name })
  navigate(`/r/${slug}`)
  return true
}

/** Keep the current room and its permissions when attaching a folder. */
export async function attachFolder(room: Room): Promise<void> {
  if (room.readOnly) throw Error('Viewers cannot host folders')
  if (isDesktopApp()) {
    const picked = await pickDesktopFolder()
    if (!picked) return
    await saveFolderLink(room.slug, { kind: 'desktop', root: picked.root, name: picked.name })
    room.linkFolder(new DesktopFolderHost(picked.root, picked.name))
  } else {
    const handle = await pickBrowserFolder()
    if (!handle) return
    await saveFolderLink(room.slug, { kind: 'browser', handle, name: handle.name })
    room.linkFolder(new BrowserFolderHost(handle))
  }
}
