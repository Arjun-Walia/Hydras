import { describe, expect, it } from 'vitest'
import { rankFiles, scorePath } from './file-search'

const files = [
  'src/app/main.ts',
  'src/features/editor/EditorHost.tsx',
  'docs/editor-notes.md',
  'packages/sync/src/room.ts',
  'README.md',
].map((path, i) => ({ id: String(i), path }))

describe('quick-open ranking', () => {
  it('requires the query characters in order', () => {
    expect(scorePath('src/app/main.ts', 'mts')).toBeGreaterThan(0)
    expect(scorePath('src/app/main.ts', 'tsm')).toBe(-1)
  })

  it('prefers file-name matches over folder matches', () => {
    expect(rankFiles(files, 'editor', 5)[0]?.path).toBe('docs/editor-notes.md')
    expect(rankFiles(files, 'edhost', 5)[0]?.path).toBe('src/features/editor/EditorHost.tsx')
    expect(rankFiles(files, 'room', 5)[0]?.path).toBe('packages/sync/src/room.ts')
  })

  it('returns the first files unranked for an empty query, capped at the limit', () => {
    expect(rankFiles(files, '  ', 2).map((f) => f.path)).toEqual([
      'src/app/main.ts',
      'src/features/editor/EditorHost.tsx',
    ])
  })

  it('keeps only the top results over a very large project', () => {
    const many = Array.from({ length: 100_000 }, (_, i) => ({
      id: String(i),
      path: `pkg${i % 97}/src/file${i}.ts`,
    }))
    const started = performance.now()
    const ranked = rankFiles(many, 'file4242', 50)
    expect(ranked.length).toBeLessThanOrEqual(50)
    expect(ranked[0]?.path).toMatch(/file4242\.ts$/)
    expect(performance.now() - started).toBeLessThan(1_000)
  })
})
