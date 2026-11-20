/**
 * One file in the tree: open on click, rename (full path, so it can move folders) on
 * double-click, trash on hover. Shows a dot per collaborator who has this file open.
 */
import { useState } from 'react'
import { FileCode2, FileText, Trash2 } from 'lucide-react'
import type { Peer } from '@hydras/shared'
import { IconButton, cn } from '@hydras/ui'
import { deleteFileAction, renameFileAction } from '../../app/actions'
import { useCurrentRoom } from '../../app/room-context'
import { useUiStore } from '../../app/ui-store'
import { NameInput } from './NameInput'

type Props = {
  fileId: string
  /** Full relative path, e.g. "src/app/main.ts". */
  path: string
  /** What the row shows: the file's own name. */
  label: string
  depth: number
  isActive: boolean
  peers: readonly Peer[]
}

const TEXT_EXTENSIONS = /\.(md|txt|rst)$/i

export function FileRow({ fileId, path, label, depth, isActive, peers }: Props) {
  const room = useCurrentRoom()
  const openFile = useUiStore((s) => s.openFile)
  const [isRenaming, setIsRenaming] = useState(false)
  const Icon = TEXT_EXTENSIONS.test(label) ? FileText : FileCode2
  const indent = 6 + depth * 12 + 14

  if (isRenaming) {
    return (
      <li className="py-0.5 pr-1.5" style={{ paddingLeft: indent - 8 }}>
        <NameInput
          initial={path}
          onSubmit={(name) => {
            setIsRenaming(false)
            renameFileAction(room, fileId, name)
          }}
          onCancel={() => setIsRenaming(false)}
        />
      </li>
    )
  }

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => openFile(fileId)}
        onDoubleClick={() => !room.readOnly && setIsRenaming(true)}
        title={`${path} (double-click to rename or move)`}
        style={{ paddingLeft: indent }}
        className={cn(
          'flex h-[var(--row-h)] w-full items-center gap-2 rounded-[var(--radius-chrome)] pr-8 text-left text-[12.5px] transition-colors duration-150',
          isActive ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-surface-raised hover:text-fg',
        )}
      >
        <Icon size={13} className={cn('shrink-0', isActive ? 'text-accent' : 'text-faint')} />
        <span className="flex-1 truncate">{label}</span>
        <span className="flex -space-x-0.5">
          {peers.slice(0, 3).map((peer) => (
            <span
              key={peer.clientId}
              title={`${peer.user.name} is here`}
              className="size-1.5 rounded-full ring-1 ring-surface-soft"
              style={{ background: peer.user.color }}
            />
          ))}
        </span>
      </button>
      <IconButton
        disabled={room.readOnly}
        label={`Move ${label} to Trash`}
        className="absolute top-0.5 right-0.5 size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => deleteFileAction(room, fileId, label)}
      >
        <Trash2 size={12} />
      </IconButton>
    </li>
  )
}
