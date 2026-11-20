/**
 * Own one Room for the lifetime of the workspace. Created in an effect (it opens
 * IndexedDB and a socket), destroyed on unmount or when the slug, user or sync server
 * changes. Local edits survive a server change: they live in IndexedDB and merge in.
 */
import { session } from '../app/access'
import { useEffect, useState } from 'react'
import { DEFAULT_SYNC_URL, type UserIdentity } from '@hydras/shared'
import { createRoom, type Room } from '@hydras/sync'
import { effectiveSyncUrl } from '../app/settings'
import { useSettingsStore } from '../app/settings-store'
import { hasFolderLink } from '../platform/folder-links'

const BUILD_SYNC_URL = import.meta.env.VITE_SYNC_URL ?? DEFAULT_SYNC_URL

export function useRoom(slug: string, user: UserIdentity): Room | null {
  const [room, setRoom] = useState<Room | null>(null)
  const serverUrl = useSettingsStore((s) => effectiveSyncUrl(s, BUILD_SYNC_URL))

  useEffect(() => {
    // Rooms opened from a folder get the folder's files, never the starter files.
    const credentials = session(slug)
    const created = createRoom({
      slug,
      serverUrl,
      user,
      token: credentials?.token,
      readOnly: credentials?.role === 'viewer' || credentials?.role === 'rejected',
      seedStarterFiles: !hasFolderLink(slug),
    })
    setRoom(created)
    return () => {
      created.destroy()
      setRoom(null)
    }
    // Identity changes are rare and handled by a reload; the room is keyed by slug + user id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user.id, serverUrl])

  return room
}
