/**
 * Where the website's "Download for Windows" button points.
 *
 * 1. A staged `/downloads/manifest.json` (self-hosting with `pnpm release:stage`) wins.
 * 2. Otherwise the latest published GitHub release of this repo: the button links straight
 *    to its `*_x64-setup.exe` asset (size and version shown).
 * 3. If neither can be read (offline, API rate limit), the button still works: it opens
 *    the latest release page, which always lists the current installer.
 *
 * Pure parsers (tested) + one fetch helper. Only https download URLs on github.com for
 * this repo, or same-origin /downloads/ paths, are ever used as links.
 */
import { DOWNLOADS_MANIFEST_URL, parseDownloadsManifest } from './platform'

export const GITHUB_REPO = 'Arjun-Walia/Hydras'
export const LATEST_RELEASE_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
const DOWNLOAD_PREFIX = `https://github.com/${GITHUB_REPO}/releases/download/`

export interface WindowsInstaller {
  url: string
  fileName: string
  bytes: number | null
  version: string | null
  /** SHA-256 hex, when the source publishes one. */
  sha256: string | null
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** The Windows setup .exe from a GitHub "latest release" API response, or null. */
export function installerFromGithubRelease(release: unknown): WindowsInstaller | null {
  if (!isRecord(release) || release.draft === true || !Array.isArray(release.assets)) return null
  for (const asset of release.assets) {
    if (!isRecord(asset)) continue
    const name = asset.name
    const url = asset.browser_download_url
    if (typeof name !== 'string' || !/_x64-setup\.exe$/i.test(name)) continue
    if (typeof url !== 'string' || !url.startsWith(DOWNLOAD_PREFIX)) continue
    const digest = typeof asset.digest === 'string' ? asset.digest : ''
    return {
      url,
      fileName: name,
      bytes: typeof asset.size === 'number' ? asset.size : null,
      version: typeof release.tag_name === 'string' ? release.tag_name.replace(/^v/, '') : null,
      sha256: /^sha256:[0-9a-f]{64}$/i.test(digest) ? digest.slice(7).toLowerCase() : null,
    }
  }
  return null
}

/** The setup .exe from a staged /downloads manifest, or null. */
export function installerFromManifest(manifest: unknown): WindowsInstaller | null {
  const parsed = parseDownloadsManifest(manifest)
  const asset = parsed?.assets.find((a) => a.kind === 'nsis')
  if (!parsed || !asset) return null
  return {
    url: `/downloads/${asset.file}`,
    fileName: asset.file,
    bytes: asset.bytes,
    version: parsed.version,
    sha256: asset.sha256,
  }
}

async function getJson(url: string, signal: AbortSignal, accept: string): Promise<unknown> {
  const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: accept } })
  if (!response.ok) return null
  const type = response.headers.get('content-type') ?? ''
  return type.includes('json') ? response.json() : null
}

/** Resolve the installer to offer; null means "link to the latest release page". */
export async function findWindowsInstaller(signal: AbortSignal): Promise<WindowsInstaller | null> {
  try {
    const local = installerFromManifest(
      await getJson(DOWNLOADS_MANIFEST_URL, signal, 'application/json'),
    )
    if (local) return local
  } catch (error) {
    if (signal.aborted) throw error
  }
  try {
    return installerFromGithubRelease(
      await getJson(LATEST_RELEASE_API, signal, 'application/vnd.github+json'),
    )
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }
}
