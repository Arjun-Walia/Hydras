import { useEffect, useState } from 'react'
import type { WorkspaceSnapshot } from '@hydras/sync'
import { attachFolder } from '../../platform/open-folder'
import { toast } from 'sonner'
import { roomApi, session } from '../../app/access'
import { useCurrentRoom } from '../../app/room-context'
import { useReadable } from '../../hooks/use-readable'
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function WorkspaceTools() {
  const room = useCurrentRoom()
  const localSave = useReadable(room.localSave)
  const folder = useReadable(room.folder)
  const delivery = useReadable(room.delivery)
  const connection = useReadable(room.connection)
  const authError = useReadable(room.authError)
  const [open, setOpen] = useState(false)
  const [diagnostic, setDiagnostic] = useState('')
  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([])
  const key = `hydras:snapshots:${room.serverUrl}:${room.slug}`
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]')
    } catch {
      return []
    }
  })
  const host = session(room.slug)?.role === 'host'
  const refresh = () =>
    roomApi('members', room.slug)
      .then(setMembers)
      .catch((e) => toast.error(String(e)))
  useEffect(() => {
    if (!open || !host) return
    const load = () =>
      roomApi('members', room.slug)
        .then(setMembers)
        .catch(() => {})
    void load()
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [open, host, room.slug])
  const save = () => {
    try {
      const snapshot = room.capture(`Checkpoint ${new Date().toLocaleString()}`)
      const next = [snapshot, ...snapshots].slice(0, 10)
      localStorage.setItem(key, JSON.stringify(next))
      setSnapshots(next)
      toast.success('Recovery point saved on this laptop')
    } catch (e) {
      toast.error(`Could not save recovery point. Export a backup: ${String(e)}`)
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-3 py-2 text-xs">
        <button className="rounded border border-line px-3 py-1" onClick={() => setOpen(!open)}>
          Workspace tools {open ? '−' : '+'}
        </button>
        <span role="status">
          {authError
            ? `Access: ${authError}`
            : connection.status === 'online' && connection.synced && delivery === 0
              ? 'Synced with host'
              : delivery > 0
                ? `${delivery} updates waiting to sync`
                : 'Working locally · reconnecting to host'}
        </span>
        <span role="status">
          {localSave === 'saved'
            ? 'Saved on this laptop'
            : localSave === 'error'
              ? 'Local save failed — export a backup now'
              : 'Saving locally…'}
        </span>
        {room.readOnly && <strong>Viewer · read-only</strong>}
      </div>
      {open && (
        <section
          aria-label="Workspace tools"
          className="max-h-80 overflow-y-auto border-b border-line bg-surface-soft p-4 text-sm"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h2 className="font-semibold">Your project</h2>
              {!room.readOnly && (
                <button
                  className="my-2 rounded border px-3 py-1"
                  onClick={async () => {
                    try {
                      save()
                      await attachFolder(room)
                    } catch (e) {
                      toast.error(String(e))
                    }
                  }}
                >
                  Attach project folder to this room
                </button>
              )}
              <p className="text-xs text-muted">
                Attaching imports disk contents into this room and starts writing shared edits to
                that folder. Use a project copy first; files with matching paths take their initial
                contents from disk.
              </p>
              <p className="my-2 text-muted">
                {folder
                  ? `This laptop hosts “${folder.name}”. Shared edits are written into that selected folder.`
                  : 'Files are stored in this browser profile. Joining does not create a folder on your disk.'}{' '}
                Keep the host awake and connected. Browser storage can be cleared; export important
                work.
              </p>
              <button
                className="rounded border px-3 py-1"
                onClick={() =>
                  download(
                    `${room.slug}-workspace.json`,
                    JSON.stringify(room.capture('Export'), null, 2),
                  )
                }
              >
                Export workspace JSON
              </button>
              <p className="mt-2 text-xs">
                Exports include paths, text and Trash. Import a backup below to recover files into a
                new folder without overwriting current work.
              </p>
            </div>
            <div>
              <h2 className="font-semibold">Recovery points · this laptop</h2>
              <button className="my-2 rounded border px-3 py-1" onClick={save}>
                Save checkpoint
              </button>
              <label className="ml-2 cursor-pointer underline">
                Import backup
                <input
                  className="sr-only"
                  type="file"
                  accept="application/json,.json"
                  disabled={room.readOnly}
                  onChange={async (e) => {
                    try {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 20_000_000) throw Error('Backup exceeds 20 MB')
                      room.recover(JSON.parse(await file.text()))
                      toast.success('Recovered into a separate folder')
                    } catch (e) {
                      toast.error(String(e))
                    }
                  }}
                />
              </label>
              {snapshots.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1">
                  <span>{s.name}</span>
                  <button
                    disabled={room.readOnly}
                    className="underline disabled:opacity-40"
                    onClick={() => {
                      try {
                        room.recover(s)
                        toast.success('Recovered copies; current files preserved')
                      } catch (e) {
                        toast.error(String(e))
                      }
                    }}
                  >
                    Recover copies
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted">
                Keeps the latest 10 checkpoints. Recovery creates a new folder, including deleted
                files; offline collaborators cannot erase the original or recovered copies by
                reconnecting.
              </p>
            </div>
            <div>
              <h2 className="font-semibold">Connection diagnostics</h2>
              <code className="block break-all py-2">{room.serverUrl}</code>
              <button
                className="rounded border px-3 py-1"
                onClick={async () => {
                  setDiagnostic('Checking host…')
                  try {
                    await roomApi('health')
                    setDiagnostic(
                      'Host HTTP endpoint reachable. If sync is blocked, check approval/password and WebSocket filtering.',
                    )
                  } catch {
                    setDiagnostic(
                      'Host unreachable from this browser. Check host is running, both devices share Wi-Fi, TCP 1234 is allowed on the host Private network, and guest/client isolation is disabled. Browser security or HTTPS mixed-content rules can also block LAN connections.',
                    )
                  }
                }}
              >
                Check connection
              </button>
              <p role="status" className="my-2 text-xs">
                {diagnostic}
              </p>
              <p className="text-xs text-muted">
                No internet is needed on LAN. Without a network path, edits stay local until
                reconnect. Synced means received by the host, not a guarantee of a completed disk
                backup.
              </p>
            </div>
          </div>
          {host && (
            <div className="mt-4 border-t border-line pt-3">
              <h2 className="font-semibold">Members and join requests</h2>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-4 py-1">
                  <span>
                    {m.name} · {m.role}
                  </span>
                  {m.role !== 'host' &&
                    (['editor', 'viewer', 'rejected'] as const).map((role) => (
                      <button
                        key={role}
                        className="rounded border px-2 py-1"
                        onClick={async () => {
                          try {
                            await roomApi('approve', room.slug, { id: m.id, role })
                            await refresh()
                          } catch (e) {
                            toast.error(String(e))
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
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}
