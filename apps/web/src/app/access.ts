import { DEFAULT_SYNC_URL } from '@hydras/shared'
import { normalizeSyncUrl } from './settings'
import { useSettingsStore } from './settings-store'
export function syncAddress() {
  return useSettingsStore.getState().syncUrl ?? import.meta.env.VITE_SYNC_URL ?? DEFAULT_SYNC_URL
}
export function sessionKey(room: string, server = syncAddress()) {
  return `hydras:access:${server}:${room}`
}
export function session(room: string) {
  try {
    return JSON.parse(localStorage.getItem(sessionKey(room)) ?? 'null') as {
      token: string
      role: string
    } | null
  } catch {
    return null
  }
}
export function saveSession(room: string, value: { token: string; role: string }) {
  localStorage.setItem(sessionKey(room), JSON.stringify(value))
}
export async function roomApi(path: string, room = '', body?: unknown) {
  const base = new URL(syncAddress())
  base.protocol = base.protocol === 'wss:' ? 'https:' : 'http:'
  base.pathname = `/api/${path}`
  base.search = new URLSearchParams({ room }).toString()
  const response = await fetch(base, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session(room)?.token ?? ''}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  })
  const data = await response.json()
  if (!response.ok) throw Error(data.error ?? 'Server request failed')
  return data
}
export function applyInvite(input: string) {
  const url = new URL(input, window.location.origin)
  const server = new URLSearchParams(url.hash.slice(1)).get('server')
  if (server) {
    const normalized = normalizeSyncUrl(server)
    if (!normalized) throw Error('Invalid sync server in invite')
    useSettingsStore.getState().setSyncUrl(normalized)
  }
  return url.pathname
}
