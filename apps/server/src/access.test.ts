import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AccessStore } from './access'
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
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
