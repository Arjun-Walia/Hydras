import { describe, expect, it } from 'vitest'
import { isFreshRoom, rememberFreshRoom } from './fresh-room'

describe('fresh rooms', () => {
  it('only the room this tab just created counts', () => {
    const saved = new Map<string, string>()
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    }
    rememberFreshRoom('bold-gecko-f59e', storage)
    expect(isFreshRoom('bold-gecko-f59e', storage)).toBe(true)
    expect(isFreshRoom('other-room-0000', storage)).toBe(false)
  })

  it('stays closed when storage is unavailable', () => {
    expect(isFreshRoom('bold-gecko-f59e', null)).toBe(false)
  })
})