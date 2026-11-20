import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

describe('loadConfig', () => {
  it('uses defaults when nothing is set', () => {
    expect(loadConfig({})).toMatchObject({ port: 1234, sqlitePath: './data/hydras.sqlite' })
  })

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/)
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/)
  })

  it('accepts valid room names and rejects path-like ones', () => {
    const { roomPattern } = loadConfig({})
    expect(roomPattern.test('team-room-1')).toBe(true)
    expect(roomPattern.test('../etc')).toBe(false)
    expect(roomPattern.test('A')).toBe(false)
  })
})
