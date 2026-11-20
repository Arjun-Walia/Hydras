/**
 * Re-attach the current room to its folder on this machine, if it has one.
 * - Desktop: the shell reopens the remembered root (only if the user picked it before).
 * - Browser: the stored directory handle needs permission again after a reload, which a
 *   browser only grants from a click, so we expose `reconnect` for a button.
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Room } from '@hydras/sync'
import { useUiStore } from '../../app/ui-store'
import {
  BrowserFolderHost,
  hasWritePermission,
  requestWritePermission,
} from '../../platform/browser-folder'
import { DesktopFolderHost, reopenDesktopFolder } from '../../platform/desktop-folder'
import { forgetFolderLink, loadFolderLink } from '../../platform/folder-links'

export type FolderLinkState =
  | { kind: 'none' }
  | { kind: 'linked' }
  | { kind: 'needs-permission'; name: string; reconnect: () => Promise<void> }
  | { kind: 'error'; message: string }

function onMirrorError(message: string) {
  toast.error(message)
}

export function useFolderLink(room: Room): FolderLinkState {
  const [state, setState] = useState<FolderLinkState>({ kind: 'none' })
  const setFolderRoot = useUiStore((s) => s.setFolderRoot)

  const linkBrowser = useCallback(
    (handle: FileSystemDirectoryHandle) => {
      room.linkFolder(new BrowserFolderHost(handle), { onError: onMirrorError })
      setState({ kind: 'linked' })
    },
    [room],
  )

  useEffect(() => {
    let cancelled = false
    setFolderRoot(null)
    void (async () => {
      const link = await loadFolderLink(room.slug)
      if (cancelled || !link) return
      try {
        if (link.kind === 'desktop') {
          const info = await reopenDesktopFolder(link.root)
          if (cancelled) return
          room.linkFolder(new DesktopFolderHost(info.root, info.name), { onError: onMirrorError })
          setFolderRoot(info.root)
          setState({ kind: 'linked' })
          return
        }
        if (await hasWritePermission(link.handle)) {
          if (!cancelled) linkBrowser(link.handle)
          return
        }
        if (cancelled) return
        setState({
          kind: 'needs-permission',
          name: link.name,
          reconnect: async () => {
            if (await requestWritePermission(link.handle)) linkBrowser(link.handle)
            else toast.error(`Hydras needs permission to edit ${link.name}`)
          },
        })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setState({ kind: 'error', message })
        toast.error(`Could not reopen ${link.name}: ${message}`)
        if (link.kind === 'desktop') await forgetFolderLink(room.slug)
      }
    })()
    return () => {
      cancelled = true
      setFolderRoot(null)
    }
  }, [room, linkBrowser, setFolderRoot])

  return state
}
