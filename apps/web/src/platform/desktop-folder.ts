/**
 * FolderHost backed by the desktop shell's Rust commands (apps/desktop/src-tauri).
 * The shell only accepts roots the user picked in its native dialog.
 */
import { Channel, invoke } from '@tauri-apps/api/core'
import type { FolderEntry, FolderHost, ReadResult } from '@hydras/sync'

export interface DesktopFolderInfo {
  root: string
  name: string
}

export class DesktopFolderHost implements FolderHost {
  constructor(
    readonly root: string,
    readonly name: string,
  ) {}

  list(): Promise<FolderEntry[]> {
    return invoke<FolderEntry[]>('folder_list', { root: this.root })
  }

  read(path: string): Promise<ReadResult> {
    return invoke<ReadResult>('folder_read', { root: this.root, path })
  }

  write(path: string, text: string): Promise<void> {
    return invoke('folder_write', { root: this.root, path, text })
  }

  watch(onChange: (paths: string[]) => void): () => void {
    const channel = new Channel<string[]>()
    channel.onmessage = onChange
    let watchId: number | null = null
    let stopped = false
    invoke<number>('folder_watch', { root: this.root, onChange: channel })
      .then((id) => {
        if (stopped) void invoke('folder_unwatch', { id })
        else watchId = id
      })
      .catch(() => {
        /* watching is best-effort; edits still sync on reopen */
      })
    return () => {
      stopped = true
      if (watchId !== null) void invoke('folder_unwatch', { id: watchId })
    }
  }
}

export function pickDesktopFolder(): Promise<DesktopFolderInfo | null> {
  return invoke<DesktopFolderInfo | null>('folder_pick')
}

export function reopenDesktopFolder(root: string): Promise<DesktopFolderInfo> {
  return invoke<DesktopFolderInfo>('folder_reopen', { root })
}
