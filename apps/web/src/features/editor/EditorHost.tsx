/**
 * Mounts CodeMirror for one file. Remounted per file via `key`, so each file gets its own
 * view bound to its own Y.Text and its own per-user UndoManager. Editor preferences are
 * pushed into the live view without remounting.
 */
import { useEffect, useRef } from 'react'
import { mountEditor, type EditorHandle } from '@hydras/editor'
import { useCurrentRoom } from '../../app/room-context'
import { useSettingsStore } from '../../app/settings-store'
import { useUiStore } from '../../app/ui-store'

type Props = {
  fileId: string
  fileName: string
}

export function EditorHost({ fileId, fileName }: Props) {
  const room = useCurrentRoom()
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<EditorHandle | null>(null)
  const setCursor = useUiStore((s) => s.setCursor)
  const prefs = useSettingsStore((s) => s.editor)

  useEffect(() => {
    const parent = containerRef.current
    const binding = room.bindFile(fileId)
    if (!parent || !binding) return
    const editor = mountEditor({
      parent,
      binding,
      readOnly: room.readOnly,
      fileName,
      prefs: useSettingsStore.getState().editor,
      onCursor: setCursor,
    })
    handleRef.current = editor
    editor.focus()
    return () => {
      handleRef.current = null
      editor.destroy()
      setCursor(null)
    }
    // fileName only affects the language mode; renames keep the open view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, fileId, setCursor])

  useEffect(() => {
    handleRef.current?.setPrefs(prefs)
  }, [prefs])

  return <div ref={containerRef} className="h-full overflow-hidden" data-file-id={fileId} />
}
