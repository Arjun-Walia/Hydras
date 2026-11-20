/**
 * @hydras/editor: CodeMirror 6 wired to a file's Y.Text.
 * Invariant: never talks to the network and never imports yjs; it receives a FileBinding
 * from @hydras/sync and hands it to y-codemirror.next.
 */
export { mountEditor } from './mount'
export type { EditorHandle, MountEditorOptions } from './mount'
export { languageFor } from './languages'
export { MAX_CODE_SIZE, MIN_CODE_SIZE, clampCodeSize, defaultEditorPrefs } from './prefs'
export type { EditorPrefs } from './prefs'
