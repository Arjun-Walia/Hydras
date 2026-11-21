/**
 * File extension -> CodeMirror language. Unknown extensions stay plain text.
 * Grammars are imported on demand so a room that only edits Markdown does not
 * download the Python and TypeScript parsers up front.
 */
import type { Extension } from '@codemirror/state'

const LOADERS: Record<string, () => Promise<Extension>> = {
  js: async () => (await import('@codemirror/lang-javascript')).javascript(),
  jsx: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true }),
  ts: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true }),
  tsx: async () =>
    (await import('@codemirror/lang-javascript')).javascript({ typescript: true, jsx: true }),
  json: async () => (await import('@codemirror/lang-json')).json(),
  md: async () => (await import('@codemirror/lang-markdown')).markdown(),
  py: async () => (await import('@codemirror/lang-python')).python(),
}

/** The extension we will highlight, or null for plain text. */
export function languageId(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.')
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''
  return ext in LOADERS ? ext : null
}

export async function loadLanguage(fileName: string): Promise<Extension> {
  const id = languageId(fileName)
  if (!id) return []
  return LOADERS[id]!()
}
