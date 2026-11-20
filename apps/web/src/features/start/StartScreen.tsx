/**
 * Desktop home: the app has no marketing page, just "new room", "join by link" and settings.
 */
import { useState, type FormEvent } from 'react'
import { ArrowRight, FolderOpen, Settings2 } from 'lucide-react'
import { openFolderAction } from '../../app/actions'
import { toast } from 'sonner'
import { Eyebrow, HydrasMark, IconButton } from '@hydras/ui'
import { applyInvite, roomApi, saveSession, syncAddress } from '../../app/access'
import { useSettingsStore } from '../../app/settings-store'
import { navigate, slugFromInput } from '../../app/route'
import { useUiStore } from '../../app/ui-store'
import { useModHotkey } from '../../hooks/use-hotkey'
import { openNewRoom } from '../landing/open-room'
import { SettingsDialog } from '../settings/SettingsDialog'

export function StartScreen() {
  const recentPrefix = `hydras:access:${syncAddress()}:`
  const recentRooms = Object.keys(localStorage)
    .filter((key) => key.startsWith(recentPrefix))
    .map((key) => key.slice(recentPrefix.length))
    .slice(-6)
  const [password, setPassword] = useState('')
  const [hosting, setHosting] = useState(false)
  const host = async () => {
    setHosting(true)
    try {
      const response = await fetch(
        `${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? window.location.origin : 'http://localhost:5173'}/local/host`,
        {
          method: 'POST',
          headers: { 'X-Hydras-Local': '1' },
        },
      )
      if (response.ok) {
        const info = await response.json()
        useSettingsStore.getState().setSyncUrl(info.server)
      }
      const result = await roomApi('create', '', { password, name: 'Host' })
      saveSession(result.room, result)
      navigate(`/r/${result.room}`)
    } catch (e) {
      toast.error(
        `Hosting failed: ${String(e)}. Start the local launcher or configure a running sync server in Settings.`,
      )
    } finally {
      setHosting(false)
    }
  }
  const [invite, setInvite] = useState('')
  const openSettings = useUiStore((s) => s.openSettings)
  useModHotkey(',', () => openSettings())

  const handleJoin = (event: FormEvent) => {
    event.preventDefault()
    const slug = slugFromInput(invite)
    if (slug) {
      try {
        applyInvite(invite)
        navigate(`/r/${slug}`)
      } catch (e) {
        toast.error(String(e))
      }
    } else toast.error('That is not a Hydras room link')
  }

  return (
    <main className="relative grid h-full place-items-center bg-bg px-4">
      <IconButton
        label="Settings (Ctrl+,)"
        onClick={() => openSettings()}
        className="absolute top-3 right-3"
      >
        <Settings2 size={15} />
      </IconButton>
      <div className="w-full max-w-[400px]">
        <HydrasMark size={32} />
        <h1 className="mt-5 font-serif text-[46px] leading-[1] italic">Hydras</h1>
        <p className="mt-2 text-[13px] text-muted">Code together, even when the Wi-Fi doesn't.</p>

        <div className="mt-6 space-y-2">
          <label htmlFor="host-password" className="text-sm">
            New room password (8+ characters)
          </label>
          <input
            id="host-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-line bg-surface-soft p-2"
          />
          <button
            disabled={hosting || password.length < 8}
            onClick={() => void host()}
            className="w-full rounded bg-accent p-3 text-bg disabled:opacity-40"
          >
            {hosting ? 'Starting host…' : 'Host a protected workspace'}
          </button>
          <p className="text-xs text-muted">
            Keep this laptop awake. Share the invite and password separately; approve friends in the
            workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openFolderAction()}
          className="mt-8 flex h-11 w-full items-center justify-between rounded-[var(--radius-chrome)] bg-accent px-4 text-[13.5px] font-semibold text-[var(--accent-ink)] transition-opacity hover:opacity-90"
        >
          <span className="flex items-center gap-2.5">
            <FolderOpen size={16} /> Open folder…
          </span>
          <ArrowRight size={16} />
        </button>
        <p className="mt-2 text-[12px] text-faint">
          Opens an unprotected room. For protected sharing, host a workspace above, then attach your
          folder from Workspace tools.
        </p>

        <button
          type="button"
          onClick={openNewRoom}
          className="mt-4 flex h-10 w-full items-center justify-between rounded-[var(--radius-chrome)] border border-line px-4 text-[13px] text-fg transition-colors hover:border-muted"
        >
          New open room (no password) <ArrowRight size={15} />
        </button>

        {recentRooms.length > 0 && (
          <div className="mt-4 text-xs">
            <p className="mb-1 text-muted">Recent rooms on this server</p>
            <div className="flex flex-wrap gap-2">
              {recentRooms.map((slug) => (
                <button
                  key={slug}
                  className="max-w-full truncate rounded border border-line px-2 py-1"
                  onClick={() => navigate(`/r/${slug}`)}
                >
                  {slug}
                </button>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={handleJoin} className="mt-6">
          <label htmlFor="invite">
            <Eyebrow>Join with a link</Eyebrow>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="invite"
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              placeholder="hydras.software/r/team-room"
              className="h-10 min-w-0 flex-1 rounded-[var(--radius-chrome)] border border-line bg-surface-soft px-3 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
            />
            <button
              type="submit"
              className="h-10 rounded-[var(--radius-chrome)] border border-line px-4 text-[13px] text-fg hover:border-muted"
            >
              Join
            </button>
          </div>
        </form>
      </div>
      <a
        href="https://github.com/Arjun-Walia/Hydras/releases"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-4 text-xs text-muted underline"
      >
        Downloads and updates · install the latest release over this version
      </a>
      <SettingsDialog />
    </main>
  )
}
