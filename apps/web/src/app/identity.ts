/**
 * Per-browser identity (no auth in scope): a stable id plus a chosen display name.
 */
import { createIdentity, type UserIdentity } from '@hydras/shared'
import { readLocal, writeLocal } from './storage'

const ID_KEY = 'hydras.userId'
const NAME_KEY = 'hydras.userName'

function stableUserId(): string {
  const existing = readLocal(ID_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  writeLocal(ID_KEY, id)
  return id
}

/** The saved identity, or null on a first visit (show the join screen). */
export function loadIdentity(): UserIdentity | null {
  const name = readLocal(NAME_KEY)
  return name ? createIdentity(stableUserId(), name) : null
}

export function saveIdentity(name: string): UserIdentity {
  const identity = createIdentity(stableUserId(), name)
  writeLocal(NAME_KEY, identity.name)
  return identity
}

export function previewIdentity(name: string): UserIdentity {
  return createIdentity(stableUserId(), name)
}
