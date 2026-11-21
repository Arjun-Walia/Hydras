/**
 * Title bar: brand + room, palette trigger, presence, quick theme flip, panels, settings, share.
 */
import { Moon, PanelLeft, PanelRight, Search, Settings2, Share2, Sun } from 'lucide-react'
import { AvatarStack, HydrasMark, IconButton, Kbd } from '@hydras/ui'
import { copyInviteAction } from '../../app/actions'
import { useCurrentRoom } from '../../app/room-context'
import { resolveTheme, useSettingsStore } from '../../app/settings-store'
import { useUiStore } from '../../app/ui-store'
import { useReadable } from '../../hooks/use-readable'

export function TitleBar() {
  const room = useCurrentRoom()
  const peers = useReadable(room.peers)
  const layout = useSettingsStore((s) => s.layout)
  const setLayout = useSettingsStore((s) => s.setLayout)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const themeKind = useSettingsStore((s) => resolveTheme(s).kind)
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const openSettings = useUiStore((s) => s.openSettings)

  const people = peers.map((peer) => ({
    key: peer.clientId,
    name: peer.user.name,
    color: peer.user.color,
    isSelf: peer.isSelf,
  }))

  const flipTheme = () => setTheme(themeKind === 'dark' ? 'hydras-paper' : 'hydras-graphite')

  return (
    <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-line-soft px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <a href="/" aria-label="Hydras home" className="rounded">
          <HydrasMark />
        </a>
        <span className="text-[13px] font-semibold tracking-[-0.01em]">hydras</span>
        <span className="text-faint">/</span>
        <span className="truncate font-serif text-[17px] text-muted italic">{room.slug}</span>
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-keyshortcuts="Control+K"
        className="flex h-7 w-[min(360px,36vw)] items-center gap-2 rounded-[var(--radius-chrome)] border border-line-soft bg-surface-soft px-2.5 text-[12.5px] text-faint transition-colors duration-150 hover:border-line hover:text-muted"
      >
        <Search size={13} strokeWidth={2} />
        <span className="flex-1 truncate text-left">Search files and commands</span>
        <Kbd>Ctrl K</Kbd>
      </button>

      <div className="flex items-center justify-end gap-1">
        <AvatarStack people={people} />
        <span className="mx-1.5 h-4 w-px bg-line" />
        <IconButton
          label="Toggle files panel (Ctrl+B)"
          active={layout.showFiles}
          onClick={() => setLayout({ showFiles: !layout.showFiles })}
        >
          <PanelLeft size={15} />
        </IconButton>
        <IconButton
          label="Toggle inspector (Ctrl+I)"
          active={layout.showInspector}
          onClick={() => setLayout({ showInspector: !layout.showInspector })}
        >
          <PanelRight size={15} />
        </IconButton>
        <IconButton label={themeKind === 'dark' ? 'Light theme' : 'Dark theme'} onClick={flipTheme}>
          {themeKind === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>
        <IconButton label="Settings (Ctrl+,)" onClick={() => openSettings()}>
          <Settings2 size={15} />
        </IconButton>
        <button
          type="button"
          onClick={() => void copyInviteAction(room.slug)}
          className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-chrome)] bg-fg px-2.5 text-[12px] font-semibold text-bg transition-opacity duration-150 hover:opacity-85"
        >
          <Share2 size={13} strokeWidth={2.2} />
          Share
        </button>
      </div>
    </header>
  )
}
