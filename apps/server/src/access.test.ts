import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AccessStore, cleanName, createPostRateLimit } from './access'

describe('room access', () => {
  it('requires password, approval and host authority, and persists roles', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydras-access-'))
    try {
      const path = join(dir, 'access.json')
      const store = new AccessStore(path)
      const host = store.create('password-123', 'Host')
      expect(() => store.join(host.room, 'incorrect', 'Intruder')).toThrow()
      const guest = store.join(host.room, 'password-123', 'Friend')
      expect(store.role(host.room, guest.token)).toBe('pending')
      expect(() => store.list(host.room, guest.token)).toThrow()
      const member = store.list(host.room, host.token).find((m) => m.name === 'Friend')!
      expect(() => store.approve(host.room, guest.token, member.id, 'editor')).toThrow()
      store.approve(host.room, host.token, member.id, 'viewer')
      expect(new AccessStore(path).role(host.room, guest.token)).toBe('viewer')
      store.approve(host.room, host.token, member.id, 'rejected')
      expect(store.role(host.room, guest.token)).toBe('rejected')
      expect(store.role(host.room, 'forged')).toBe('rejected')
      const hostId = store.list(host.room, host.token).find((m) => m.role === 'host')!.id
      expect(() => store.approve(host.room, host.token, hostId, 'viewer')).toThrow(/Cannot change/)
      expect(() => store.approve(host.room, host.token, member.id, 'owner')).toThrow(/Invalid role/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects a short password, a path-like room, and a room that was never created', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydras-access-'))
    try {
      const store = new AccessStore(join(dir, 'access.json'))
      expect(() => store.create('short', 'Host')).toThrow(/8/)
      expect(() => store.join('../etc', 'password-123', 'A')).toThrow(/Invalid room/)
      expect(store.role('missing-room', 'token')).toBe('open')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not throw when the stored password hash has the wrong length', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydras-access-'))
    try {
      const path = join(dir, 'access.json')
      writeFileSync(
        path,
        JSON.stringify({ 'team-room': { salt: 'abcd', password: 'aa', members: [] } }),
      )
      const store = new AccessStore(path)
      expect(() => store.join('team-room', 'password-123', 'A')).toThrow(/Incorrect room password/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('frees rejected members when the room is full, and still caps active ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydras-access-'))
    try {
      const path = join(dir, 'access.json')
      const store = new AccessStore(path)
      const host = store.create('password-123', 'Host')
      const fill = (role: string) => {
        const data = JSON.parse(readFileSync(path, 'utf8')) as {
          [room: string]: { members: { id: string; name: string; role: string; key: string }[] }
        }
        const members = data[host.room]!.members
        while (members.length < 100) {
          members.push({ id: `pad-${members.length}`, name: 'Pad', role, key: 'dead' })
        }
        writeFileSync(path, JSON.stringify(data))
      }
      fill('rejected')
      const reloaded = new AccessStore(path)
      expect(reloaded.join(host.room, 'password-123', 'New').role).toBe('pending')
      fill('pending')
      expect(() => new AccessStore(path).join(host.room, 'password-123', 'Another')).toThrow(
        /limit reached/,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('refuses a corrupt access file instead of starting with no passwords', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hydras-access-'))
    try {
      const path = join(dir, 'access.json')
      writeFileSync(path, '{')
      expect(() => new AccessStore(path)).toThrow(/access file/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('strips control characters from display names', () => {
    expect(cleanName('Ada\u0000\n', 'Guest')).toBe('Ada')
    expect(cleanName('   ', 'Guest')).toBe('Guest')
  })
})

describe('post rate limit', () => {
  it('allows a burst and then resets after the window', () => {
    const allow = createPostRateLimit(2, 1_000)
    allow('10.0.0.1', 0)
    allow('10.0.0.1', 10)
    expect(() => allow('10.0.0.1', 20)).toThrow(/Too many requests/)
    allow('10.0.0.1', 1_001)
    allow('10.0.0.2', 20)
  })
})
