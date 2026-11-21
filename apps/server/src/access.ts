/**
 * Protected-room access: password, membership, and roles.
 *
 * The room document stays a Yjs blob. This store only answers "who may connect,
 * and may they write?" Tokens are random and stored as SHA-256 hashes. The
 * password is scrypt-hashed. `access.json` is written atomically next to the
 * SQLite file; back the two up together.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'

export type Role = 'host' | 'editor' | 'viewer' | 'pending' | 'rejected'

type Member = { id: string; name: string; role: Role; key: string }
type Policy = { salt: string; password: string; members: Member[] }

const ROOM_SLUG = /^[a-z0-9][a-z0-9-]{1,47}$/
const MAX_MEMBERS = 100
const KEY_BYTES = 32

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

/** Display names are plain text: no control characters, capped so a join cannot bloat the file. */
export function cleanName(name: string, fallback: string): string {
  let cleaned = ''
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0
    if (code >= 32 && code !== 127) cleaned += char
  }
  cleaned = cleaned.trim().slice(0, 80)
  return cleaned || fallback
}

function passwordMatches(password: string, policy: Policy): boolean {
  if (password.length < 8 || password.length > 128) return false
  const actual = scryptSync(password, policy.salt, KEY_BYTES)
  const expected = Buffer.from(policy.password, 'hex')
  if (expected.length !== actual.length) return false
  return timingSafeEqual(actual, expected)
}

function loadRooms(path: string): Record<string, Policy> {
  if (!existsSync(path)) return {}
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected an object of rooms')
    }
    return parsed as Record<string, Policy>
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid JSON'
    throw new Error(`Could not read access file ${path}: ${detail}`, { cause: error })
  }
}

export class AccessStore {
  private rooms: Record<string, Policy>

  constructor(private path: string) {
    this.rooms = loadRooms(path)
  }

  private save() {
    const temporary = this.path + '.tmp'
    writeFileSync(temporary, JSON.stringify(this.rooms), { mode: 0o600 })
    renameSync(temporary, this.path)
  }

  private member(name: string, role: Role) {
    const token = randomBytes(32).toString('hex')
    return {
      token,
      member: {
        id: randomBytes(12).toString('hex'),
        name,
        role,
        key: hash(token),
      } satisfies Member,
    }
  }

  private policy(room: string): Policy {
    if (!ROOM_SLUG.test(room)) throw new Error('Invalid room name')
    const policy = this.rooms[room]
    if (!policy) throw new Error('Protected room not found')
    return policy
  }

  create(password: string, name: string) {
    if (password.length < 8 || password.length > 128) {
      throw new Error('Use a password of 8–128 characters')
    }
    const room = 'team-' + randomBytes(12).toString('hex')
    const salt = randomBytes(16).toString('hex')
    const result = this.member(cleanName(name, 'Host'), 'host')
    this.rooms[room] = {
      salt,
      password: scryptSync(password, salt, KEY_BYTES).toString('hex'),
      members: [result.member],
    }
    this.save()
    return { room, token: result.token, role: 'host' as const }
  }

  join(room: string, password: string, name: string) {
    const policy = this.policy(room)
    if (!passwordMatches(password, policy)) throw new Error('Incorrect room password')
    // Rejected members no longer have a token that works (an unknown token is
    // already rejected), so they must not permanently fill the room.
    if (policy.members.length >= MAX_MEMBERS) {
      policy.members = policy.members.filter((member) => member.role !== 'rejected')
    }
    if (policy.members.length >= MAX_MEMBERS) throw new Error('Room request limit reached')
    const result = this.member(cleanName(name, 'Guest'), 'pending')
    policy.members.push(result.member)
    this.save()
    return { token: result.token, role: 'pending' as const }
  }

  role(room: string, token: string): Role | 'open' {
    const policy = this.rooms[room]
    if (!policy) return 'open'
    return policy.members.find((member) => member.key === hash(token))?.role ?? 'rejected'
  }

  list(room: string, token: string) {
    if (this.role(room, token) !== 'host') throw new Error('Host access required')
    return this.policy(room).members.map(({ id, name, role }) => ({ id, name, role }))
  }

  approve(room: string, token: string, id: string, role: string) {
    this.list(room, token)
    if (!['editor', 'viewer', 'rejected'].includes(role)) throw new Error('Invalid role')
    const member = this.policy(room).members.find((candidate) => candidate.id === id)
    if (!member || member.role === 'host') throw new Error('Cannot change this member')
    member.role = role as Role
    this.save()
  }
}

/** Fixed window per IP. Exported so the limit is tested without a socket. */
export function createPostRateLimit(max = 30, windowMs = 60_000) {
  const attempts = new Map<string, { count: number; at: number }>()
  return (ip: string, now = Date.now()) => {
    for (const [key, value] of attempts) if (now - value.at > windowMs) attempts.delete(key)
    const attempt = attempts.get(ip) ?? { count: 0, at: now }
    attempts.set(ip, attempt)
    attempt.count += 1
    if (attempt.count > max) throw new Error('Too many requests; wait one minute')
  }
}

function textField(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value : ''
}

export function accessApi(store: AccessStore) {
  const allowPost = createPostRateLimit()
  return async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return false
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
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
      if (request.method !== 'POST') throw new Error('Unsupported method')
      allowPost(request.socket.remoteAddress ?? 'unknown')
      let raw = ''
      for await (const chunk of request) {
        raw += chunk
        if (raw.length > 4096) throw new Error('Request too large')
      }
      const parsed: unknown = JSON.parse(raw || '{}')
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Expected a JSON object')
      }
      const body = parsed as Record<string, unknown>
      let result: unknown
      if (url.pathname === '/api/create')
        result = store.create(textField(body, 'password'), textField(body, 'name'))
      else if (url.pathname === '/api/join')
        result = store.join(room, textField(body, 'password'), textField(body, 'name'))
      else if (url.pathname === '/api/approve') {
        store.approve(room, token, textField(body, 'id'), textField(body, 'role'))
        result = { ok: true }
      } else throw new Error('Unknown endpoint')
      response.end(JSON.stringify(result))
    } catch (error) {
      response
        .writeHead(400)
        .end(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed' }))
    }
    return true
  }
}
