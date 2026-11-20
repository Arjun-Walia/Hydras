/**
 * Build a folder tree from flat file paths for the sidebar. Pure.
 * Folders sort before files; both alphabetically, case-insensitively, like VS Code / Zed.
 */
import type { FileEntry } from '@hydras/shared'

export interface TreeFile {
  kind: 'file'
  id: string
  name: string
  path: string
}

export interface TreeFolder {
  kind: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

export type TreeNode = TreeFile | TreeFolder

const byName = (a: TreeNode, b: TreeNode) =>
  a.kind !== b.kind
    ? a.kind === 'folder'
      ? -1
      : 1
    : a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })

/** `names` maps file id -> display path (see resolveDisplayNames). Trashed files are skipped. */
export function buildFileTree(
  entries: readonly FileEntry[],
  names: ReadonlyMap<string, string>,
): TreeNode[] {
  const root: TreeFolder = { kind: 'folder', name: '', path: '', children: [] }
  const folders = new Map<string, TreeFolder>([['', root]])

  const folderFor = (path: string): TreeFolder => {
    const existing = folders.get(path)
    if (existing) return existing
    const slash = path.lastIndexOf('/')
    const parent = folderFor(slash < 0 ? '' : path.slice(0, slash))
    const folder: TreeFolder = { kind: 'folder', name: path.slice(slash + 1), path, children: [] }
    parent.children.push(folder)
    folders.set(path, folder)
    return folder
  }

  for (const entry of entries) {
    if (entry.deletedAt !== null) continue
    const path = names.get(entry.id) ?? entry.name
    const slash = path.lastIndexOf('/')
    const parent = folderFor(slash < 0 ? '' : path.slice(0, slash))
    parent.children.push({ kind: 'file', id: entry.id, name: path.slice(slash + 1), path })
  }

  const sortDeep = (folder: TreeFolder) => {
    folder.children.sort(byName)
    for (const child of folder.children) if (child.kind === 'folder') sortDeep(child)
  }
  sortDeep(root)
  return root.children
}
