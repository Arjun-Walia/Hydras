/**
 * Read /downloads/manifest.json (written by `pnpm release:stage`) so the download
 * buttons show the real installer, size and checksum, or nothing if none is staged.
 */
import { useEffect, useState } from 'react'
import {
  DOWNLOADS_MANIFEST_URL,
  parseDownloadsManifest,
  type DownloadsManifest,
} from '../../app/platform'

export type ManifestState =
  { status: 'loading' } | { status: 'missing' } | { status: 'ready'; manifest: DownloadsManifest }

export function useDownloadsManifest(): ManifestState {
  const [state, setState] = useState<ManifestState>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    fetch(DOWNLOADS_MANIFEST_URL, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        const manifest = parseDownloadsManifest(json)
        setState(
          manifest && manifest.assets.length > 0
            ? { status: 'ready', manifest }
            : { status: 'missing' },
        )
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setState({ status: 'missing' })
      })
    return () => controller.abort()
  }, [])
  return state
}

export function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
