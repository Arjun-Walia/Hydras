#!/usr/bin/env node
/**
 * Copy the desktop installers built by `tauri build` into the website's
 * public/downloads folder and write manifest.json (version, size, SHA-256), which the
 * landing page reads to show real download buttons.
 *
 * Usage: node scripts/stage-installers.mjs
 */
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tauriDir = join(root, 'apps/desktop/src-tauri')
const bundleDir = join(tauriDir, 'target/release/bundle')
const outDir = join(root, 'apps/web/public/downloads')

const { version } = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'))

const KINDS = [
  { kind: 'nsis', dir: 'nsis', ext: '.exe' },
  { kind: 'msi', dir: 'msi', ext: '.msi' },
]

function newestMatching(dir, ext) {
  let files
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(ext) && f.includes(version))
  } catch {
    return null
  }
  return (
    files.map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0]?.f ??
    null
  )
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const assets = []
for (const { kind, dir, ext } of KINDS) {
  const file = newestMatching(join(bundleDir, dir), ext)
  if (!file) {
    console.warn(`No ${kind} installer for v${version} in ${join(bundleDir, dir)}`)
    continue
  }
  const source = join(bundleDir, dir, file)
  const target = file.replace(/\s+/g, '_')
  copyFileSync(source, join(outDir, target))
  assets.push({ kind, file: target, bytes: statSync(source).size, sha256: sha256(source) })
}

if (assets.length === 0) {
  console.error('Nothing to stage. Run `pnpm release:desktop` first.')
  process.exit(1)
}

const manifest = { version, builtAt: new Date().toISOString(), assets }
writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
for (const a of assets) {
  console.warn(`staged ${a.file}  ${(a.bytes / 1024 / 1024).toFixed(1)} MB  sha256 ${a.sha256}`)
}
