/** Where the app is running: the Tauri desktop shell or a normal browser tab. */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Installers are staged into the web app's /downloads folder by
 * `pnpm release:stage`, alongside a manifest the landing page reads.
 */
export const DOWNLOADS_MANIFEST_URL = '/downloads/manifest.json'

export interface DownloadAsset {
  kind: 'nsis' | 'msi'
  file: string
  bytes: number
  sha256: string
}

export interface DownloadsManifest {
  version: string
  builtAt: string
  assets: DownloadAsset[]
}

export function parseDownloadsManifest(value: unknown): DownloadsManifest | null {
  if (typeof value !== 'object' || value === null) return null
  const m = value as Record<string, unknown>
  if (typeof m.version !== 'string' || typeof m.builtAt !== 'string' || !Array.isArray(m.assets)) {
    return null
  }
  const assets = m.assets.filter(
    (a): a is DownloadAsset =>
      typeof a === 'object' &&
      a !== null &&
      ((a as DownloadAsset).kind === 'nsis' || (a as DownloadAsset).kind === 'msi') &&
      typeof (a as DownloadAsset).file === 'string' &&
      /^[\w.-]+$/.test((a as DownloadAsset).file) &&
      typeof (a as DownloadAsset).bytes === 'number' &&
      typeof (a as DownloadAsset).sha256 === 'string',
  )
  return { version: m.version, builtAt: m.builtAt, assets }
}
