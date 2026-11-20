/**
 * Client-side routes without a router library:
 *   /          landing page (web) or start screen (desktop)
 *   /r/<slug>  a room
 * Navigation uses history.pushState so it works the same in the browser and in the
 * desktop shell, which has no server to fall back to index.html.
 */
import { isDesktopApp } from './platform'
import { useSyncExternalStore } from 'react'
import { ROOM_SLUG_PATTERN, randomDisplayName } from '@hydras/shared'

const ROOM_PATH = /^\/r\/([^/]+)\/?$/
const NAVIGATE_EVENT = 'hydras:navigate'

export function slugFromPath(pathname: string): string | null {
  const encoded = ROOM_PATH.exec(pathname)?.[1]
  if (!encoded) return null
  let slug: string
  try {
    slug = decodeURIComponent(encoded).toLowerCase()
  } catch {
    return null // malformed percent-encoding
  }
  return ROOM_SLUG_PATTERN.test(slug) ? slug : null
}

export function randomRoomSlug(random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 0x10000)
    .toString(16)
    .padStart(4, '0')
  return `${randomDisplayName(random)}-${suffix}`
}

/** Accepts a full invite link, a /r/<slug> path or a bare slug. */
export function slugFromInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    return slugFromPath(new URL(trimmed).pathname)
  } catch {
    return slugFromPath(trimmed.startsWith('/') ? trimmed : `/r/${trimmed}`)
  }
}

export function roomUrl(slug: string): string {
  const origin =
    !isDesktopApp() && window.location.origin.startsWith('http')
      ? window.location.origin
      : 'http://localhost:5173'
  return `${origin}/r/${slug}`
}

export function navigate(path: string): void {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('popstate', listener)
  window.addEventListener(NAVIGATE_EVENT, listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(NAVIGATE_EVENT, listener)
  }
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname)
}
