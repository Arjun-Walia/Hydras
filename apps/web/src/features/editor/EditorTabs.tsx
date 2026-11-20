/**
 * Open-file tabs with per-file presence dots and a middle-click / button close.
 */
import { X } from 'lucide-react'
import { cn } from '@hydras/ui'
import { useCurrentRoom } from '../../app/room-context'
import { useUiStore } from '../../app/ui-store'
import { useReadable } from '../../hooks/use-readable'

type Props = {
  names: ReadonlyMap<string, string>
}

export function EditorTabs({ names }: Props) {
  const room = useCurrentRoom()
  const peers = useReadable(room.peers)
  const openTabs = useUiStore((s) => s.openTabs)
  const activeFileId = useUiStore((s) => s.activeFileId)
  const openFile = useUiStore((s) => s.openFile)
  const closeTab = useUiStore((s) => s.closeTab)

  if (openTabs.length === 0)
    return <div className="h-[var(--tab-h)] shrink-0 border-b border-line-soft" />

  return (
    <div
      role="tablist"
      className="flex h-[var(--tab-h)] shrink-0 items-stretch overflow-x-auto border-b border-line-soft"
    >
      {openTabs.map((id) => {
        const isActive = id === activeFileId
        const here = peers.filter((p) => !p.isSelf && p.activeFile === id)
        return (
          <div
            key={id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => openFile(id)}
            onKeyDown={(event) => event.key === 'Enter' && openFile(id)}
            onAuxClick={(event) => event.button === 1 && closeTab(id)}
            className={cn(
              'group relative flex cursor-pointer items-center gap-2 border-r border-line-soft pr-1.5 pl-3 text-[12.5px] whitespace-nowrap transition-colors duration-150',
              isActive ? 'bg-bg text-fg' : 'bg-surface-soft text-muted hover:text-fg',
            )}
          >
            {isActive && <span className="absolute inset-x-0 top-0 h-px bg-accent" />}
            <span title={names.get(id)}>{(names.get(id) ?? 'untitled').split('/').pop()}</span>
            {here.map((peer) => (
              <span
                key={peer.clientId}
                title={peer.user.name}
                className="size-1.5 rounded-full"
                style={{ background: peer.user.color }}
              />
            ))}
            <button
              type="button"
              aria-label={`Close ${names.get(id) ?? 'tab'}`}
              onClick={(event) => {
                event.stopPropagation()
                closeTab(id)
              }}
              className="grid size-5 place-items-center rounded text-faint opacity-0 group-hover:opacity-100 hover:bg-surface-raised hover:text-fg focus-visible:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
