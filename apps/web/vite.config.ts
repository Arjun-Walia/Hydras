import {
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string
}

/** Tauri sets TAURI_ENV_* while running beforeBuildCommand. */
const isDesktopBuild = Boolean(process.env.TAURI_ENV_PLATFORM)

/**
 * Website-only public folders the desktop bundle must never ship:
 * - downloads/: staged installers (an installer inside the installer)
 * - landing/: the marketing page's video and images (the desktop app shows a start
 *   screen at "/", never the landing page)
 */
const WEB_ONLY_PUBLIC_DIRS = ['downloads', 'landing']

/** The recorded walkthrough lives in docs/; the site serves a copy from /landing. */
function landingDemo(): Plugin {
  const from = fileURLToPath(new URL('../../docs/demo.mp4', import.meta.url))
  const toPublic = fileURLToPath(new URL('./public/landing/demo.mp4', import.meta.url))
  const copy = (dest: string) => {
    if (!existsSync(from)) return
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(from, dest)
  }
  return {
    name: 'hydras:landing-demo',
    buildStart: () => copy(toPublic),
    configureServer: () => copy(toPublic),
    closeBundle: () => copy(fileURLToPath(new URL('./dist/landing/demo.mp4', import.meta.url))),
  }
}

function excludeWebOnlyAssetsFromDesktop(): Plugin {
  return {
    name: 'hydras:exclude-web-only-assets-from-desktop',
    apply: 'build',
    closeBundle() {
      if (!isDesktopBuild) return
      for (const dir of WEB_ONLY_PUBLIC_DIRS) {
        rmSync(fileURLToPath(new URL(`./dist/${dir}`, import.meta.url)), {
          recursive: true,
          force: true,
        })
      }
    },
  }
}

function offlineShell(): Plugin {
  return {
    name: 'hydras:offline-shell',
    apply: 'build',
    closeBundle() {
      const root = fileURLToPath(new URL('./dist/', import.meta.url))
      const assets = readdirSync(root + 'assets').map((name) => '/assets/' + name)
      const cache = 'hydras-shell-' + Date.now()
      writeFileSync(
        root + 'sw.js',
        `const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify(['/index.html', ...assets])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hydras-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/local/')||url.pathname.startsWith('/api/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')))}else if(url.pathname.startsWith('/assets/')){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)))}});`,
      )
    },
  }
}
/**
 * Excalidraw loads its fonts from `${EXCALIDRAW_ASSET_PATH}fonts/...` and otherwise from a
 * CDN. Serve them from this app instead (dev middleware + copied into dist), so the
 * whiteboard works offline, on a LAN and inside the desktop app's CSP.
 */
function excalidrawFonts(): Plugin {
  const require = createRequire(import.meta.url)
  // The package exports only its entry (dist/prod/index.js); fonts sit next to it.
  const fontsDir = join(dirname(require.resolve('@excalidraw/excalidraw')), 'fonts')
  const prefix = '/excalidraw/fonts/'
  return {
    name: 'hydras:excalidraw-fonts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith(prefix)) return next()
        const file = normalize(join(fontsDir, decodeURIComponent(url.slice(prefix.length))))
        if (!file.startsWith(fontsDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
          return next()
        }
        res.setHeader(
          'Content-Type',
          extname(file) === '.woff2' ? 'font/woff2' : 'application/octet-stream',
        )
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      const out = fileURLToPath(new URL('./dist/excalidraw/fonts', import.meta.url))
      cpSync(fontsDir, out, { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    excalidrawFonts(),
    landingDemo(),
    excludeWebOnlyAssetsFromDesktop(),
    offlineShell(),
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5173, strictPort: true },
  // Keep Tauri's CLI output readable and expose TAURI_ENV_* to the app.
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: 'es2022' },
})
