import { describe, expect, it } from 'vitest'
import { randomRoomSlug, slugFromInput, slugFromPath } from './route'

describe('room routes', () => {
  it('reads a valid slug and lower-cases it', () => {
    expect(slugFromPath('/r/Team-Alpha')).toBe('team-alpha')
    expect(slugFromPath('/r/team-alpha/')).toBe('team-alpha')
  })

  it('rejects missing or invalid slugs', () => {
    expect(slugFromPath('/')).toBeNull()
    expect(slugFromPath('/r/')).toBeNull()
    expect(slugFromPath('/r/a')).toBeNull()
    expect(slugFromPath('/r/..%2Fetc')).toBeNull()
  })

  it('generates slugs that pass its own validation', () => {
    for (let i = 0; i < 50; i++) expect(slugFromPath(`/r/${randomRoomSlug()}`)).not.toBeNull()
  })

  it('does not throw on malformed percent-encoding', () => {
    expect(slugFromPath('/r/%E0%A4%A')).toBeNull()
  })
})

describe('joining from user input', () => {
  it('accepts invite links, paths and bare slugs', () => {
    expect(slugFromInput('https://hydras.software/r/team-alpha')).toBe('team-alpha')
    expect(slugFromInput('/r/team-alpha')).toBe('team-alpha')
    expect(slugFromInput('  Team-Alpha ')).toBe('team-alpha')
  })

  it('rejects empty and invalid input', () => {
    expect(slugFromInput('')).toBeNull()
    expect(slugFromInput('https://hydras.software/')).toBeNull()
    expect(slugFromInput('a b c')).toBeNull()
  })
})
