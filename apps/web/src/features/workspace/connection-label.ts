/**
 * Pure mapping from connection state to what the status bar says and how it looks.
 * Offline is normal here, not an error: it reads amber and tells you what will sync.
 */
import type { ConnectionState } from '@hydras/sync'
import type { StatusTone } from '@hydras/ui'

export interface ConnectionLabel {
  text: string
  tone: StatusTone
  pulse: boolean
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function describeConnection(state: ConnectionState): ConnectionLabel {
  const pending = state.pendingChanges
  switch (state.status) {
    case 'online':
      return state.synced
        ? { text: 'Online', tone: 'ok', pulse: false }
        : { text: 'Syncing…', tone: 'busy', pulse: true }
    case 'connecting':
      return { text: 'Connecting…', tone: 'busy', pulse: true }
    case 'reconnecting':
      return {
        text:
          pending > 0 ? `Reconnecting · ${plural(pending, 'change')} will sync` : 'Reconnecting…',
        tone: 'warn',
        pulse: true,
      }
    case 'offline':
      return {
        text: pending > 0 ? `Offline · ${plural(pending, 'change')} will sync` : 'Offline',
        tone: 'warn',
        pulse: false,
      }
  }
}
