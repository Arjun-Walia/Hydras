/**
 * Desktop home (what you land on right after installing).
 *
 * First launch asks one thing, your display name, then shows four ways in: open a
 * project folder, host a password-protected workspace, join with a link, or start a quick
 * open room. Recent rooms on this server are listed for one-click return.
 */
import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  Clock,
  FolderOpen,
  KeyRound,
  Link2,
  Loader2,
  Settings2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { randomDisplayName } from '@hydras/shared'
import { Avatar, Eyebrow, HydrasMark, IconButton, cn } from '@hydras/ui'
import { applyInvite, roomApi, saveSession, syncAddress } from '../../app/access'
import { openFolderAction } from '../../app/actions'
import { loadIdentity, previewIdentity, saveIdentity } from '../../app/identity'
import { navigate, slugFromInput } from '../../app/route'
import { useSettingsStore } from '../../app/settings-store'
import { useUiStore } from '../../app/ui-store'
import { useModHotkey } from '../../hooks/use-hotkey'
import { openNewRoom } from '../landing/open-room'
import { SettingsDialog } from '../settings/SettingsDialog'

const MIN_PASSWORD = 8
const RELEASES_URL = 'https://github.com/Arjun-Walia/Hydras/releases'

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function StartScreen() {
  const [named, setNamed] = useState(() => loadIdentity() !== null)
  const openSettings = useUiStore((s) => s.openSettings)
  useModHotkey(',', () => openSettings())

  return (
    <main className="relative flex h-full flex-col overflow-y-auto bg-bg">
      <header className="flex h-12 shrink-0 items-center gap-2.5 px-5">
        <HydrasMark size={22} />
        <span className="text-[13px] font-semibold tracking-[-0.01em]">hydras</span>
        <span className="flex-1" />
        <IconButton label="Settings (Ctrl+,)" onClick={() => openSettings()}>
          <Settings2 size={15} />
        </IconButton>
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        {named ? <Home /> : <NameStep onDone={() => setNamed(true)} />}
      </div>
      <footer className="flex shrink-0 items-center justify-center gap-3 px-5 py-4 text-[11.5px] text-faint">
        <span>Hydras {__APP_VERSION__}</span>
        <span aria-hidden="true">·</span>
        <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="hover:text-fg">
          Check for updates
        </a>
      </footer>
      <SettingsDialog />
    </main>
  )
}

/** First run: the only setup Hydras needs is a name people will see on your cursor. */
function NameStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState(() => randomDisplayName())
  const preview = previewIdentity(name)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    saveIdentity(name)
    onDone()
  }
  return (
    <form onSubmit={submit} className="w-full max-w-[420px]">
      <Eyebrow>Welcome</Eyebrow>
      <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-[-0.01em]">
        What should your team <em className="text-accent">call you?</em>
      </h1>
      <p className="mt-3 text-[13.5px] text-muted">
        Your name and colour appear on your cursor in shared files. You can change it later.
      </p>
      <div className="mt-7 flex items-center gap-3 rounded-[var(--radius-dialog)] border border-line bg-surface px-3 focus-within:border-accent">
        <Avatar person={{ key: 'me', name: preview.name, color: preview.color }} size={26} />
        <input
          autoFocus
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Display name"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={!name.trim()}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-chrome)] bg-accent text-[14px] font-semibold text-[var(--accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Continue <ArrowRight size={16} />
      </button>
    </form>
  )
}

function Home() {
  const identity = loadIdentity()
  const recentPrefix = `hydras:access:${syncAddress()}:`
  const recentRooms = Object.keys(localStorage)
    .filter((key) => key.startsWith(recentPrefix))
    .map((key) => key.slice(recentPrefix.length))
    .slice(-6)
    .reverse()

  return (
    <div className="grid w-full max-w-[920px] gap-10 md:grid-cols-[1fr_1.1fr] md:items-center">
      <div>
        <h1 className="font-serif text-[52px] leading-[0.98] tracking-[-0.01em]">
          Good to see you,
          <br />
          <em className="text-accent">{identity?.name ?? 'friend'}.</em>
        </h1>
        <p className="mt-4 max-w-[38ch] text-[14px] leading-relaxed text-muted">
          Code together in real time, keep working when the Wi-Fi drops, and merge cleanly when you
          reconnect.
        </p>
        {recentRooms.length > 0 && (
          <div className="mt-8">
            <Eyebrow>Recent rooms</Eyebrow>
            <ul className="mt-2 divide-y divide-line-soft rounded-[var(--radius-dialog)] border border-line-soft">
              {recentRooms.map((slug) => (
                <li key={slug}>
                  <button
                    type="button"
                    onClick={() => navigate(`/r/${slug}`)}
                    className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-surface"
                  >
                    <Clock size={13} className="text-faint" />
                    <span className="min-w-0 flex-1 truncate">{slug}</span>
                    <ArrowRight
                      size={13}
                      className="text-faint opacity-0 group-hover:opacity-100"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <ActionCard
          icon={<FolderOpen size={17} />}
          title="Open a project folder"
          body="Edit a codebase on your disk together. Big projects open instantly."
          primary
          onClick={() => void openFolderAction()}
        />
        <HostCard />
        <JoinCard />
        <ActionCard
          icon={<Sparkles size={17} />}
          title="Quick room"
          body="An open scratch room with starter files. Anyone with the link can join."
          onClick={openNewRoom}
        />
      </div>
    </div>
  )
}

type ActionCardProps = {
  icon: ReactNode
  title: string
  body: string
  primary?: boolean
  onClick: () => void
}

function ActionCard({ icon, title, body, primary, onClick }: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-start gap-3.5 rounded-[var(--radius-dialog)] border p-4 text-left transition-colors duration-150',
        primary
          ? 'border-accent/50 bg-accent-soft hover:border-accent'
          : 'border-line-soft bg-surface hover:border-line',
      )}
    >
      <span className={cn('mt-0.5', primary ? 'text-accent' : 'text-muted')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{body}</span>
      </span>
      <ArrowRight
        size={15}
        className="mt-1 text-faint transition-transform group-hover:translate-x-0.5"
      />
    </button>
  )
}

/** Start the bundled sync server on this machine and create a password-protected room. */
function HostCard() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const host = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const local =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? window.location.origin
          : 'http://localhost:5173'
      const response = await fetch(`${local}/local/host`, {
        method: 'POST',
        headers: { 'X-Hydras-Local': '1' },
      })
      if (response.ok) {
        const info = (await response.json()) as { server: string }
        useSettingsStore.getState().setSyncUrl(info.server)
      }
      const result = await roomApi('create', '', { password, name: loadIdentity()?.name ?? 'Host' })
      saveSession(result.room, result)
      navigate(`/r/${result.room}`)
    } catch (e) {
      toast.error(
        `Could not start hosting: ${errorText(e)}. Check Settings → Sync server, or restart Hydras.`,
      )
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <ActionCard
        icon={<KeyRound size={17} />}
        title="Host a protected workspace"
        body="Teammates on your network join with a link and password; you approve each one."
        onClick={() => setOpen(true)}
      />
    )
  }
  return (
    <form
      onSubmit={host}
      className="rounded-[var(--radius-dialog)] border border-line bg-surface p-4"
    >
      <div className="flex items-center gap-3.5">
        <KeyRound size={17} className="text-accent" />
        <span className="text-[14px] font-semibold">Host a protected workspace</span>
      </div>
      <label htmlFor="host-password" className="mt-3 block text-[12px] text-muted">
        Room password ({MIN_PASSWORD}+ characters). Share it separately from the invite link.
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="host-password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-chrome)] border border-line bg-bg px-3 text-[13px] text-fg outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || password.length < MIN_PASSWORD}
          className="flex h-10 items-center gap-2 rounded-[var(--radius-chrome)] bg-accent px-4 text-[13px] font-semibold text-[var(--accent-ink)] disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {busy ? 'Starting…' : 'Start hosting'}
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Keep this computer awake while others work.</p>
    </form>
  )
}

function JoinCard() {
  const [invite, setInvite] = useState('')
  const join = (event: FormEvent) => {
    event.preventDefault()
    const slug = slugFromInput(invite)
    if (!slug) {
      toast.error('That is not a Hydras room link')
      return
    }
    try {
      applyInvite(invite)
      navigate(`/r/${slug}`)
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  return (
    <form
      onSubmit={join}
      className="rounded-[var(--radius-dialog)] border border-line-soft bg-surface p-4"
    >
      <div className="flex items-center gap-3.5">
        <Link2 size={17} className="text-muted" />
        <span className="text-[14px] font-semibold">Join with a link</span>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={invite}
          onChange={(event) => setInvite(event.target.value)}
          placeholder="Paste an invite link"
          aria-label="Invite link"
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-chrome)] border border-line bg-bg px-3 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          className="h-10 rounded-[var(--radius-chrome)] border border-line px-4 text-[13px] text-fg hover:border-muted"
        >
          Join
        </button>
      </div>
    </form>
  )
}
