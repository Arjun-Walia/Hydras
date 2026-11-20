/**
 * First visit: pick a display name for this browser, then enter the room.
 */
import { useState, type FormEvent } from 'react'
import { randomDisplayName } from '@hydras/shared'
import { Avatar, Eyebrow } from '@hydras/ui'
import { previewIdentity } from '../../app/identity'

type Props = {
  slug: string
  onJoin: (name: string) => void
}

export function JoinScreen({ slug, onJoin }: Props) {
  const [name, setName] = useState(() => randomDisplayName())
  const preview = previewIdentity(name)
  const canJoin = name.trim().length > 0

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canJoin) onJoin(name)
  }

  return (
    <main className="grid min-h-full place-items-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[380px] rounded-[var(--radius-dialog)] border border-line bg-surface p-7"
      >
        <Eyebrow>Joining room</Eyebrow>
        <h1 className="mt-2 truncate font-serif text-[40px] leading-[1.05] tracking-[-0.02em] italic">
          {slug}
        </h1>
        <p className="mt-3 text-[13px] text-muted">
          Edit together, keep working offline, merge on reconnect.
        </p>

        <label htmlFor="display-name" className="mt-7 block">
          <Eyebrow>Your name</Eyebrow>
        </label>
        <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-chrome)] border border-line bg-surface-soft px-3 focus-within:border-accent">
          <Avatar person={{ key: 'preview', name: preview.name, color: preview.color }} size={22} />
          <input
            id="display-name"
            autoFocus
            maxLength={32}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
            placeholder="brisk-otter"
          />
        </div>

        <button
          type="submit"
          disabled={!canJoin}
          className="mt-6 h-10 w-full rounded-[var(--radius-chrome)] bg-accent text-[13px] font-semibold text-[var(--accent-ink)] transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
        >
          Join room
        </button>
      </form>
    </main>
  )
}
