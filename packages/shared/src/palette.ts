/**
 * Collaborator palette: 8 hues at fixed oklch lightness so every color reads on the dark
 * background. Assignment is deterministic from the user id, so a user keeps their color
 * across reloads and every client computes the same color without coordination.
 */

export const PALETTE_HUES = [15, 60, 110, 160, 210, 255, 305, 350] as const

const DARK_LIGHTNESS = 0.78
const LIGHT_LIGHTNESS = 0.55
const CHROMA = 0.14
const SELECTION_ALPHA = 0.22

export type ThemeName = 'dark' | 'light'

/** FNV-1a 32-bit. Small, fast, and stable across platforms. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function paletteIndexFor(userId: string): number {
  return hashString(userId) % PALETTE_HUES.length
}

export function colorForUser(userId: string, theme: ThemeName = 'dark') {
  const hue = PALETTE_HUES[paletteIndexFor(userId)]
  const lightness = theme === 'dark' ? DARK_LIGHTNESS : LIGHT_LIGHTNESS
  return {
    color: `oklch(${lightness} ${CHROMA} ${hue})`,
    colorLight: `oklch(${lightness} ${CHROMA} ${hue} / ${SELECTION_ALPHA})`,
  }
}
