/**
 * Editor chrome and syntax colors. Everything reads CSS variables from the app's tokens,
 * so switching `data-theme` re-themes the editor without rebuilding it.
 */
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const hydrasChrome = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--fg)',
    backgroundColor: 'var(--bg)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.65',
    fontVariantLigatures: 'none',
  },
  '.cm-content': { caretColor: 'var(--accent)', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
    { backgroundColor: 'var(--selection)' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg)',
    color: 'var(--faint)',
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 4px', minWidth: '32px' },
  '.cm-activeLine': { backgroundColor: 'var(--surface-soft)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--muted)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--line)', outline: 'none' },
  // Remote carets from y-codemirror.next: name flag styled like the app chrome.
  '.cm-ySelectionInfo': {
    fontFamily: 'var(--font-ui)',
    fontSize: '10.5px',
    fontWeight: '600',
    letterSpacing: '0.01em',
    padding: '1px 5px',
    borderRadius: '4px 4px 4px 0',
    top: '-1.35em',
    color: 'var(--bg)',
    opacity: '1',
    transition: 'opacity 160ms ease-out',
  },
  '.cm-ySelectionCaret': { borderLeftWidth: '2px' },
})

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-function)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--syn-type)' },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: 'var(--syn-comment, var(--faint))',
    fontStyle: 'italic',
  },
  { tag: [t.propertyName], color: 'var(--fg)' },
  { tag: [t.heading], color: 'var(--fg)', fontWeight: '600' },
  { tag: [t.link, t.url], color: 'var(--accent)', textDecoration: 'underline' },
  { tag: [t.emphasis], fontStyle: 'italic' },
  { tag: [t.strong], fontWeight: '600' },
])

export const hydrasHighlight = syntaxHighlighting(highlight)
