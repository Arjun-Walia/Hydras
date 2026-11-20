/**
 * Desktop home: the app has no marketing page, just "new room", "join by link" and settings.
 */
import { useState, type FormEvent } from 'react'
import { ArrowRight, FolderOpen, Settings2 } from 'lucide-react'
import { openFolderAction } from '../../app/actions'
import { toast } from 'sonner'
import { Eyebrow, HydrasMark, IconButton } from '@hydras/ui'
import { navigate, slugFromInput } from '../../app/route'
import { useUiStore } from '../../app/ui-store'
import { useModHotkey } from '../../hooks/use-hotkey'
import { openNewRoom } from '../landing/open-room'
import { SettingsDialog } from '../settings/SettingsDialog'

export function StartScreen() {
  const [invite, setInvite] = useState('')
  const openSettings = useUiStore((s) => s.openSettings)
  useModHotkey(',', () => openSettings())

  const handleJoin = (event: FormEvent) => {
    event.preventDefault()
    const slug = slugFromInput(invite)
    if (slug) navigate(`/r/${slug}`)
    else toast.error('That is not a Hydras room link')
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
          Opens your existing project as a room. Edits are saved straight to your files.
        </p>

        <button
          type="button"
          onClick={openNewRoom}
          className="mt-4 flex h-10 w-full items-center justify-between rounded-[var(--radius-chrome)] border border-line px-4 text-[13px] text-fg transition-colors hover:border-muted"
        >
          New empty room <ArrowRight size={15} />
        </button>

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
      <SettingsDialog />
    </main>
  )
}
