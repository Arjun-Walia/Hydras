import { readFileSync, rmSync } from 'node:fs'
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

export default defineConfig({
  plugins: [react(), tailwindcss(), excludeWebOnlyAssetsFromDesktop()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5173, strictPort: true },
  // Keep Tauri's CLI output readable and expose TAURI_ENV_* to the app.
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: 'es2022' },
})
