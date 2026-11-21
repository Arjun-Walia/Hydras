/**
 * Sync inspector: makes the invisible visible. Connection, peers, pending changes,
 * this replica's state vector, the local undo stack, and a live update log by origin.
 * Also hosts the chaos controls used on stage.
 */
import type { ReactNode } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import type { OriginKind } from '@hydras/sync'
import { Eyebrow, StatusDot, cn } from '@hydras/ui'
import { toggleOfflineAction } from '../../app/actions'
import { useCurrentRoom } from '../../app/room-context'
import { useReadable } from '../../hooks/use-readable'
import { describeConnection } from '../workspace/connection-label'

const ORIGIN_STYLE: Record<OriginKind, string> = {
  local: 'text-accent',
  files: 'text-accent',
  disk: 'text-warn',
  board: 'text-[var(--syn-type)]',
  remote: 'text-[var(--syn-function)]',
  storage: 'text-faint',
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

export function Inspector() {
  const room = useCurrentRoom()
  const connection = useReadable(room.connection)
  const peers = useReadable(room.peers)
  const snapshot = useReadable(room.inspector)
  const undo = useReadable(room.activeUndo)
  const label = describeConnection(connection)
  const peerName = new Map(peers.map((p) => [p.clientId, p.user.name]))

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto bg-surface-soft"
      aria-label="Sync inspector"
    >
      <div className="flex h-9 shrink-0 items-center px-3">
        <Eyebrow>Inspector</Eyebrow>
      </div>

      <Section title="Connection">
        <div className="flex items-center gap-2 text-[12.5px]">
          <StatusDot tone={label.tone} pulse={label.pulse} />
          {label.text}
        </div>
        <button
          type="button"
          onClick={() => toggleOfflineAction(room)}
          aria-pressed={connection.forcedOffline}
          className={cn(
            'mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-[var(--radius-chrome)] border text-[12px] font-medium transition-colors duration-150',
            connection.forcedOffline
              ? 'border-accent/40 bg-accent-soft text-accent hover:bg-accent/20'
              : 'border-line text-muted hover:border-warn/50 hover:text-warn',
          )}
        >
          {connection.forcedOffline ? <Wifi size={13} /> : <WifiOff size={13} />}
          {connection.forcedOffline ? 'Go back online' : 'Go offline'}
        </button>
        <p className="mt-3 text-[11.5px] leading-snug text-muted">
          Edits stay on this laptop while offline and merge when the connection returns. Undo
          reverts only your changes.
        </p>
      </Section>

      <Section title="Numbers">
        <Stat label="Peers" value={peers.length} />
        <Stat label="Pending changes" value={connection.pendingChanges} />
        <Stat label="Undo stack (mine)" value={undo.undoDepth} />
        <Stat label="Redo stack" value={undo.redoDepth} />
        <Stat label="Document size" value={formatBytes(snapshot.docBytes)} />
      </Section>

      <Section title="State vector">
        <p className="mb-2 text-[11.5px] text-faint">Highest operation seen from each client.</p>
        {snapshot.stateVector.length === 0 && (
          <p className="text-[12px] text-faint">Empty document</p>
        )}
        {snapshot.stateVector.map(({ clientId, clock }) => (
          <div
            key={clientId}
            className="flex items-center justify-between py-0.5 font-mono text-[11.5px]"
          >
            <span className={clientId === snapshot.clientId ? 'text-accent' : 'text-muted'}>
              {peerName.get(clientId) ?? clientId}
              {clientId === snapshot.clientId && ' (me)'}
            </span>
            <span className="text-fg tabular-nums">{clock}</span>
          </div>
        ))}
      </Section>

      <Section title="Update log">
        {snapshot.recentUpdates.length === 0 && (
          <p className="text-[12px] text-faint">No updates yet</p>
        )}
        {snapshot.recentUpdates.map((entry) => (
          <div
            key={entry.seq}
            className="flex items-center gap-2 py-0.5 font-mono text-[11px] tabular-nums"
          >
            <span className="w-14 text-faint">
              {new Date(entry.at).toLocaleTimeString([], { hour12: false })}
            </span>
            <span className={cn('w-14', ORIGIN_STYLE[entry.origin])}>{entry.origin}</span>
            <span className="ml-auto text-muted">{formatBytes(entry.bytes)}</span>
          </div>
        ))}
      </Section>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line-soft px-3 py-3">
      <Eyebrow className="mb-2 block">{title}</Eyebrow>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[12.5px]">
      <span className="text-muted">{label}</span>
      <span className="text-fg tabular-nums">{value}</span>
    </div>
  )
}
