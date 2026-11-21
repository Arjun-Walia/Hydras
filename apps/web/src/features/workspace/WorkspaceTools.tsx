/**
 * Room tools, in a right-hand drawer opened from the title bar ("Room"):
 * the project folder, recovery points and backups, connection diagnostics, and (for the
 * host) members and join requests. Only an access problem is shown outside the drawer,
 * as a banner, because it blocks syncing.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  Download,
  FolderInput,
  History,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WorkspaceSnapshot } from '@hydras/sync'
import { Eyebrow, IconButton, cn } from '@hydras/ui'
import { roomApi, session } from '../../app/access'
import { useCurrentRoom } from '../../app/room-context'
import { useUiStore } from '../../app/ui-store'
import { useReadable } from '../../hooks/use-readable'
import { attachFolder } from '../../platform/open-folder'

const MAX_BACKUP_BYTES = 20_000_000
const MEMBER_POLL_MS = 4000

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

const button =
  'inline-flex h-8 items-center gap-2 rounded-[var(--radius-chrome)] border border-line px-3 text-[12.5px] text-fg transition-colors duration-150 hover:border-muted hover:bg-surface-raised disabled:pointer-events-none disabled:opacity-40'
const primary =
  'inline-flex h-8 items-center gap-2 rounded-[var(--radius-chrome)] bg-accent px-3 text-[12.5px] font-semibold text-[var(--accent-ink)] transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40'

export function WorkspaceTools() {
  const room = useCurrentRoom()
  const authError = useReadable(room.authError)
  const open = useUiStore((s) => s.roomPanelOpen)
  const setOpen = useUiStore((s) => s.setRoomPanelOpen)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      {authError && (
        <div
          role="alert"
          className="flex h-9 shrink-0 items-center gap-3 border-b border-danger/30 bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-3 text-[12.5px]"
        >
          <ShieldCheck size={14} className="text-danger" />
          <span>Room access: {authError}</span>
          <button type="button" className="ml-auto underline" onClick={() => setOpen(true)}>
            Diagnose
          </button>
        </div>
      )}
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === dialogRef.current && setOpen(false)}
        aria-label="Room tools"
        className="ml-auto mr-0 h-full max-h-full w-[min(440px,100vw)] border-l border-line bg-surface p-0 text-fg backdrop:bg-black/35 backdrop:backdrop-blur-[1px]"
      >
        {open && <RoomTools onClose={() => setOpen(false)} />}
      </dialog>
    </>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-line-soft px-5 py-5">
      <div className="mb-3 flex items-center gap-2 text-faint">
        {icon}
        <Eyebrow>{title}</Eyebrow>
      </div>
      {children}
    </section>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[12px] leading-relaxed text-muted">{children}</p>
}

function RoomTools({ onClose }: { onClose: () => void }) {
  const room = useCurrentRoom()
  const folder = useReadable(room.folder)
  const key = `hydras:snapshots:${room.serverUrl}:${room.slug}`
  const [diagnostic, setDiagnostic] = useState('')
  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([])
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as WorkspaceSnapshot[]
    } catch {
      return []
    }
  })
  const host = session(room.slug)?.role === 'host'

  const refresh = () =>
    roomApi('members', room.slug)
      .then(setMembers)
      .catch((e: unknown) => toast.error(errorText(e)))

  useEffect(() => {
    if (!host) return
    const load = () =>
      roomApi('members', room.slug)
        .then(setMembers)
        .catch(() => undefined)
    void load()
    const timer = setInterval(load, MEMBER_POLL_MS)
    return () => clearInterval(timer)
  }, [host, room.slug])

  const save = () => {
    try {
      const snapshot = room.capture(`Checkpoint ${new Date().toLocaleString()}`)
      const next = [snapshot, ...snapshots].slice(0, 10)
      localStorage.setItem(key, JSON.stringify(next))
      setSnapshots(next)
      toast.success('Recovery point saved on this device')
    } catch (e) {
      toast.error(`Could not save a recovery point. Export a backup instead: ${errorText(e)}`)
    }
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup is larger than 20 MB')
      room.recover(JSON.parse(await file.text()) as WorkspaceSnapshot)
      toast.success('Recovered into a separate folder; current files are untouched')
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  const checkConnection = async () => {
    setDiagnostic('Checking the host…')
    try {
      await roomApi('health')
      setDiagnostic(
        'The host is reachable. If syncing is still blocked, check your approval or the room password.',
      )
    } catch {
      setDiagnostic(
        'This device cannot reach the host. Check the host app is running, both devices are on the same network, port 1234 is allowed on the host, and guest/client isolation is off.',
      )
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line-soft px-5">
        <Users size={15} className="text-accent" />
        <h2 className="text-[14px] font-semibold">Room</h2>
        <span className="truncate font-serif text-[16px] text-muted italic">{room.slug}</span>
        <IconButton label="Close room tools" className="ml-auto" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {host && (
          <Section icon={<ShieldCheck size={13} />} title="Members and join requests">
            {members.length === 0 && <p className="text-[12.5px] text-muted">No one else yet.</p>}
            <ul className="divide-y divide-line-soft">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px]',
                      m.role === 'pending'
                        ? 'bg-[var(--warn-soft)] text-warn'
                        : 'bg-surface-raised text-muted',
                    )}
                  >
                    {m.role}
                  </span>
                  {m.role !== 'host' &&
                    (['editor', 'viewer', 'rejected'] as const).map((role) => (
                      <button
                        key={role}
                        type="button"
                        className={role === 'editor' ? primary : button}
                        onClick={async () => {
                          try {
                            await roomApi('approve', room.slug, { id: m.id, role })
                            await refresh()
                          } catch (e) {
                            toast.error(errorText(e))
                          }
                        }}
                      >
                        {role === 'rejected'
                          ? 'Revoke'
                          : role === 'editor'
                            ? 'Allow editing'
                            : 'View only'}
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section icon={<FolderInput size={13} />} title="Project folder">
          <p className="text-[12.5px]">
            {folder ? (
              <>
                This device hosts <b>{folder.name}</b>. Shared edits are written into that folder.
              </>
            ) : (
              'Files live in this room and in this browser. Nothing is written to your disk.'
            )}
          </p>
          {!room.readOnly && (
            <button
              type="button"
              className={cn(primary, 'mt-3')}
              onClick={async () => {
                try {
                  save()
                  await attachFolder(room)
                } catch (e) {
                  toast.error(errorText(e))
                }
              }}
            >
              <FolderInput size={13} />{' '}
              {folder ? 'Attach a different folder' : 'Attach a project folder'}
            </button>
          )}
          <Hint>
            Attaching imports the folder into this room and keeps it in sync both ways. Large
            projects open instantly: files load from disk as soon as someone opens them.
          </Hint>
        </Section>

        <Section icon={<History size={13} />} title="Recovery points on this device">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={save}>
              <History size={13} /> Save checkpoint
            </button>
            <button
              type="button"
              className={button}
              onClick={() =>
                download(
                  `${room.slug}-workspace.json`,
                  JSON.stringify(room.capture('Export'), null, 2),
                )
              }
            >
              <Download size={13} /> Export backup
            </button>
            <label
              className={cn(
                button,
                'cursor-pointer',
                room.readOnly && 'pointer-events-none opacity-40',
              )}
            >
              <Upload size={13} /> Import backup
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                disabled={room.readOnly}
                onChange={(e) => {
                  void importBackup(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {snapshots.length > 0 && (
            <ul className="mt-3 divide-y divide-line-soft rounded-[var(--radius-chrome)] border border-line-soft">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px]"
                >
                  <span className="min-w-0 truncate">{s.name}</span>
                  <button
                    type="button"
                    disabled={room.readOnly}
                    className="shrink-0 text-accent hover:underline disabled:opacity-40"
                    onClick={() => {
                      try {
                        room.recover(s)
                        toast.success('Recovered copies; current files preserved')
                      } catch (e) {
                        toast.error(errorText(e))
                      }
                    }}
                  >
                    Recover copies
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Hint>
            Keeps the latest 10 checkpoints. Recovering creates a separate folder (Trash included),
            so reconnecting collaborators can never overwrite it.
          </Hint>
        </Section>

        <Section icon={<Activity size={13} />} title="Connection">
          <code className="block rounded-[var(--radius-chrome)] border border-line-soft bg-bg px-3 py-2 font-mono text-[12px] break-all">
            {room.serverUrl}
          </code>
          <button
            type="button"
            className={cn(button, 'mt-3')}
            onClick={() => void checkConnection()}
          >
            <Activity size={13} /> Check connection
          </button>
          {diagnostic && (
            <p role="status" className="mt-2.5 text-[12.5px]">
              {diagnostic}
            </p>
          )}
          <Hint>
            No internet is needed on a local network. Without one, edits stay on this device and
            merge when the connection returns.
          </Hint>
        </Section>
      </div>
    </div>
  )
}
