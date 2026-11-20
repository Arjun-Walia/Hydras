/**
 * Connection state machine as a pure reducer.
 *
 *   connecting -> online -> offline -> reconnecting -> online
 *
 * `synced` is an overlay: true once the state-vector exchange on the current socket has
 * completed. Local changes made while not (online && synced) are counted as pending; when
 * the next sync completes they are reported as one merge, then the counter resets.
 *
 * Invariants:
 * - forcedOffline (chaos toggle) pins status to 'offline' until force-online.
 * - pendingChanges only grows while disconnected or unsynced, and resets exactly on sync.
 * - The reducer never mutates its input; events that change nothing return the same object.
 */

export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'reconnecting'

export interface MergeReport {
  changes: number
  at: number
}

export interface ConnectionState {
  status: ConnectionStatus
  synced: boolean
  forcedOffline: boolean
  hasEverConnected: boolean
  pendingChanges: number
  lastMerge: MergeReport | null
}

export type ConnectionEvent =
  | { type: 'socket-connecting' }
  | { type: 'socket-open' }
  | { type: 'socket-closed' }
  | { type: 'synced'; at: number }
  | { type: 'local-change' }
  | { type: 'force-offline' }
  | { type: 'force-online' }

export const initialConnectionState: ConnectionState = {
  status: 'connecting',
  synced: false,
  forcedOffline: false,
  hasEverConnected: false,
  pendingChanges: 0,
  lastMerge: null,
}

export function isLive(state: ConnectionState): boolean {
  return state.status === 'online' && state.synced
}

export function reduceConnection(state: ConnectionState, event: ConnectionEvent): ConnectionState {
  switch (event.type) {
    case 'socket-connecting':
      if (state.forcedOffline) return state
      return { ...state, status: state.hasEverConnected ? 'reconnecting' : 'connecting' }

    case 'socket-open':
      if (state.forcedOffline) return state
      return { ...state, status: 'online', synced: false, hasEverConnected: true }

    case 'socket-closed':
      if (state.status === 'offline' && !state.synced) return state
      return { ...state, status: 'offline', synced: false }

    case 'synced': {
      if (state.status !== 'online' || state.synced) return state
      const lastMerge =
        state.pendingChanges > 0 ? { changes: state.pendingChanges, at: event.at } : state.lastMerge
      return { ...state, synced: true, pendingChanges: 0, lastMerge }
    }

    case 'local-change':
      if (isLive(state)) return state
      return { ...state, pendingChanges: state.pendingChanges + 1 }

    case 'force-offline':
      return { ...state, forcedOffline: true, status: 'offline', synced: false }

    case 'force-online':
      if (!state.forcedOffline) return state
      return { ...state, forcedOffline: false, status: 'reconnecting' }
  }
}
