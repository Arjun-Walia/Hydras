/**
 * Mount one CodeMirror view for one file.
 *
 * Deliberately NOT using `basicSetup`: it ships CodeMirror's own history(), which would
 * fight Yjs undo. Undo/redo here come only from y-codemirror.next's UndoManager keymap,
 * driven by the per-file, per-user UndoManager owned by @hydras/sync.
 */
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
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
import { loadLanguage } from './languages'
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
  readOnly?: boolean
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
  readOnly = false,
}: MountEditorOptions): EditorHandle {
  const compartments = createPrefCompartments()
  const reportCursor = EditorView.updateListener.of((update) => {
    if (!onCursor || !(update.selectionSet || update.docChanged)) return
    const head = update.state.selection.main.head
    const line = update.state.doc.lineAt(head)
    onCursor({ line: line.number, column: head - line.from + 1 })
  })

  const language = new Compartment()
  let alive = true
  const state = EditorState.create({
    doc: binding.text.toString(),
    extensions: [
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.contentAttributes.of({
        'aria-label': `${fileName}, shared file. Undo reverts only your edits.`,
        'aria-multiline': 'true',
      }),
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
      language.of([]),
      hydrasChrome,
      hydrasHighlight,
      yCollab(binding.text, binding.awareness, { undoManager: binding.undoManager }),
      reportCursor,
    ],
  })

  const view = new EditorView({ state, parent })
  void loadLanguage(fileName).then(
    (extension) => {
      if (alive) view.dispatch({ effects: language.reconfigure(extension) })
    },
    () => {
      // Plain text is a usable editor. A failed grammar download must not unmount it.
    },
  )

  return {
    focus: () => view.focus(),
    setPrefs: (next) => reconfigurePrefs(view, compartments, next),
    destroy: () => {
      alive = false
      view.destroy()
    },
  }
}
