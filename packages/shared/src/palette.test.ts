import { describe, expect, it } from 'vitest'
import { colorForUser, createIdentity, paletteIndexFor, randomDisplayName } from './index'

describe('palette', () => {
  it('assigns the same color to the same user id every time', () => {
    expect(colorForUser('user-a')).toEqual(colorForUser('user-a'))
  })

  it('stays inside the 8-color palette', () => {
    for (let i = 0; i < 200; i++) {
      const index = paletteIndexFor(`user-${i}`)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(8)
    }
  })

  it('uses a darker lightness for the light theme', () => {
    expect(colorForUser('x', 'light').color).toMatch(/^oklch\(0\.55 /)
    expect(colorForUser('x', 'dark').color).toMatch(/^oklch\(0\.78 /)
  })
})

describe('identity', () => {
  it('falls back to "anonymous" for blank names and trims long ones', () => {
    expect(createIdentity('id', '   ').name).toBe('anonymous')
    expect(createIdentity('id', 'x'.repeat(50)).name).toHaveLength(32)
  })

  it('builds adjective-animal names from the random source', () => {
    expect(randomDisplayName(() => 0)).toBe('brisk-otter')
  })
})
