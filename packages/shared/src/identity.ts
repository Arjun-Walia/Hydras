/**
 * Display identity without auth: a random adjective-animal name and a stable id.
 * Pure given an injected random source, so tests are deterministic.
 */
import { colorForUser } from './palette'
import type { UserIdentity } from './types'

const ADJECTIVES = [
  'brisk',
  'calm',
  'clever',
  'quiet',
  'lucid',
  'nimble',
  'bold',
  'keen',
  'merry',
  'sly',
]
const ANIMALS = [
  'otter',
  'heron',
  'lynx',
  'gecko',
  'ibis',
  'marten',
  'okapi',
  'puffin',
  'tapir',
  'wren',
]

type RandomSource = () => number

function pick<T>(items: readonly T[], random: RandomSource): T {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) throw new Error('pick() called with an empty list')
  return item
}

export function randomDisplayName(random: RandomSource = Math.random): string {
  return `${pick(ADJECTIVES, random)}-${pick(ANIMALS, random)}`
}

export function createIdentity(id: string, name: string): UserIdentity {
  const trimmed = name.trim().slice(0, 32)
  return { id, name: trimmed.length > 0 ? trimmed : 'anonymous', ...colorForUser(id) }
}
