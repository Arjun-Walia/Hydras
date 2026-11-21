/**
 * Title bar: brand + room + Code/Board switch, palette trigger, presence, panel toggles,
 * terminal, room tools, settings, share. Flex (not a 3-column grid) so the room name and
 * view switch keep their space at narrow widths; secondary labels collapse first.
 */
import {
  Code2,
  Moon,
  PanelLeft,
  PanelRight,
  PenTool,
  Search,
  Settings2,
  Share2,
  SquareTerminal,
  Sun,
  Users,
} from 'lucide-react'
import { AvatarStack, HydrasMark, IconButton, Kbd, cn } from '@hydras/ui'
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
  const terminalOpen = useUiStore((s) => s.terminalOpen)
  const toggleTerminal = useUiStore((s) => s.toggleTerminal)
  const setRoomPanelOpen = useUiStore((s) => s.setRoomPanelOpen)

  const people = peers.map((peer) => ({
    key: peer.clientId,
    name: peer.user.name,
    color: peer.user.color,
    isSelf: peer.isSelf,
  }))

  const flipTheme = () => setTheme(themeKind === 'dark' ? 'hydras-paper' : 'hydras-graphite')

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line-soft px-3">
      <div className="flex min-w-0 shrink items-center gap-2">
        <a href="/" aria-label="Hydras home" className="shrink-0 rounded">
          <HydrasMark size={20} />
        </a>
        <span className="hidden text-[13px] font-semibold tracking-[-0.01em] lg:inline">
          hydras
        </span>
        <span className="hidden text-faint lg:inline">/</span>
        <span
          className="min-w-[4ch] truncate font-serif text-[17px] text-muted italic"
          title={room.slug}
        >
          {room.slug}
        </span>
        <ViewSwitch />
      </div>

      <div className="flex min-w-0 flex-1 justify-center">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-keyshortcuts="Control+K"
          aria-label="Search files and commands"
          className="flex h-7 w-full max-w-[360px] min-w-7 items-center gap-2 rounded-[var(--radius-chrome)] border border-line-soft bg-surface-soft px-2 text-[12.5px] text-faint transition-colors duration-150 hover:border-line hover:text-muted"
        >
          <Search size={13} strokeWidth={2} className="shrink-0" />
          <span className="hidden flex-1 truncate text-left md:inline">
            Search files and commands
          </span>
          <span className="hidden md:inline">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1">
        <span className="hidden sm:block">
          <AvatarStack people={people} />
        </span>
        <span className="mx-1.5 hidden h-4 w-px bg-line sm:block" />
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
        <IconButton
          label="Toggle terminal (Ctrl+`)"
          active={terminalOpen}
          onClick={() => toggleTerminal()}
        >
          <SquareTerminal size={15} />
        </IconButton>
        <IconButton label="Room: members, folder, backups" onClick={() => setRoomPanelOpen(true)}>
          <Users size={15} />
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
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
    </header>
  )
}

/** Code editor or the room's shared whiteboard. */
function ViewSwitch() {
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const options = [
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'board', label: 'Board', icon: PenTool },
  ] as const
  return (
    <div
      role="tablist"
      aria-label="Workspace view"
      className="ml-2 flex h-7 shrink-0 items-center rounded-[var(--radius-chrome)] border border-line-soft bg-surface-soft p-0.5"
    >
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={view === id}
          aria-label={label}
          onClick={() => setView(id)}
          className={cn(
            'flex h-full items-center gap-1.5 rounded-[4px] px-2.5 text-[12px] font-medium transition-colors duration-150',
            view === id ? 'bg-surface-raised text-fg shadow-xs' : 'text-muted hover:text-fg',
          )}
        >
          <Icon size={13} aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
