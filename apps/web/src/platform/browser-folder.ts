/**
 * FolderHost for the browser, using the File System Access API (Chrome, Edge, Opera).
 * Browsers have no file-change events, so `watch` polls modification times.
 */
import { MIRROR_LIMITS, type FolderEntry, type FolderHost, type ReadResult } from '@hydras/sync'

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'target',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.venv',
  '__pycache__',
])
const MAX_LIST = 20_000
const POLL_MS = 2_500
const BINARY_SNIFF = 8_000

interface DirectoryPickerWindow {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}

export function canOpenFoldersInBrowser(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
}

export async function pickBrowserFolder(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) return null
  try {
    return await picker({ mode: 'readwrite' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>
}

export async function hasWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as PermissionHandle
  return (await h.queryPermission?.({ mode: 'readwrite' })) === 'granted'
}

/** Must be called from a user gesture (click). */
export async function requestWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as PermissionHandle
  return (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted'
}

async function* walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
): AsyncGenerator<{ path: string; handle: FileSystemFileHandle }> {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'directory') {
      if (!IGNORED_DIRS.has(name))
        yield* walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`)
    } else {
      yield { path: `${prefix}${name}`, handle: handle as FileSystemFileHandle }
    }
  }
}

export class BrowserFolderHost implements FolderHost {
  readonly name: string

  constructor(private readonly root: FileSystemDirectoryHandle) {
    this.name = root.name
  }

  private async snapshot(): Promise<Map<string, { size: number; modified: number }>> {
    const out = new Map<string, { size: number; modified: number }>()
    for await (const { path, handle } of walk(this.root, '')) {
      if (out.size >= MAX_LIST) break
      const file = await handle.getFile()
      out.set(path, { size: file.size, modified: file.lastModified })
    }
    return out
  }

  async list(): Promise<FolderEntry[]> {
    const snap = await this.snapshot()
    return [...snap].map(([path, { size }]) => ({ path, size }))
  }

  private async fileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
    const parts = path.split('/')
    const fileName = parts.pop()
    if (!fileName) throw new Error(`Invalid path: ${path}`)
    let dir = this.root
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create })
    return dir.getFileHandle(fileName, { create })
  }

  async read(path: string): Promise<ReadResult> {
    let file: File
    try {
      file = await (await this.fileHandle(path, false)).getFile()
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
      ) {
        return { kind: 'missing' }
      }
      throw error
    }
    if (file.size > MIRROR_LIMITS.maxFileBytes) return { kind: 'binary' }
    const text = await file.text()
    if (
      text.slice(0, BINARY_SNIFF).includes('\u0000') ||
      text.slice(0, BINARY_SNIFF).includes('�')
    ) {
      return { kind: 'binary' }
    }
    return { kind: 'text', text: text.startsWith('﻿') ? text.slice(1) : text }
  }

  async write(path: string, text: string): Promise<void> {
    const writable = await (await this.fileHandle(path, true)).createWritable()
    await writable.write(text)
    await writable.close()
  }

  watch(onChange: (paths: string[]) => void): () => void {
    let previous: Map<string, { size: number; modified: number }> | null = null
    let stopped = false
    const tick = async () => {
      if (stopped) return
      try {
        const next = await this.snapshot()
        if (previous) {
          const changed: string[] = []
          for (const [path, meta] of next) {
            const old = previous.get(path)
            if (!old || old.modified !== meta.modified || old.size !== meta.size) changed.push(path)
          }
          for (const path of previous.keys()) if (!next.has(path)) changed.push(path)
          if (changed.length > 0) onChange(changed)
        }
        previous = next
      } finally {
        if (!stopped) timer = setTimeout(() => void tick(), POLL_MS)
      }
    }
    let timer = setTimeout(() => void tick(), 0)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }
}
