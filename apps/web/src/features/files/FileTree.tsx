/**
 * Project tree + Trash. Files are stored by relative path ("src/app/main.ts"); the tree is
 * derived from those paths. Folders collapse; ancestors of the open file auto-expand.
 * All mutations go through app/actions -> the sync files API.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, FilePlus2, FolderOpen, RotateCcw } from 'lucide-react'
import type { FileEntry, Peer } from '@hydras/shared'
import { buildFileTree, resolveDisplayNames, type TreeNode } from '@hydras/sync'
import { Eyebrow, IconButton, cn } from '@hydras/ui'
import { createFileAction, openFolderAction } from '../../app/actions'
import { useCurrentRoom } from '../../app/room-context'
import { useUiStore } from '../../app/ui-store'
import { useReadable } from '../../hooks/use-readable'
import { canOpenFolders } from '../../platform/open-folder'
import { FileRow } from './FileRow'
import { NameInput } from './NameInput'

function peersByFile(peers: readonly Peer[]): Map<string, Peer[]> {
  const result = new Map<string, Peer[]>()
  for (const peer of peers) {
    if (peer.isSelf || !peer.activeFile) continue
    result.set(peer.activeFile, [...(result.get(peer.activeFile) ?? []), peer])
  }
  return result
}

function ancestors(path: string): string[] {
  const parts = path.split('/')
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

export function FileTree() {
  const room = useCurrentRoom()
  const files = useReadable(room.files)
  const peers = useReadable(room.peers)
  const folder = useReadable(room.folder)
  const activeFileId = useUiStore((s) => s.activeFileId)
  const [isCreating, setIsCreating] = useState(false)
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const names = useMemo(() => resolveDisplayNames(files), [files])
  const tree = useMemo(() => buildFileTree(files, names), [files, names])
  const trashed = files.filter((file) => file.deletedAt !== null)
  const visibleCount = files.length - trashed.length
  const presence = peersByFile(peers)
  const activePath = activeFileId ? names.get(activeFileId) : undefined

  useEffect(() => {
    if (!activePath) return
    setExpanded((prev) => {
      const missing = ancestors(activePath).filter((p) => !prev.has(p))
      return missing.length === 0 ? prev : new Set([...prev, ...missing])
    })
  }, [activePath])

  const toggleFolder = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const handleCreate = (name: string) => {
    setIsCreating(false)
    createFileAction(room, name)
  }

  const renderNodes = (nodes: readonly TreeNode[], depth: number) =>
    nodes.map((node) =>
      node.kind === 'folder' ? (
        <li key={`d:${node.path}`}>
          <FolderRow
            name={node.name}
            depth={depth}
            isOpen={expanded.has(node.path)}
            onToggle={() => toggleFolder(node.path)}
          />
          {expanded.has(node.path) && <ul>{renderNodes(node.children, depth + 1)}</ul>}
        </li>
      ) : (
        <FileRow
          key={node.id}
          fileId={node.id}
          path={node.path}
          label={node.name}
          depth={depth}
          isActive={node.id === activeFileId}
          peers={presence.get(node.id) ?? []}
        />
      ),
    )

  return (
    <aside className="flex h-full flex-col bg-surface-soft" aria-label="Files">
      <div className="flex h-9 items-center justify-between gap-2 pr-1.5 pl-3">
        <Eyebrow className="truncate">{folder ? folder.name : 'Files'}</Eyebrow>
        <span className="flex shrink-0 items-center">
          {!folder && canOpenFolders() && (
            <IconButton label="Open folder…" onClick={() => void openFolderAction()}>
              <FolderOpen size={14} />
            </IconButton>
          )}
          <IconButton label="New file (use / for folders)" onClick={() => setIsCreating(true)}>
            <FilePlus2 size={14} />
          </IconButton>
        </span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {isCreating && (
          <li className="px-1.5 py-0.5">
            <NameInput
              initial=""
              placeholder="src/name.ts"
              onSubmit={handleCreate}
              onCancel={() => setIsCreating(false)}
            />
          </li>
        )}
        {renderNodes(tree, 0)}
        {visibleCount === 0 && !isCreating && (
          <li className="px-3 py-6 text-center font-serif text-[18px] text-faint italic">
            {folder?.status.state === 'importing' ? 'Reading folder…' : 'Nothing here yet'}
          </li>
        )}
      </ul>

      <TrashSection
        files={trashed}
        names={names}
        isOpen={isTrashOpen}
        onToggle={() => setIsTrashOpen((open) => !open)}
        onRestore={(id) => room.restoreFile(id)}
      />
    </aside>
  )
}

type FolderRowProps = { name: string; depth: number; isOpen: boolean; onToggle: () => void }

function FolderRow({ name, depth, isOpen, onToggle }: FolderRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      style={{ paddingLeft: 6 + depth * 12 }}
      className="flex h-[var(--row-h)] w-full items-center gap-1.5 rounded-[var(--radius-chrome)] pr-2 text-left text-[12.5px] text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-fg"
    >
      <ChevronRight
        size={12}
        className={cn(
          'shrink-0 text-faint transition-transform duration-150',
          isOpen && 'rotate-90',
        )}
      />
      <span className="truncate">{name}</span>
    </button>
  )
}

type TrashProps = {
  files: readonly FileEntry[]
  names: ReadonlyMap<string, string>
  isOpen: boolean
  onToggle: () => void
  onRestore: (id: string) => void
}

function TrashSection({ files, names, isOpen, onToggle, onRestore }: TrashProps) {
  return (
    <div className="border-t border-line-soft px-1.5 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex h-7 w-full items-center gap-1 rounded-[var(--radius-chrome)] px-1.5 hover:bg-surface-raised"
      >
        <ChevronRight
          size={12}
          className={cn('text-faint transition-transform duration-150', isOpen && 'rotate-90')}
        />
        <Eyebrow>Trash ({files.length})</Eyebrow>
      </button>
      {isOpen && (
        <ul className="mt-0.5 max-h-40 overflow-y-auto">
          {files.length === 0 && <li className="px-3 py-1.5 text-[12px] text-faint">Empty</li>}
          {files.map((file) => (
            <li
              key={file.id}
              className="group flex h-7 items-center gap-2 rounded-[var(--radius-chrome)] pr-1 pl-6 text-[12.5px] text-faint"
            >
              <span className="flex-1 truncate line-through decoration-faint/50">
                {names.get(file.id) ?? file.name}
              </span>
              <IconButton
                label={`Restore ${file.name}`}
                className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => onRestore(file.id)}
              >
                <RotateCcw size={12} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
