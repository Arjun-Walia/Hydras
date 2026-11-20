import type * as Y from 'yjs'
import { createFile, getFileText, listFiles, validateFilePath } from './files'
export interface WorkspaceSnapshot {
  id: string
  name: string
  at: number
  files: { name: string; content: string; deleted: boolean }[]
}
export function captureWorkspace(doc: Y.Doc, name: string): WorkspaceSnapshot {
  return {
    id: crypto.randomUUID(),
    name: name.slice(0, 80),
    at: Date.now(),
    files: listFiles(doc).map((f) => ({
      name: f.name,
      content: getFileText(doc, f.id)?.toString() ?? '',
      deleted: f.deletedAt !== null,
    })),
  }
}
export function recoverWorkspace(doc: Y.Doc, snapshot: WorkspaceSnapshot): void {
  if (!snapshot || !Array.isArray(snapshot.files) || snapshot.files.length > 10000)
    throw Error('Invalid snapshot')
  const prefix = 'recovered-' + Date.now() + '-' + crypto.randomUUID().slice(0, 6)
  const entries = snapshot.files.map((f) => ({
    name: validateFilePath(`${prefix}/${f.name}`),
    content: f.content,
  }))
  if (entries.some((f) => typeof f.content !== 'string')) throw Error('Invalid snapshot content')
  doc.transact(() => {
    for (const file of entries) createFile(doc, file)
  })
}
