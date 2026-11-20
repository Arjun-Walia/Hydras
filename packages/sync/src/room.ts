/**
 * Room lifecycle: one room = one Y.Doc, persisted locally and relayed through Hocuspocus.
 *
 * Boot order (local-first):
 *   1. Y.Doc is created and IndexedDB starts loading into it.
 *   2. Only after IndexedDB has loaded does the socket connect, so the editor works offline
 *      right after a reload, and the "seed starter files" check never races the server.
 *   3. After the first server sync, an empty room is seeded with starter files.
 *
 * Everything the UI needs is exposed as Readable values or plain methods. The UI never sees
 * the Y.Doc; it only passes FileBinding objects straight through to the editor package.
 */
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { Awareness } from 'y-protocols/awareness'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import type { FileEntry, Peer, Presence, UserIdentity } from '@hydras/shared'
import {
  initialConnectionState,
  reduceConnection,
  type ConnectionEvent,
  type ConnectionState,
} from './connection'
import * as files from './files'
import {
  linkFolder,
  type FolderHost,
  type FolderLink,
  type LinkOptions,
  type MirrorStatus,
} from './folder-mirror'
import { describeStateVector, docSizeBytes, type StateVectorEntry } from './inspect'
import { writable, type Readable } from './observable'
import { classifyOrigin, type OriginKind } from './origins'
import { STARTER_FILES } from './starter'
import { createUndoManager, emptyUndoState, readUndoState, type UndoState } from './undo'

const RECENT_UPDATE_LIMIT = 24
const INSPECTOR_THROTTLE_MS = 200

/** Everything the editor needs to bind one file. Opaque to the UI layer. */
export interface FileBinding {
  readonly fileId: string
  readonly text: Y.Text
  readonly awareness: Awareness
  readonly undoManager: Y.UndoManager
}

export interface UpdateLogEntry {
  seq: number
  at: number
  origin: OriginKind
  bytes: number
}

export interface InspectorSnapshot {
  clientId: number
  stateVector: StateVectorEntry[]
  docBytes: number
  recentUpdates: UpdateLogEntry[]
}

export interface RoomOptions {
  slug: string
  serverUrl: string
  user: UserIdentity
  /** Seed an empty room with starter files after first sync. Off for folder rooms. */
  seedStarterFiles?: boolean
}

export interface FolderState {
  name: string
  status: MirrorStatus
}

export interface Room {
  readonly slug: string
  readonly connection: Readable<ConnectionState>
  readonly files: Readable<FileEntry[]>
  readonly peers: Readable<Peer[]>
  readonly inspector: Readable<InspectorSnapshot>
  /** Undo state of the file most recently passed to `setActiveFile`. */
  readonly activeUndo: Readable<UndoState>
  /** Resolves once the local IndexedDB copy has been loaded. */
  readonly ready: Promise<void>
  /** The folder on this machine mirrored into the room, if any. */
  readonly folder: Readable<FolderState | null>
  /** Mirror a folder into the room (replaces any current link). */
  linkFolder(host: FolderHost, options?: LinkOptions): void
  unlinkFolder(): Promise<void>
  createFile(name: string, content?: string): string
  renameFile(id: string, name: string): void
  deleteFile(id: string): void
  restoreFile(id: string): void
  bindFile(id: string): FileBinding | null
  setActiveFile(id: string | null): void
  undo(id: string): void
  redo(id: string): void
  goOffline(): void
  goOnline(): void
  destroy(): void
}

function readPeers(awareness: Awareness): Peer[] {
  const peers: Peer[] = []
  awareness.getStates().forEach((state, clientId) => {
    const presence = state as Partial<Presence>
    if (!presence.user) return
    peers.push({
      user: presence.user,
      activeFile: presence.activeFile ?? null,
      viewport: presence.viewport ?? null,
      status: presence.status ?? 'active',
      clientId,
      isSelf: clientId === awareness.clientID,
    })
  })
  return peers.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.clientId - b.clientId)
}

export function createRoom({ slug, serverUrl, user, seedStarterFiles = true }: RoomOptions): Room {
  const doc = new Y.Doc()
  const storage = new IndexeddbPersistence(`hydras:${slug}`, doc)
  const socket = new HocuspocusProviderWebsocket({ url: serverUrl, autoConnect: false })
  const provider = new HocuspocusProvider({ name: slug, document: doc, websocketProvider: socket })
  provider.attach()

  const awareness = provider.awareness
  if (!awareness) throw new Error('Hocuspocus provider was created without awareness')

  const initialPresence: Presence = { user, activeFile: null, viewport: null, status: 'active' }
  awareness.setLocalState(initialPresence)

  const connection = writable<ConnectionState>(initialConnectionState)
  const dispatch = (event: ConnectionEvent) => connection.update((s) => reduceConnection(s, event))

  const fileList = writable<FileEntry[]>(files.listFiles(doc))
  const peers = writable<Peer[]>(readPeers(awareness))
  const activeUndo = writable<UndoState>(emptyUndoState)
  const inspector = writable<InspectorSnapshot>({
    clientId: doc.clientID,
    stateVector: [],
    docBytes: 0,
    recentUpdates: [],
  })

  const bindings = new Map<string, FileBinding>()
  const folder = writable<FolderState | null>(null)
  let folderLink: FolderLink | null = null
  let stopFolderStatus: (() => void) | null = null
  let activeFileId: string | null = null
  let updateSeq = 0
  let inspectorTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  // --- document observers -------------------------------------------------------------
  const refreshInspector = () => {
    inspectorTimer = null
    inspector.update((current) => ({
      ...current,
      stateVector: describeStateVector(doc),
      docBytes: docSizeBytes(doc),
    }))
  }

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    const kind = classifyOrigin(origin, { remote: provider, storage })
    if (kind === 'local' || kind === 'files') dispatch({ type: 'local-change' })
    const entry: UpdateLogEntry = {
      seq: ++updateSeq,
      at: Date.now(),
      origin: kind,
      bytes: update.byteLength,
    }
    inspector.update((current) => ({
      ...current,
      recentUpdates: [entry, ...current.recentUpdates].slice(0, RECENT_UPDATE_LIMIT),
    }))
    inspectorTimer ??= setTimeout(refreshInspector, INSPECTOR_THROTTLE_MS)
  }
  doc.on('update', onUpdate)

  const onFilesChanged = () => fileList.set(files.listFiles(doc))
  files.filesMap(doc).observeDeep(onFilesChanged)

  const onAwarenessChange = () => peers.set(readPeers(awareness))
  awareness.on('change', onAwarenessChange)

  // --- connection wiring --------------------------------------------------------------
  let seeded = !seedStarterFiles
  const seedIfEmpty = () => {
    if (seeded) return
    seeded = true
    if (files.listFiles(doc).length > 0 || folderLink) return
    for (const file of STARTER_FILES) files.createFile(doc, file)
  }

  provider.on('status', ({ status }: { status: string }) => {
    if (status === 'connecting') dispatch({ type: 'socket-connecting' })
    else if (status === 'connected') dispatch({ type: 'socket-open' })
    else dispatch({ type: 'socket-closed' })
  })
  provider.on('synced', ({ state }: { state: boolean }) => {
    if (!state) return
    dispatch({ type: 'synced', at: Date.now() })
    seedIfEmpty()
  })

  const ready = storage.whenSynced.then(() => {
    if (destroyed) return
    refreshInspector()
    void socket.connect()
  })

  // --- undo ---------------------------------------------------------------------------
  const refreshActiveUndo = () => {
    const binding = activeFileId ? bindings.get(activeFileId) : undefined
    activeUndo.set(binding ? readUndoState(binding.undoManager) : emptyUndoState)
  }

  const bindFile = (id: string): FileBinding | null => {
    const existing = bindings.get(id)
    if (existing) return existing
    const text = files.getFileText(doc, id)
    if (!text) return null
    const undoManager = createUndoManager(text)
    const onStackChange = () => {
      if (id === activeFileId) refreshActiveUndo()
    }
    undoManager.on('stack-item-added', onStackChange)
    undoManager.on('stack-item-popped', onStackChange)
    undoManager.on('stack-cleared', onStackChange)
    const binding: FileBinding = { fileId: id, text, awareness, undoManager }
    bindings.set(id, binding)
    return binding
  }

  // --- public API ---------------------------------------------------------------------
  return {
    slug,
    connection,
    files: fileList,
    peers,
    inspector,
    activeUndo,
    ready,
    folder,
    linkFolder(host, options) {
      stopFolderStatus?.()
      folderLink?.unlink()
      const link = linkFolder(doc, host, options)
      folderLink = link
      const publish = () => folder.set({ name: link.folderName, status: link.status.get() })
      publish()
      stopFolderStatus = link.status.subscribe(publish)
    },
    async unlinkFolder() {
      const link = folderLink
      if (!link) return
      await link.flush()
      stopFolderStatus?.()
      link.unlink()
      folderLink = null
      folder.set(null)
    },
    createFile: (name, content) => files.createFile(doc, { name, content: content ?? '' }),
    renameFile: (id, name) => files.renameFile(doc, id, name),
    deleteFile: (id) => files.deleteFile(doc, id),
    restoreFile: (id) => files.restoreFile(doc, id),
    bindFile,
    setActiveFile(id) {
      activeFileId = id
      if (id) bindFile(id)
      awareness.setLocalStateField('activeFile', id)
      refreshActiveUndo()
    },
    undo: (id) => {
      bindFile(id)?.undoManager.undo()
    },
    redo: (id) => {
      bindFile(id)?.undoManager.redo()
    },
    goOffline() {
      dispatch({ type: 'force-offline' })
      socket.disconnect()
    },
    goOnline() {
      dispatch({ type: 'force-online' })
      void socket.connect()
    },
    destroy() {
      destroyed = true
      if (inspectorTimer) clearTimeout(inspectorTimer)
      stopFolderStatus?.()
      if (folderLink) {
        const link = folderLink
        void link.flush().finally(() => link.unlink())
      }
      doc.off('update', onUpdate)
      files.filesMap(doc).unobserveDeep(onFilesChanged)
      awareness.off('change', onAwarenessChange)
      for (const binding of bindings.values()) binding.undoManager.destroy()
      bindings.clear()
      provider.destroy()
      socket.destroy()
      void storage.destroy()
      doc.destroy()
    },
  }
}
