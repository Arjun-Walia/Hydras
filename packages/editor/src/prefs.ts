/**
 * User-adjustable editor preferences, applied through CodeMirror compartments so they
 * change live without remounting the view (and without losing undo or cursor state).
 */
import { Compartment, type Extension } from '@codemirror/state'
import { EditorView, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'

export interface EditorPrefs {
  /** Code font size in px, 11-18. */
  fontSize: number
  lineNumbers: boolean
  wrapLines: boolean
}

export const MIN_CODE_SIZE = 11
export const MAX_CODE_SIZE = 18

export const defaultEditorPrefs: EditorPrefs = {
  fontSize: 13,
  lineNumbers: true,
  wrapLines: false,
}

export function clampCodeSize(size: number): number {
  if (!Number.isFinite(size)) return defaultEditorPrefs.fontSize
  return Math.min(MAX_CODE_SIZE, Math.max(MIN_CODE_SIZE, Math.round(size)))
}

export interface PrefCompartments {
  gutter: Compartment
  wrap: Compartment
  size: Compartment
}

export function createPrefCompartments(): PrefCompartments {
  return { gutter: new Compartment(), wrap: new Compartment(), size: new Compartment() }
}

function gutterFor(prefs: EditorPrefs): Extension {
  return prefs.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
}

function sizeFor(prefs: EditorPrefs): Extension {
  return EditorView.theme({ '&': { fontSize: `${clampCodeSize(prefs.fontSize)}px` } })
}

export function prefExtensions(c: PrefCompartments, prefs: EditorPrefs): Extension[] {
  return [
    c.gutter.of(gutterFor(prefs)),
    c.wrap.of(prefs.wrapLines ? EditorView.lineWrapping : []),
    c.size.of(sizeFor(prefs)),
  ]
}

export function reconfigurePrefs(view: EditorView, c: PrefCompartments, prefs: EditorPrefs): void {
  view.dispatch({
    effects: [
      c.gutter.reconfigure(gutterFor(prefs)),
      c.wrap.reconfigure(prefs.wrapLines ? EditorView.lineWrapping : []),
      c.size.reconfigure(sizeFor(prefs)),
    ],
  })
}
