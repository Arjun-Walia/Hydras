/**
 * User-facing commands shared by the palette, toolbar and file tree. Each one turns
 * sync-layer errors into toasts instead of letting them escape into React.
 */
import { toast } from 'sonner'
import type { Room } from '@hydras/sync'
import { canOpenFolders, openFolder } from '../platform/open-folder'
import { roomUrl } from './route'
import { useUiStore } from './ui-store'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function createFileAction(room: Room, name: string): void {
  try {
    const id = room.createFile(name)
    useUiStore.getState().openFile(id)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

export function renameFileAction(room: Room, id: string, name: string): void {
  try {
    room.renameFile(id, name)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

export function deleteFileAction(room: Room, id: string, displayName: string): void {
  room.deleteFile(id)
  useUiStore.getState().closeTab(id)
  toast(`Moved ${displayName} to Trash`, {
    action: { label: 'Restore', onClick: () => room.restoreFile(id) },
  })
}

export function toggleOfflineAction(room: Room): void {
  if (room.connection.get().forcedOffline) room.goOnline()
  else room.goOffline()
}

export async function openFolderAction(): Promise<void> {
  if (!canOpenFolders()) {
    toast.error('Opening folders needs the desktop app, or Chrome / Edge')
    return
  }
  try {
    await openFolder()
  } catch (error) {
    toast.error(`Could not open folder: ${errorMessage(error)}`)
  }
}

export async function copyInviteAction(slug: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(roomUrl(slug))
    toast.success('Invite link copied')
  } catch {
    toast.error('Could not access the clipboard')
  }
}
