/**
 * Tabs + the editor for the active file. Keeps tabs consistent with the file list
 * (trashed files close) and tells the room which file this user is looking at.
 */
import { useEffect, useMemo } from 'react'
import { resolveDisplayNames } from '@hydras/sync'
import { EmptyState } from '@hydras/ui'
import { useCurrentRoom } from '../../app/room-context'
import { useUiStore } from '../../app/ui-store'
import { useReadable } from '../../hooks/use-readable'
import { EditorHost } from './EditorHost'
import { EditorTabs } from './EditorTabs'

export function EditorArea() {
  const room = useCurrentRoom()
  const files = useReadable(room.files)
  const activeFileId = useUiStore((s) => s.activeFileId)
  const openFile = useUiStore((s) => s.openFile)
  const pruneTabs = useUiStore((s) => s.pruneTabs)

  const names = useMemo(() => resolveDisplayNames(files), [files])
  const visibleIds = useMemo(
    () => new Set(files.filter((f) => f.deletedAt === null).map((f) => f.id)),
    [files],
  )

  // Close tabs for files that were trashed (by anyone); open the first file on arrival.
  useEffect(() => {
    pruneTabs(visibleIds)
    const { openTabs } = useUiStore.getState()
    const first = files.find((f) => f.deletedAt === null)
    if (openTabs.length === 0 && first) openFile(first.id)
  }, [files, visibleIds, pruneTabs, openFile])

  useEffect(() => {
    room.setActiveFile(activeFileId)
  }, [room, activeFileId])

  const activeName = activeFileId ? names.get(activeFileId) : undefined

  return (
    <section className="flex h-full min-w-0 flex-col" aria-label="Editor">
      <EditorTabs names={names} />
      <div className="min-h-0 flex-1">
        {activeFileId && activeName ? (
          <EditorHost key={activeFileId} fileId={activeFileId} fileName={activeName} />
        ) : (
          <EmptyState
            title={
              <>
                Nothing open <em>yet</em>
              </>
            }
            hint="Pick a file on the left, or press Ctrl K to search."
          />
        )}
      </div>
    </section>
  )
}
