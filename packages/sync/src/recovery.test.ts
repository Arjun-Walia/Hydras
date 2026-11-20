import { it, expect } from 'vitest'
import * as Y from 'yjs'
import { captureWorkspace, recoverWorkspace } from './recovery'
import { createFile, deleteFile, getFileText, listFiles } from './files'
it('recovers old and trashed content without overwriting current shared text', () => {
  const doc = new Y.Doc()
  const id = createFile(doc, { name: 'src/main.ts', content: 'original' })
  deleteFile(doc, id)
  const snapshot = captureWorkspace(doc, 'Before changes')
  getFileText(doc, id)!.insert(0, 'new ')
  recoverWorkspace(doc, snapshot)
  expect(getFileText(doc, id)!.toString()).toBe('new original')
  const recovered = listFiles(doc).find((f) => f.id !== id)!
  expect(recovered.deletedAt).toBeNull()
  expect(getFileText(doc, recovered.id)!.toString()).toBe('original')
  doc.destroy()
})
it('validates all imported paths before changing the document', () => {
  const doc = new Y.Doc()
  expect(() =>
    recoverWorkspace(doc, {
      id: 'a',
      name: 'bad',
      at: 0,
      files: [
        { name: 'ok', content: 'x', deleted: false },
        { name: '../escape', content: 'x', deleted: false },
      ],
    }),
  ).toThrow()
  expect(listFiles(doc)).toHaveLength(0)
  doc.destroy()
})
