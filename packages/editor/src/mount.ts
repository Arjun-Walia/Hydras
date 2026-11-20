/**
 * Mount one CodeMirror view for one file.
 *
 * Deliberately NOT using `basicSetup`: it ships CodeMirror's own history(), which would
 * fight Yjs undo. Undo/redo here come only from y-codemirror.next's UndoManager keymap,
 * driven by the per-file, per-user UndoManager owned by @hydras/sync.
 */
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  keymap,
  rectangularSelection,
} from '@codemirror/view'
import type { FileBinding } from '@hydras/sync'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import { languageFor } from './languages'
import {
  createPrefCompartments,
  defaultEditorPrefs,
  prefExtensions,
  reconfigurePrefs,
  type EditorPrefs,
} from './prefs'
import { hydrasChrome, hydrasHighlight } from './theme'

export interface MountEditorOptions {
  parent: HTMLElement
  binding: FileBinding
  fileName: string
  prefs?: EditorPrefs
  onCursor?: (position: { line: number; column: number }) => void
}

export interface EditorHandle {
  focus(): void
  setPrefs(prefs: EditorPrefs): void
  destroy(): void
}

export function mountEditor({
  parent,
  binding,
  fileName,
  prefs = defaultEditorPrefs,
  onCursor,
}: MountEditorOptions): EditorHandle {
  const compartments = createPrefCompartments()
  const reportCursor = EditorView.updateListener.of((update) => {
    if (!onCursor || !(update.selectionSet || update.docChanged)) return
    const head = update.state.selection.main.head
    const line = update.state.doc.lineAt(head)
    onCursor({ line: line.number, column: head - line.from + 1 })
  })

  const state = EditorState.create({
    doc: binding.text.toString(),
    extensions: [
      ...prefExtensions(compartments, prefs),
      highlightActiveLine(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      indentOnInput(),
      bracketMatching(),
      EditorState.allowMultipleSelections.of(true),
      EditorState.tabSize.of(2),
      keymap.of([...yUndoManagerKeymap, ...defaultKeymap, indentWithTab]),
      languageFor(fileName),
      hydrasChrome,
      hydrasHighlight,
      yCollab(binding.text, binding.awareness, { undoManager: binding.undoManager }),
      reportCursor,
    ],
  })

  const view = new EditorView({ state, parent })

  return {
    focus: () => view.focus(),
    setPrefs: (next) => reconfigurePrefs(view, compartments, next),
    destroy: () => view.destroy(),
  }
}
