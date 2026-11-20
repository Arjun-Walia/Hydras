import { describe, expect, it } from 'vitest'
import type { FileEntry } from '@hydras/shared'
import { buildFileTree, type TreeNode } from './file-tree'

const entry = (id: string, name: string, deletedAt: number | null = null): FileEntry => ({
  id,
  name,
  createdAt: 1,
  deletedAt,
})

const shape = (nodes: TreeNode[]): unknown =>
  nodes.map((n) => (n.kind === 'folder' ? { [n.name + '/']: shape(n.children) } : n.name))

describe('buildFileTree', () => {
  it('nests by path, folders first, natural sort', () => {
    const files = [
      entry('1', 'README.md'),
      entry('2', 'src/main.ts'),
      entry('3', 'src/lib/a.ts'),
      entry('4', 'src/file10.ts'),
      entry('5', 'src/file2.ts'),
      entry('6', 'docs/guide.md'),
    ]
    const names = new Map(files.map((f) => [f.id, f.name]))
    expect(shape(buildFileTree(files, names))).toEqual([
      { 'docs/': ['guide.md'] },
      { 'src/': [{ 'lib/': ['a.ts'] }, 'file2.ts', 'file10.ts', 'main.ts'] },
      'README.md',
    ])
  })

  it('skips trashed files and uses display names', () => {
    const files = [entry('1', 'a.ts'), entry('2', 'a.ts'), entry('3', 'b.ts', 5)]
    const names = new Map([
      ['1', 'a.ts'],
      ['2', 'a (2).ts'],
      ['3', 'b.ts'],
    ])
    expect(shape(buildFileTree(files, names))).toEqual(['a (2).ts', 'a.ts'])
  })
})
