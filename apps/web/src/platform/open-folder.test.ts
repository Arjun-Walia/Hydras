import { describe, expect, it } from 'vitest'
import { ROOM_SLUG_PATTERN } from '@hydras/shared'
import { slugForFolder } from './open-folder'

describe('slugForFolder', () => {
  it('turns folder names into valid room slugs', () => {
    expect(slugForFolder('My Project_v2', () => 0)).toBe('my-project-v2-0000')
    expect(slugForFolder('hydras', () => 0.5)).toBe('hydras-8000')
  })

  it('falls back for names with no usable characters', () => {
    expect(slugForFolder('日本語', () => 0)).toBe('project-0000')
    expect(slugForFolder('___', () => 0)).toBe('project-0000')
  })

  it('always matches the server room pattern', () => {
    for (const name of ['a', 'X'.repeat(80), '..', 'name with spaces', 'C:\\Users\\me']) {
      expect(ROOM_SLUG_PATTERN.test(slugForFolder(name))).toBe(true)
    }
  })
})
