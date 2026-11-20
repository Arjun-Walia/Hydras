/**
 * Turn "the file is now `next`" into the smallest single replace on a Y.Text.
 *
 * Writing a whole file as delete-all + insert-all would destroy every collaborator's
 * cursor and make concurrent edits interleave badly. Trimming the common prefix and
 * suffix keeps an external change (git pull, formatter, another editor) as a small
 * edit that merges with whatever others are typing elsewhere in the file.
 */
import type * as Y from 'yjs'

export interface TextEdit {
  index: number
  deleteCount: number
  insert: string
}

/** Pure: the single edit that turns `prev` into `next`, or null if they are equal. */
export function diffText(prev: string, next: string): TextEdit | null {
  if (prev === next) return null
  const maxPrefix = Math.min(prev.length, next.length)
  let start = 0
  while (start < maxPrefix && prev.charCodeAt(start) === next.charCodeAt(start)) start++

  // Don't split a surrogate pair at the start of the edit.
  if (start > 0 && isHighSurrogate(prev.charCodeAt(start - 1))) start--

  let endPrev = prev.length
  let endNext = next.length
  while (
    endPrev > start &&
    endNext > start &&
    prev.charCodeAt(endPrev - 1) === next.charCodeAt(endNext - 1)
  ) {
    endPrev--
    endNext--
  }
  if (endPrev < prev.length && isLowSurrogate(prev.charCodeAt(endPrev))) {
    endPrev++
    endNext++
  }

  return { index: start, deleteCount: endPrev - start, insert: next.slice(start, endNext) }
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

/** Apply `next` to `text` as one minimal edit inside a transaction with `origin`. */
export function applyTextUpdate(text: Y.Text, next: string, origin: unknown): boolean {
  const edit = diffText(text.toString(), next)
  if (!edit) return false
  const doc = text.doc
  const run = () => {
    if (edit.deleteCount > 0) text.delete(edit.index, edit.deleteCount)
    if (edit.insert) text.insert(edit.index, edit.insert)
  }
  if (doc) doc.transact(run, origin)
  else run()
  return true
}
