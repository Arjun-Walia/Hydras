import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
export type Role = 'host' | 'editor' | 'viewer' | 'pending' | 'rejected'
type Member = { id: string; name: string; role: Role; key: string }
type Policy = { salt: string; password: string; members: Member[] }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export class AccessStore {
  private rooms: Record<string, Policy>
  constructor(private path: string) {
    this.rooms = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
  }
  private save() {
    writeFileSync(this.path + '.tmp', JSON.stringify(this.rooms), { mode: 0o600 })
    renameSync(this.path + '.tmp', this.path)
  }
  private member(name: string, role: Role) {
    const token = randomBytes(32).toString('hex')
    return {
      token,
      member: {
        id: randomBytes(12).toString('hex'),
        name: name.slice(0, 80),
        role,
        key: hash(token),
      },
    }
  }
  create(password: string, name: string) {
    if (password.length < 8 || password.length > 128)
      throw Error('Use a password of 8–128 characters')
    const room = 'team-' + randomBytes(12).toString('hex')
    const salt = randomBytes(16).toString('hex')
    const result = this.member(name || 'Host', 'host')
    this.rooms[room] = {
      salt,
      password: scryptSync(password, salt, 32).toString('hex'),
      members: [result.member],
    }
    this.save()
    return { room, token: result.token, role: 'host' }
  }
  join(room: string, password: string, name: string) {
    const policy = this.rooms[room]
    if (!policy) throw Error('Protected room not found')
    if (
      password.length > 128 ||
      !timingSafeEqual(scryptSync(password, policy.salt, 32), Buffer.from(policy.password, 'hex'))
    )
      throw Error('Incorrect room password')
    if (policy.members.length >= 100) throw Error('Room request limit reached')
    const result = this.member(name || 'Guest', 'pending')
    policy.members.push(result.member)
    this.save()
    return { token: result.token, role: 'pending' }
  }
  role(room: string, token: string): Role | 'open' {
    const policy = this.rooms[room]
    if (!policy) return 'open'
    return policy.members.find((m) => m.key === hash(token))?.role ?? 'rejected'
  }
  list(room: string, token: string) {
    if (this.role(room, token) !== 'host') throw Error('Host access required')
    return this.rooms[room]!.members.map(({ id, name, role }) => ({ id, name, role }))
  }
  approve(room: string, token: string, id: string, role: string) {
    this.list(room, token)
    if (!['editor', 'viewer', 'rejected'].includes(role)) throw Error('Invalid role')
    const member = this.rooms[room]!.members.find((m) => m.id === id)
    if (!member || member.role === 'host') throw Error('Cannot change this member')
    member.role = role as Role
    this.save()
  }
}
export function accessApi(store: AccessStore) {
  const attempts = new Map<string, { count: number; at: number }>()
  return async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return false
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Content-Type', 'application/json')
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end()
      return true
    }
    try {
      if (url.pathname === '/api/health') {
        response.end(JSON.stringify({ ok: true, service: 'hydras-sync' }))
        return true
      }
      const room = url.searchParams.get('room') ?? ''
      const token = (request.headers.authorization ?? '').replace(/^Bearer /, '')
      if (request.method === 'GET') {
        const result =
          url.pathname === '/api/members'
            ? store.list(room, token)
            : { role: store.role(room, token) }
        response.end(JSON.stringify(result))
        return true
      }
      if (request.method !== 'POST') throw Error('Unsupported method')
      const ip = request.socket.remoteAddress ?? 'unknown'
      const now = Date.now()
      for (const [key, value] of attempts) if (now - value.at > 60000) attempts.delete(key)
      const attempt = attempts.get(ip) ?? { count: 0, at: now }
      attempts.set(ip, attempt)
      if (++attempt.count > 30) throw Error('Too many requests; wait one minute')
      let raw = ''
      for await (const chunk of request) {
        raw += chunk
        if (raw.length > 4096) throw Error('Request too large')
      }
      const body = JSON.parse(raw || '{}') as Record<string, string>
      let result: unknown
      if (url.pathname === '/api/create')
        result = store.create(String(body.password ?? ''), String(body.name ?? ''))
      else if (url.pathname === '/api/join')
        result = store.join(room, String(body.password ?? ''), String(body.name ?? ''))
      else if (url.pathname === '/api/approve') {
        store.approve(room, token, String(body.id), String(body.role))
        result = { ok: true }
      } else throw Error('Unknown endpoint')
      response.end(JSON.stringify(result))
    } catch (error) {
      response
        .writeHead(400)
        .end(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed' }))
    }
    return true
  }
}
