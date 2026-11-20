/**
 * Connection state machine transitions (vault: Sync and Offline).
 */
import { describe, expect, it } from 'vitest'
import {
  initialConnectionState as initial,
  isLive,
  reduceConnection,
  type ConnectionEvent,
  type ConnectionState,
} from './connection'

const run = (events: ConnectionEvent[], from: ConnectionState = initial) =>
  events.reduce(reduceConnection, from)

const online = run([{ type: 'socket-open' }, { type: 'synced', at: 1 }])

describe('connection reducer', () => {
  it('connecting -> online -> synced', () => {
    expect(run([{ type: 'socket-connecting' }]).status).toBe('connecting')
    expect(run([{ type: 'socket-open' }])).toMatchObject({ status: 'online', synced: false })
    expect(isLive(online)).toBe(true)
  })

  it('drops to offline, then reports reconnecting (not connecting) on retry', () => {
    const offline = run([{ type: 'socket-closed' }], online)
    expect(offline).toMatchObject({ status: 'offline', synced: false })
    expect(run([{ type: 'socket-connecting' }], offline).status).toBe('reconnecting')
  })

  it('counts changes made while offline and reports them as one merge on sync', () => {
    const offline = run(
      [
        { type: 'socket-closed' },
        { type: 'local-change' },
        { type: 'local-change' },
        { type: 'local-change' },
      ],
      online,
    )
    expect(offline.pendingChanges).toBe(3)

    const merged = run([{ type: 'socket-open' }, { type: 'synced', at: 42 }], offline)
    expect(merged.pendingChanges).toBe(0)
    expect(merged.lastMerge).toEqual({ changes: 3, at: 42 })
  })

  it('does not count changes made while live, and returns the same object', () => {
    expect(reduceConnection(online, { type: 'local-change' })).toBe(online)
  })

  it('counts changes made after the socket opened but before the first sync', () => {
    const opening = run([{ type: 'socket-open' }, { type: 'local-change' }])
    expect(opening.pendingChanges).toBe(1)
  })

  it('force-offline pins the status until force-online, ignoring socket events', () => {
    const forced = run([{ type: 'force-offline' }], online)
    expect(run([{ type: 'socket-connecting' }, { type: 'socket-open' }], forced).status).toBe(
      'offline',
    )

    const released = run([{ type: 'force-online' }], forced)
    expect(released).toMatchObject({ status: 'reconnecting', forcedOffline: false })
  })

  it('ignores a synced event that arrives while not online', () => {
    const offline = run([{ type: 'socket-closed' }], online)
    expect(reduceConnection(offline, { type: 'synced', at: 5 })).toBe(offline)
  })

  it('keeps the previous merge report when a sync brings no pending changes', () => {
    const afterMerge = run(
      [
        { type: 'socket-closed' },
        { type: 'local-change' },
        { type: 'socket-open' },
        { type: 'synced', at: 7 },
      ],
      online,
    )
    const again = run(
      [{ type: 'socket-closed' }, { type: 'socket-open' }, { type: 'synced', at: 9 }],
      afterMerge,
    )
    expect(again.lastMerge).toEqual({ changes: 1, at: 7 })
  })
})
