/* eslint-disable no-console */
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { networkInterfaces } from 'node:os'
import { spawn } from 'node:child_process'
const root = resolve('web')
const webPort = Number(process.env.LAN_WEB_PORT ?? 5173)
const syncPort = Number(process.env.PORT ?? 1234)
let child
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}
const addresses = () =>
  Object.entries(networkInterfaces())
    .sort(
      ([a], [b]) => Number(/wi-fi|wlan|wireless/i.test(b)) - Number(/wi-fi|wlan|wireless/i.test(a)),
    )
    .filter(([name]) => !/WSL|vEthernet|VirtualBox|VMware|Loopback/i.test(name))
    .flatMap(([name, list]) =>
      (list ?? [])
        .filter((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
        .map((a) => ({ name, address: a.address })),
    )
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/local/host') {
      const origin = req.headers.origin
      if (
        origin &&
        ![
          `http://localhost:${webPort}`,
          `http://127.0.0.1:${webPort}`,
          'http://tauri.localhost',
          'https://tauri.localhost',
          'tauri://localhost',
        ].includes(origin)
      ) {
        res.writeHead(403).end()
        return
      }
      res.setHeader('Access-Control-Allow-Origin', origin ?? `http://localhost:${webPort}`)
      res.setHeader('Access-Control-Allow-Headers', 'X-Hydras-Local')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      if (req.method === 'OPTIONS') {
        res.writeHead(204).end()
        return
      }
      if (req.method !== 'POST' || req.headers['x-hydras-local'] !== '1') {
        res.writeHead(403).end()
        return
      }
      let live = false
      try {
        const reply = await fetch(`http://127.0.0.1:${syncPort}/api/health`, {
          signal: AbortSignal.timeout(700),
        })
        live = (await reply.json()).service === 'hydras-sync'
      } catch {
        /* start below */
      }
      if (!live && !child) {
        child = spawn(process.execPath, ['sync.mjs'], {
          cwd: process.cwd(),
          stdio: 'inherit',
          windowsHide: true,
          env: { ...process.env, HYDRAS_LAUNCHER_PID: String(process.pid) },
        })
        child.on('exit', () => {
          child = undefined
        })
        child.on('error', console.error)
      }
      for (let i = 0; i < 30 && !live; i++) {
        await new Promise((r) => setTimeout(r, 100))
        try {
          const reply = await fetch(`http://127.0.0.1:${syncPort}/api/health`, {
            signal: AbortSignal.timeout(300),
          })
          live = (await reply.json()).service === 'hydras-sync'
        } catch {
          /* retry */
        }
      }
      if (!live) {
        res
          .writeHead(503, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: 'Sync server failed to start. Port 1234 may be occupied.' }))
        return
      }
      const interfaces = addresses()
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          server: `ws://${interfaces[0]?.address ?? '127.0.0.1'}:${syncPort}`,
          interfaces,
        }),
      )
      return
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname))
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end()
      return
    }
    let data,
      type = types[extname(path)]
    try {
      data = await readFile(path)
    } catch {
      if (extname(path)) {
        res.writeHead(404).end()
        return
      }
      data = await readFile(resolve(root, 'index.html'))
      type = 'text/html'
    }
    res
      .writeHead(200, {
        'Content-Type': type ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(data)
  } catch (error) {
    console.error(error)
    res.writeHead(500).end('Local launcher error')
  }
}).listen(webPort, '127.0.0.1', () => {
  const url = `http://localhost:${webPort}`
  if (existsSync(resolve(process.env.SQLITE_PATH ?? 'data/hydras.sqlite'))) {
    void fetch(`${url}/local/host`, { method: 'POST', headers: { 'X-Hydras-Local': '1' } }).catch(
      console.error,
    )
  }
  console.log(`Hydras ready: ${url} — choose Host or paste an invite. Keep this window open.`)
  if (process.argv.includes('--open') && process.platform === 'win32')
    spawn('explorer.exe', [url], { windowsHide: true })
})
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    child?.kill()
    process.exit(0)
  })
