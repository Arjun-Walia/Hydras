/**
 * Quick-open ranking for the command palette. Pure, and cheap enough to run on every
 * keystroke over 100,000 paths: the palette renders only the top results, never the
 * whole project (cmdk renders every item it is given).
 *
 * Scoring: the query's characters must appear in order (case-insensitive). Matches in
 * the file name beat matches in folders; contiguous runs, word starts ("/", ".", "-",
 * "_", camelCase) and shorter paths score higher.
 */

export interface RankedFile {
  id: string
  path: string
  score: number
}

const BOUNDARY = new Set(['/', '.', '-', '_', ' '])

/** Subsequence score of `query` (lowercase) in `path`, or -1 when it doesn't match. */
export function scorePath(path: string, query: string): number {
  if (query.length === 0) return 0
  const lower = path.toLowerCase()
  const nameStart = path.lastIndexOf('/') + 1
  let score = 0
  let from = 0
  let previous = -2
  for (const char of query) {
    const at = lower.indexOf(char, from)
    if (at < 0) return -1
    score += 1
    if (at === previous + 1) score += 4 // contiguous run
    const before = path[at - 1]
    const isUpper = path[at] !== lower[at]
    if (at === 0 || (before && BOUNDARY.has(before)) || isUpper) score += 3
    if (at >= nameStart) score += 2
    previous = at
    from = at + 1
  }
  if (lower.slice(nameStart).startsWith(query)) score += 10
  return score - path.length * 0.01
}

export function rankFiles(
  files: readonly { id: string; path: string }[],
  rawQuery: string,
  limit: number,
): RankedFile[] {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, '')
  if (query.length === 0) {
    return files.slice(0, limit).map((f) => ({ ...f, score: 0 }))
  }
  const top: RankedFile[] = []
  for (const file of files) {
    const score = scorePath(file.path, query)
    if (score < 0) continue
    if (top.length < limit) {
      top.push({ ...file, score })
      if (top.length === limit) top.sort((a, b) => b.score - a.score)
    } else if (score > top[top.length - 1]!.score) {
      top[top.length - 1] = { ...file, score }
      top.sort((a, b) => b.score - a.score)
    }
  }
  return top.sort((a, b) => b.score - a.score)
}
