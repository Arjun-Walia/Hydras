/**
 * The Windows installer the landing page offers (see app/installer-source): a staged
 * /downloads build, else the latest GitHub release, else a link to the releases page.
 */
import { useEffect, useState } from 'react'
import { findWindowsInstaller, type WindowsInstaller } from '../../app/installer-source'

export type InstallerState =
  | { status: 'loading' }
  /** No direct asset found: link to the latest release page instead. */
  | { status: 'fallback' }
  | { status: 'ready'; installer: WindowsInstaller }

export function useWindowsInstaller(): InstallerState {
  const [state, setState] = useState<InstallerState>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    findWindowsInstaller(controller.signal)
      .then((installer) =>
        setState(installer ? { status: 'ready', installer } : { status: 'fallback' }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'fallback' })
      })
    return () => controller.abort()
  }, [])
  return state
}

export function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
