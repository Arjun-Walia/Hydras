/**
 * Command palette (cmdk): open file, new file, theme, inspector, chaos, undo, invite.
 */
import { Command } from 'cmdk'
import {
  FileCode2,
  FilePlus2,
  FolderOpen,
  Link,
  PanelRight,
  SquareTerminal,
  SunMoon,
  Undo2,
  WifiOff,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { resolveDisplayNames } from '@hydras/sync'
import { Kbd } from '@hydras/ui'
import {
  copyInviteAction,
  createFileAction,
  openFolderAction,
  toggleOfflineAction,
} from '../../app/actions'
import { useCurrentRoom } from '../../app/room-context'
import { useSettingsStore } from '../../app/settings-store'
import { useUiStore } from '../../app/ui-store'
import { useReadable } from '../../hooks/use-readable'

export function CommandPalette() {
  const room = useCurrentRoom()
  const files = useReadable(room.files)
  const connection = useReadable(room.connection)
  const isOpen = useUiStore((s) => s.paletteOpen)
  const setOpen = useUiStore((s) => s.setPaletteOpen)
  const [search, setSearch] = useState('')
  const names = useMemo(() => resolveDisplayNames(files), [files])

  const run = (fn: () => void) => () => {
    fn()
    setOpen(false)
    setSearch('')
  }
  const ui = useUiStore.getState
  const activeFileId = useUiStore((s) => s.activeFileId)

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={setOpen}
      label="Command palette"
      overlayClassName="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
      contentClassName="fixed top-[14vh] left-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[var(--radius-dialog)] border border-line bg-surface-raised shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)]"
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="Search files and commands…"
        className="h-12 w-full border-b border-line-soft bg-transparent px-4 text-[14px] text-fg outline-none placeholder:text-faint"
      />
      <Command.List className="max-h-[360px] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center font-serif text-[18px] text-faint italic">
          No matches
        </Command.Empty>

        <Group heading="Files">
          {files
            .filter((f) => f.deletedAt === null)
            .map((file) => (
              <Item
                key={file.id}
                value={`open ${names.get(file.id)}`}
                onSelect={run(() => ui().openFile(file.id))}
                icon={<FileCode2 size={14} />}
              >
                {names.get(file.id)}
              </Item>
            ))}
          {search.trim().length > 0 && (
            <Item
              value={`new file ${search}`}
              onSelect={run(() => createFileAction(room, search))}
              icon={<FilePlus2 size={14} />}
            >
              New file “{search.trim()}”
            </Item>
          )}
        </Group>

        <Group heading="Commands">
          <Item
            value="settings themes and layout"
            onSelect={run(() => ui().openSettings('theme'))}
            icon={<SunMoon size={14} />}
            hint="Ctrl ,"
          >
            Settings: themes and layout
          </Item>
          <Item
            value="toggle inspector"
            onSelect={run(() => {
              const { layout, setLayout } = useSettingsStore.getState()
              setLayout({ showInspector: !layout.showInspector })
            })}
            icon={<PanelRight size={14} />}
            hint="Ctrl I"
          >
            Toggle inspector
          </Item>
          <Item
            value="go offline online chaos"
            onSelect={run(() => toggleOfflineAction(room))}
            icon={<WifiOff size={14} />}
          >
            {connection.forcedOffline ? 'Go back online' : 'Go offline (chaos)'}
          </Item>
          {activeFileId && (
            <Item
              value="undo mine"
              onSelect={run(() => room.undo(activeFileId))}
              icon={<Undo2 size={14} />}
              hint="Ctrl Z"
            >
              Undo my last change
            </Item>
          )}
          <Item
            value="open folder project codebase"
            onSelect={run(() => void openFolderAction(room))}
            icon={<FolderOpen size={14} />}
          >
            Open folder…
          </Item>
          <Item
            value="toggle terminal shell console"
            onSelect={run(() => ui().toggleTerminal())}
            icon={<SquareTerminal size={14} />}
            hint="Ctrl `"
          >
            Toggle terminal
          </Item>
          <Item
            value="copy invite link share"
            onSelect={run(() => void copyInviteAction(room.slug))}
            icon={<Link size={14} />}
          >
            Copy invite link
          </Item>
        </Group>
      </Command.List>
    </Command.Dialog>
  )
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
    >
      {children}
    </Command.Group>
  )
}

type ItemProps = {
  value: string
  onSelect: () => void
  icon: ReactNode
  hint?: string
  children: ReactNode
}

function Item({ value, onSelect, icon, hint, children }: ItemProps) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[var(--radius-chrome)] px-2.5 text-[13px] text-muted data-[selected=true]:bg-accent-soft data-[selected=true]:text-fg"
    >
      <span className="text-faint">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {hint && <Kbd>{hint}</Kbd>}
    </Command.Item>
  )
}
