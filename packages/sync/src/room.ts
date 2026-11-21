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
import { captureWorkspace, recoverWorkspace, type WorkspaceSnapshot } from './recovery'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { Awareness } from 'y-protocols/awareness'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import type { BoardPointer, FileEntry, Peer, Presence, UserIdentity } from '@hydras/shared'
import { createBoardBinding, type BoardBinding } from './board'
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
/** Local checkpoint debounce: grows with how long the last full encode took. */
const CHECKPOINT_MIN_MS = 300
const CHECKPOINT_MAX_MS = 5_000
const CHECKPOINT_COST_FACTOR = 20

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
  token?: string
  readOnly?: boolean
  seedStarterFiles?: boolean
}

export interface FolderState {
  name: string
  status: MirrorStatus
}

export interface Room {
  readonly slug: string
  readonly serverUrl: string
  readonly readOnly: boolean
  readonly localSave: Readable<'loading' | 'saving' | 'saved' | 'error'>
  readonly delivery: Readable<number>
  readonly authError: Readable<string | null>
  capture(name: string): WorkspaceSnapshot
  recover(snapshot: WorkspaceSnapshot): void
  readonly connection: Readable<ConnectionState>
  readonly files: Readable<FileEntry[]>
  readonly peers: Readable<Peer[]>
  readonly inspector: Readable<InspectorSnapshot>
  /** Undo state of the file most recently passed to `setActiveFile`. */
  readonly activeUndo: Readable<UndoState>
  /** The room's shared whiteboard. */
  readonly board: BoardBinding
  /** Publish (or clear) this user's pointer on the whiteboard. */
  setBoardPointer(pointer: BoardPointer | null): void
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
      boardPointer: presence.boardPointer ?? null,
      clientId,
      isSelf: clientId === awareness.clientID,
    })
  })
  return peers.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.clientId - b.clientId)
}

export function createRoom({
  slug,
  serverUrl,
  user,
  token,
  readOnly = false,
  seedStarterFiles = true,
}: RoomOptions): Room {
  const doc = new Y.Doc()
  const storage = new IndexeddbPersistence(
    token ? `hydras:${serverUrl}:${slug}` : `hydras:${slug}`,
    doc,
  )
  const socket = new HocuspocusProviderWebsocket({ url: serverUrl, autoConnect: false })
  const provider = new HocuspocusProvider({
    name: slug,
    document: doc,
    websocketProvider: socket,
    token,
  })
  provider.attach()

  const awareness = provider.awareness
  if (!awareness) throw new Error('Hocuspocus provider was created without awareness')

  const initialPresence: Presence = { user, activeFile: null, viewport: null, status: 'active' }
  awareness.setLocalState(initialPresence)

  const localSave = writable<'loading' | 'saving' | 'saved' | 'error'>('loading')
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let revision = 0
  /** Size and cost of the last full encode; big rooms checkpoint less often. */
  let lastEncodedBytes = 0
  let checkpointDelay = CHECKPOINT_MIN_MS
  const persistCheckpoint = () => {
    saveTimer = null
    if (!storage.db) return
    const savedRevision = revision
    try {
      const started = performance.now()
      const encoded = Y.encodeStateAsUpdate(doc)
      lastEncodedBytes = encoded.byteLength
      checkpointDelay = Math.min(
        CHECKPOINT_MAX_MS,
        Math.max(CHECKPOINT_MIN_MS, (performance.now() - started) * CHECKPOINT_COST_FACTOR),
      )
      const tx = storage.db.transaction('custom', 'readwrite')
      tx.objectStore('custom').put(encoded, 'durable-checkpoint')
      tx.oncomplete = () => {
        if (revision === savedRevision) localSave.set('saved')
      }
      tx.onerror = tx.onabort = () => localSave.set('error')
    } catch {
      localSave.set('error')
    }
  }
  const delivery = writable(0)
  const authError = writable<string | null>(null)
  provider.on('unsyncedChanges', ({ number }: { number: number }) => delivery.set(number))
  provider.on('authenticationFailed', ({ reason }: { reason: string }) => authError.set(reason))
  provider.on('authenticated', () => authError.set(null))
  const requireEditor = () => {
    if (readOnly) throw Error('This room is read-only')
  }
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
  const board = createBoardBinding(doc)
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
      // Reuse the checkpoint's encode; encoding a big room twice per burst is expensive.
      docBytes: lastEncodedBytes || docSizeBytes(doc),
    }))
  }

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    revision++
    localSave.set('saving')
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(persistCheckpoint, checkpointDelay)
    const kind = classifyOrigin(origin, { remote: provider, storage })
    if (kind === 'local' || kind === 'files' || kind === 'board') dispatch({ type: 'local-change' })
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

  // Text edits happen inside file records too; only re-list when what the list shows changes.
  const onFilesChanged = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
    const listed = events.some(
      (event) =>
        event.path.length === 0 ||
        (event.path.length === 1 &&
          [...(event as Y.YMapEvent<unknown>).keysChanged].some((k) => files.LISTED_FIELDS.has(k))),
    )
    if (listed) fileList.set(files.listFiles(doc))
  }
  files.filesMap(doc).observeDeep(onFilesChanged)

  /** Files anyone in the room has open; the folder host loads those that are stubs. */
  const viewedFiles = () => {
    const ids = new Set<string>()
    awareness.getStates().forEach((state) => {
      const id = (state as Partial<Presence>).activeFile
      if (typeof id === 'string') ids.add(id)
    })
    return ids
  }
  const onAwarenessChange = () => {
    peers.set(readPeers(awareness))
    folderLink?.load(viewedFiles())
  }
  awareness.on('change', onAwarenessChange)

  // --- connection wiring --------------------------------------------------------------
  let seeded = !seedStarterFiles || readOnly
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

  const ready = storage.whenSynced.then(async () => {
    const checkpoint = await storage.get('durable-checkpoint')
    if (destroyed) return
    if (checkpoint instanceof Uint8Array) Y.applyUpdate(doc, checkpoint, storage)
    persistCheckpoint()
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
    serverUrl,
    readOnly,
    delivery,
    localSave,
    authError,
    capture: (name) => captureWorkspace(doc, name),
    recover: (snapshot) => {
      requireEditor()
      recoverWorkspace(doc, snapshot)
    },
    connection,
    files: fileList,
    peers,
    inspector,
    activeUndo,
    board,
    setBoardPointer(pointer) {
      awareness.setLocalStateField('boardPointer', pointer)
    },
    ready,
    folder,
    linkFolder(host, options) {
      requireEditor()
      stopFolderStatus?.()
      folderLink?.unlink()
      const link = linkFolder(doc, host, options)
      folderLink = link
      const publish = () => folder.set({ name: link.folderName, status: link.status.get() })
      publish()
      stopFolderStatus = link.status.subscribe(publish)
      link.load(viewedFiles())
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
    createFile: (name, content) => {
      requireEditor()
      return files.createFile(doc, { name, content: content ?? '' })
    },
    renameFile: (id, name) => {
      requireEditor()
      files.renameFile(doc, id, name)
    },
    deleteFile: (id) => {
      requireEditor()
      files.deleteFile(doc, id)
    },
    restoreFile: (id) => {
      requireEditor()
      files.restoreFile(doc, id)
    },
    bindFile,
    setActiveFile(id) {
      activeFileId = id
      if (id) bindFile(id)
      awareness.setLocalStateField('activeFile', id)
      if (id) folderLink?.load([id])
      refreshActiveUndo()
    },
    undo: (id) => {
      requireEditor()
      bindFile(id)?.undoManager.undo()
    },
    redo: (id) => {
      requireEditor()
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
      if (saveTimer) {
        clearTimeout(saveTimer)
        persistCheckpoint()
      }
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
