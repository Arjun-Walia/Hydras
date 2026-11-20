/**
 * Status bar: connection, collaborators, cursor position, last merge. All numbers tabular.
 */
import { AlertTriangle, Check, FolderOpen, Loader2, SquareTerminal, WifiOff } from 'lucide-react'
import type { MirrorStatus } from '@hydras/sync'
import { StatusDot, cn } from '@hydras/ui'
import { toggleOfflineAction } from '../../app/actions'
import { useCurrentRoom } from '../../app/room-context'
import { useUiStore } from '../../app/ui-store'
import { useReadable } from '../../hooks/use-readable'
import { describeConnection } from './connection-label'

export function StatusBar() {
  const room = useCurrentRoom()
  const connection = useReadable(room.connection)
  const delivery = useReadable(room.delivery)
  const peers = useReadable(room.peers)
  const cursor = useUiStore((s) => s.cursor)
  const terminalOpen = useUiStore((s) => s.terminalOpen)
  const toggleTerminal = useUiStore((s) => s.toggleTerminal)
  const label = describeConnection(connection)
  const isOfflineTone = label.tone === 'warn'

  return (
    <footer
      className={cn(
        'flex h-7 shrink-0 items-center gap-4 border-t px-3 text-[11.5px] tabular-nums transition-colors duration-200',
        isOfflineTone
          ? 'border-warn/30 bg-[var(--warn-soft)] text-fg'
          : 'border-line-soft text-muted',
      )}
    >
      <button
        type="button"
        onClick={() => toggleOfflineAction(room)}
        title={connection.forcedOffline ? 'Go back online' : 'Simulate going offline'}
        className="flex items-center gap-2 rounded px-1 -mx-1 hover:text-fg"
      >
        <StatusDot tone={label.tone} pulse={label.pulse} />
        <span>
          {connection.status === 'online'
            ? delivery > 0
              ? 'Waiting to sync…'
              : label.text === 'Online'
                ? 'Synced with host'
                : label.text
            : label.text}
        </span>
        {connection.forcedOffline && <WifiOff size={12} className="text-warn" />}
      </button>
      <span>
        {peers.length} {peers.length === 1 ? 'collaborator' : 'collaborators'}
      </span>
      {cursor && (
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
      )}
      <span className="flex-1" />
      <FolderStatus />
      <button
        type="button"
        onClick={() => toggleTerminal()}
        title="Toggle terminal (Ctrl+`)"
        className={cn(
          'flex items-center gap-1.5 rounded px-1 hover:text-fg',
          terminalOpen && 'text-fg',
        )}
      >
        <SquareTerminal size={12} /> Terminal
      </button>
      {connection.lastMerge && (
        <span className="flex items-center gap-1.5 text-muted">
          Merged {connection.lastMerge.changes}{' '}
          {connection.lastMerge.changes === 1 ? 'change' : 'changes'}
          <Check size={12} className="text-accent" />
        </span>
      )}
    </footer>
  )
}

function describeMirror(status: MirrorStatus): string {
  switch (status.state) {
    case 'importing':
      return status.total > 0 ? `Reading ${status.done}/${status.total}` : 'Reading folder…'
    case 'live':
      return `${status.files} files${status.skipped > 0 ? ` · ${status.skipped} skipped` : ''} · saved to disk`
    case 'error':
      return `Folder error: ${status.message}`
  }
}

/** Which folder on this machine the room is mirrored to, and how that is going. */
function FolderStatus() {
  const room = useCurrentRoom()
  const folder = useReadable(room.folder)
  if (!folder) return null
  const { state } = folder.status
  const Icon = state === 'importing' ? Loader2 : state === 'error' ? AlertTriangle : FolderOpen
  return (
    <span
      className={cn(
        'flex max-w-[45%] items-center gap-1.5 truncate',
        state === 'error' && 'text-danger',
      )}
      title="Edits from everyone in this room are written to this folder; changes on disk flow back in."
    >
      <Icon size={12} className={cn(state === 'importing' && 'animate-spin')} />
      <b className="font-medium text-fg">{folder.name}</b>
      <span className="truncate">{describeMirror(folder.status)}</span>
    </span>
  )
}
