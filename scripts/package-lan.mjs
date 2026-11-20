/* eslint-disable no-console */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { createRequire } from 'node:module'
const out = resolve('dist/Hydras-LAN-v2-Windows')
mkdirSync(out, { recursive: true })
if (existsSync(join(out, 'data')))
  throw Error(
    'Build staging contains user data. Move it to a separate working folder before packaging.',
  )
const copied = new Set()
function copyPackage(name, from) {
  const req = createRequire(join(from, 'package.json'))
  let entry
  try {
    entry = req.resolve(name + '/package.json')
  } catch {
    entry = req.resolve(name)
  }
  let dir = dirname(entry)
  while (
    !existsSync(join(dir, 'package.json')) ||
    JSON.parse(readFileSync(join(dir, 'package.json'))).name !== name
  ) {
    const parent = dirname(dir)
    if (parent === dir) throw Error(name)
    dir = parent
  }
  if (copied.has(name)) return
  copied.add(name)
  cpSync(dir, join(out, 'node_modules', name), {
    recursive: true,
    filter: (p) => !p.includes('node_modules', dir.length + 1),
  })
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json')))
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).filter(
    (dep) => !pkg.peerDependenciesMeta?.[dep]?.optional,
  ))
    copyPackage(dep, dir)
}
copyPackage('@hocuspocus/server', resolve('apps/server'))
copyPackage('@hocuspocus/extension-sqlite', resolve('apps/server'))
const esbuild = createRequire(import.meta.url)(
  resolve(
    'node_modules/.pnpm',
    readdirSync('node_modules/.pnpm').find((n) => n.startsWith('esbuild@')),
    'node_modules/esbuild/lib/main.js',
  ),
)
await esbuild.build({
  entryPoints: ['apps/server/src/index.ts'],
  outfile: join(out, 'sync.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
})
cpSync(process.execPath, join(out, 'node.exe'))
cpSync('apps/web/dist', join(out, 'web'), {
  recursive: true,
  filter: (p) => !p.includes('downloads') && !p.includes('landing'),
})
cpSync('scripts/lan-web.mjs', join(out, 'web.mjs'))
writeFileSync(join(out, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
for (const [file, script] of [
  ['START-HOST.cmd', 'sync.mjs'],
  ['START-APP.cmd', 'web.mjs --open'],
  ['START-HYDRAS.cmd', 'web.mjs --open'],
])
  writeFileSync(join(out, file), `@echo off\r\ncd /d "%~dp0"\r\nnode.exe ${script}\r\npause\r\n`)
cpSync('scripts/LAN-TEST.txt', join(out, 'READ-ME-FIRST.txt'))
console.log(out)
