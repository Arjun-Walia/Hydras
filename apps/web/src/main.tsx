/**
 * Entry point: fonts, global styles, saved theme before first paint, then the app.
 */
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { applyDocumentSettings, useSettingsStore } from './app/settings-store'

applyDocumentSettings(useSettingsStore.getState())
useSettingsStore.subscribe((settings) => applyDocumentSettings(settings))

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  ['localhost', '127.0.0.1'].includes(location.hostname)
) {
  void navigator.serviceWorker.register('/sw.js').catch(() => {})
}
