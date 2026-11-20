/* eslint-disable no-console */
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'
const req = createRequire(new URL('../packages/sync/package.json', import.meta.url))
const { HocuspocusProvider } = req('@hocuspocus/provider')
const Y = req('yjs')
const dir = mkdtempSync(join(tmpdir(), 'hydras-integration-'))
const port = 18341
const base = `http://127.0.0.1:${port}`
let child
const providers = []
const docs = []
async function until(fn, label) {
  for (let i = 0; i < 160; i++) {
    if (await fn()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw Error(`Timeout: ${label}`)
}
async function start() {
  child = spawn(process.execPath, ['sync.mjs'], {
    cwd: resolve('dist/Hydras-LAN-v2-Windows'),
    env: { ...process.env, PORT: String(port), SQLITE_PATH: join(dir, 'test.sqlite') },
    stdio: 'ignore',
  })
  await until(async () => {
    try {
      return (await fetch(`${base}/api/health`)).ok
    } catch {
      return false
    }
  }, 'server startup')
}
async function api(path, room, body, token = '') {
  const r = await fetch(`${base}/api/${path}?room=${room ?? ''}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await r.json()
  if (!r.ok) throw Error(data.error)
  return data
}
function client(room, token, doc = new Y.Doc()) {
  docs.push(doc)
  const p = new HocuspocusProvider({
    url: `ws://127.0.0.1:${port}`,
    name: room,
    token,
    document: doc,
    WebSocketPolyfill: globalThis.WebSocket,
  })
  providers.push(p)
  return { p, doc, text: doc.getText('code') }
}
try {
  await start()
  const host = await api('create', '', { password: 'integration-password', name: 'Host' })
  const clients = [client(host.room, host.token)]
  const guests = []
  for (let i = 1; i < 4; i++) {
    const guest = await api('join', host.room, {
      password: 'integration-password',
      name: `Editor ${i}`,
    })
    const list = await api('members', host.room, undefined, host.token)
    const member = list.find((m) => m.name === `Editor ${i}`)
    await api('approve', host.room, { id: member.id, role: 'editor' }, host.token)
    guests.push({ ...guest, id: member.id })
    clients.push(client(host.room, guest.token))
  }
  await until(() => clients.every((c) => c.p.synced), 'four peers sync')
  clients.forEach((c, i) =>
    c.p.awareness.setLocalStateField('user', { name: `Peer ${i}`, color: '#4488ff' }),
  )
  await until(
    () => clients.every((c) => c.p.awareness.getStates().size === 4),
    'four peer presence',
  )
  const origin = Symbol('local')
  const undo = new Y.UndoManager(clients[0].text, {
    trackedOrigins: new Set([origin]),
    captureTimeout: 0,
  })
  clients.forEach((c, i) => c.doc.transact(() => c.text.insert(0, `[peer-${i}]`), origin))
  await until(
    () => clients.every((c) => c.text.toString() === clients[0].text.toString()),
    'concurrent convergence',
  )
  undo.undo()
  await until(() => clients.every((c) => !c.text.toString().includes('[peer-0]')), 'own undo')
  for (let i = 1; i < 4; i++) assert(clients[0].text.toString().includes(`[peer-${i}]`))
  undo.redo()
  clients[2].p.disconnect()
  clients[3].p.disconnect()
  await new Promise((r) => setTimeout(r, 200))
  clients.forEach((c, i) => c.text.insert(0, `[partition-${i}]`))
  await new Promise((r) => setTimeout(r, Number(process.env.HYDRAS_PARTITION_MS ?? 1500)))
  clients[2].p.connect()
  clients[3].p.connect()
  await until(
    () => clients.every((c) => c.text.toString() === clients[0].text.toString()),
    'partition merge',
  )
  for (let i = 0; i < 4; i++) assert(clients[0].text.toString().includes(`[partition-${i}]`))
  clients[1].text.insert(0, 'x'.repeat(250000))
  await until(() => clients.every((c) => c.text.length === clients[0].text.length), 'large text')
  await api('approve', host.room, { id: guests[2].id, role: 'viewer' }, host.token)
  clients[3].text.insert(0, 'FORGED-VIEWER-WRITE')
  await new Promise((r) => setTimeout(r, 400))
  assert(!clients[0].text.toString().includes('FORGED'))
  await api('approve', host.room, { id: guests[2].id, role: 'rejected' }, host.token)
  await new Promise((r) => setTimeout(r, 2500))
  const expected = clients[0].text.toString()
  for (const c of clients) c.p.disconnect()
  child.kill()
  await new Promise((r) => child.once('exit', r))
  await start()
  const fresh = client(host.room, host.token)
  await until(() => fresh.p.synced, 'restart sync')
  assert.equal(fresh.text.toString(), expected)
  console.log(
    'PASS: four peers, live presence, concurrent edits, own undo/redo, partition merge, 250 KB document, malicious viewer rejection, revocation, SQLite and access persistence across host restart.',
  )
} finally {
  providers.forEach((p) => p.destroy())
  docs.forEach((d) => d.destroy())
  if (child && !child.killed) {
    child.kill()
    await new Promise((r) => child.once('exit', r))
  }
  rmSync(dir, { recursive: true, force: true })
}
process.exit(0)
