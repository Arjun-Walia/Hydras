/* eslint-disable no-console */
import { createRequire } from 'node:module'
const req = createRequire(new URL('../packages/sync/package.json', import.meta.url))
const { HocuspocusProvider } = req('@hocuspocus/provider')
const Y = req('yjs')
const WebSocket = globalThis.WebSocket
const docs = [new Y.Doc(), new Y.Doc()]
const ps = docs.map(
  (document) =>
    new HocuspocusProvider({
      url: 'ws://localhost:1234',
      name: 'package-smoke',
      document,
      WebSocketPolyfill: WebSocket,
    }),
)
async function until(f) {
  for (let i = 0; i < 100; i++) {
    if (f()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw Error('Timed out')
}
try {
  await until(() => ps.every((p) => p.synced))
  docs[0].getText('test').insert(0, 'host')
  await until(() => docs[1].getText('test').toString() === 'host')
  ps[1].disconnect()
  await new Promise((r) => setTimeout(r, 200))
  docs[1].getText('test').insert(4, ' offline')
  docs[0].getText('test').insert(0, 'live ')
  ps[1].connect()
  await until(() => docs[0].getText('test').toString() === docs[1].getText('test').toString())
  if (!docs[0].getText('test').toString().includes('offline')) throw Error('Missing edit')
  console.log('PASS: two WebSocket clients synchronized and merged disconnected edits')
} finally {
  ps.forEach((p) => p.destroy())
  docs.forEach((d) => d.destroy())
}
process.exit(0)
