/**
 * Which sync server this install talks to. Needed for the desktop app, which has no
 * hosting origin to infer it from. Changing it reconnects the current room; local edits
 * are kept in IndexedDB and merge into the new server.
 */
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { DEFAULT_SYNC_URL } from '@hydras/shared'
import { normalizeSyncUrl } from '../../app/settings'
import { useSettingsStore } from '../../app/settings-store'
import { SectionHeader, SubHeading } from './SectionHeader'

const BUILD_DEFAULT = import.meta.env.VITE_SYNC_URL ?? DEFAULT_SYNC_URL

export function SyncSection() {
  const syncUrl = useSettingsStore((s) => s.syncUrl)
  const setSyncUrl = useSettingsStore((s) => s.setSyncUrl)
  const [draft, setDraft] = useState(syncUrl ?? BUILD_DEFAULT)
  const normalized = normalizeSyncUrl(draft)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!normalized) return
    setSyncUrl(normalized === BUILD_DEFAULT ? null : normalized)
    toast.success('Sync server saved. Reconnecting…')
  }

  return (
    <>
      <SectionHeader title="Sync server">
        The Hocuspocus server rooms sync through. Run your own with{' '}
        <code className="font-mono text-[12px]">pnpm dev:server</code> or point at a hosted one.
      </SectionHeader>

      <SubHeading>Server address</SubHeading>
      <form onSubmit={handleSubmit} className="flex max-w-lg gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          aria-invalid={!normalized}
          aria-describedby="sync-url-help"
          className="h-9 min-w-0 flex-1 rounded-[var(--radius-chrome)] border border-line bg-bg px-3 font-mono text-[12.5px] text-fg outline-none focus:border-accent aria-[invalid=true]:border-danger"
        />
        <button
          type="submit"
          disabled={!normalized}
          className="h-9 rounded-[var(--radius-chrome)] bg-accent px-4 text-[12.5px] font-semibold text-[var(--accent-ink)] disabled:opacity-40"
        >
          Save
        </button>
      </form>
      <p id="sync-url-help" className="mt-2 text-[12px] text-faint">
        {normalized ? `Default for this build: ${BUILD_DEFAULT}` : 'Use a ws:// or wss:// address.'}
      </p>
      {syncUrl && (
        <button
          type="button"
          onClick={() => {
            setSyncUrl(null)
            setDraft(BUILD_DEFAULT)
          }}
          className="mt-3 text-[12.5px] text-accent underline-offset-4 hover:underline"
        >
          Reset to default
        </button>
      )}
    </>
  )
}
