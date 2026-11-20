/**
 * Main screen (vault: Screens and Layout): title bar, resizable files | editor | inspector,
 * a terminal panel under the editor, status bar. Owns the Room, its folder link and the
 * global shortcuts.
 */
import { useEffect } from 'react'
import type { UserIdentity } from '@hydras/shared'
import type { Room } from '@hydras/sync'
import { FolderSync } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { RoomContext } from '../../app/room-context'
import { useSettingsStore } from '../../app/settings-store'
import { useUiStore } from '../../app/ui-store'
import { useModHotkey } from '../../hooks/use-hotkey'
import { useRoom } from '../../hooks/use-room'
import { EditorArea } from '../editor/EditorArea'
import { FileTree } from '../files/FileTree'
import { useFolderLink, type FolderLinkState } from '../folder/use-folder-link'
import { Inspector } from '../inspector/Inspector'
import { CommandPalette } from '../palette/CommandPalette'
import { useMergeToasts } from '../presence/use-merge-toasts'
import { SettingsDialog } from '../settings/SettingsDialog'
import { TerminalPanel } from '../terminal/TerminalPanel'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'

type Props = {
  slug: string
  identity: UserIdentity
}

function toggleLayout(key: 'showFiles' | 'showInspector') {
  const { layout, setLayout } = useSettingsStore.getState()
  setLayout({ [key]: !layout[key] })
}

export function Workspace({ slug, identity }: Props) {
  const room = useRoom(slug, identity)

  useModHotkey('k', () => {
    const { paletteOpen, setPaletteOpen } = useUiStore.getState()
    setPaletteOpen(!paletteOpen)
  })
  useModHotkey('i', () => toggleLayout('showInspector'))
  useModHotkey('b', () => toggleLayout('showFiles'))
  useModHotkey(',', () => useUiStore.getState().openSettings())
  useModHotkey('`', () => useUiStore.getState().toggleTerminal())

  useEffect(() => {
    document.title = `${slug} · Hydras`
  }, [slug])

  if (!room) return <div className="h-full bg-bg" />
  return <RoomWorkspace key={room.slug} room={room} />
}

function RoomWorkspace({ room }: { room: Room }) {
  const showFiles = useSettingsStore((s) => s.layout.showFiles)
  const showInspector = useSettingsStore((s) => s.layout.showInspector)
  const terminalOpen = useUiStore((s) => s.terminalOpen)
  const folderLink = useFolderLink(room)
  useMergeToasts(room)

  return (
    <RoomContext.Provider value={room}>
      <div className="flex h-full flex-col bg-bg text-fg">
        <TitleBar />
        <ReconnectBanner state={folderLink} />
        <Group orientation="horizontal" className="min-h-0 flex-1">
          {showFiles && (
            <>
              <Panel id="files" defaultSize="230px" minSize="170px" maxSize="420px">
                <FileTree />
              </Panel>
              <Separator />
            </>
          )}
          <Panel id="editor" minSize="320px">
            <Group orientation="vertical" className="h-full">
              <Panel id="code" minSize="120px">
                <EditorArea />
              </Panel>
              {terminalOpen && (
                <>
                  <Separator className="separator-h" />
                  <Panel id="terminal" defaultSize="34%" minSize="90px">
                    <TerminalPanel />
                  </Panel>
                </>
              )}
            </Group>
          </Panel>
          {showInspector && (
            <>
              <Separator />
              <Panel id="inspector" defaultSize="300px" minSize="240px" maxSize="480px">
                <Inspector />
              </Panel>
            </>
          )}
        </Group>
        <StatusBar />
      </div>
      <CommandPalette />
      <SettingsDialog />
    </RoomContext.Provider>
  )
}

/** Browsers forget folder permission on reload; reconnecting needs a click. */
function ReconnectBanner({ state }: { state: FolderLinkState }) {
  if (state.kind !== 'needs-permission') return null
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line-soft bg-accent-soft px-3 text-[12.5px]">
      <FolderSync size={14} className="text-accent" />
      <span>
        Reconnect <b>{state.name}</b> to keep this room in sync with the folder on your disk.
      </span>
      <button
        type="button"
        onClick={() => void state.reconnect()}
        className="ml-auto h-6 rounded-[var(--radius-chrome)] bg-accent px-3 text-[12px] font-semibold text-[var(--accent-ink)]"
      >
        Reconnect folder
      </button>
    </div>
  )
}
