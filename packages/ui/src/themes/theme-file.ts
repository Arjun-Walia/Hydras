/**
 * Theme files: export the current theme, import someone else's.
 *
 * Accepts `hydras-theme/1` and, for compatibility, Opcodex's `opcodex-theme/1`
 * (same idea, extra keys ignored). Only 6-digit hex colors are accepted, so an imported
 * file can never inject arbitrary CSS through a color value.
 */
import { CODE_COLOR_KEYS, THEME_COLOR_KEYS, type ThemeSpec } from './types'

export const THEME_FILE_FORMAT = 'hydras-theme/1'
const ACCEPTED_FORMATS = new Set([THEME_FILE_FORMAT, 'opcodex-theme/1'])
const HEX = /^#[0-9a-fA-F]{6}$/
const MAX_NAME = 60

export type ParseResult = { ok: true; theme: ThemeSpec } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readHexGroup<K extends string>(
  group: unknown,
  keys: readonly K[],
  label: string,
): Record<K, string> | string {
  if (!isRecord(group)) return `Missing "${label}" colors`
  const result = {} as Record<K, string>
  for (const key of keys) {
    const value = group[key]
    if (typeof value !== 'string' || !HEX.test(value)) {
      return `${label}.${key} must be a hex color like #1e1e2e`
    }
    result[key] = value.toLowerCase()
  }
  return result
}

export function slugifyThemeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

/** Validate an already-parsed JSON value. Never throws. */
export function parseThemeFile(input: unknown): ParseResult {
  if (!isRecord(input)) return { ok: false, error: 'Not a theme file' }
  if (typeof input.format !== 'string' || !ACCEPTED_FORMATS.has(input.format)) {
    return { ok: false, error: `Unknown format. Expected "${THEME_FILE_FORMAT}"` }
  }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, MAX_NAME) : ''
  if (!name) return { ok: false, error: 'Theme needs a name' }
  if (input.kind !== 'dark' && input.kind !== 'light') {
    return { ok: false, error: 'kind must be "dark" or "light"' }
  }

  const colors = readHexGroup(input.colors, THEME_COLOR_KEYS, 'colors')
  if (typeof colors === 'string') return { ok: false, error: colors }
  const code = readHexGroup(input.code, CODE_COLOR_KEYS, 'code')
  if (typeof code === 'string') return { ok: false, error: code }

  const rawMuted = isRecord(input.colors) ? input.colors.muted : undefined
  const muted =
    typeof rawMuted === 'string' && HEX.test(rawMuted) ? rawMuted.toLowerCase() : undefined
  const author = typeof input.author === 'string' ? input.author.trim().slice(0, MAX_NAME) : ''

  return {
    ok: true,
    theme: {
      id: `imported-${slugifyThemeName(name) || 'theme'}`,
      name,
      author: author || 'Unknown',
      kind: input.kind,
      source: 'imported',
      colors: muted ? { ...colors, muted } : colors,
      code,
    },
  }
}

/** Parse raw file text. Never throws. */
export function parseThemeText(text: string): ParseResult {
  try {
    return parseThemeFile(JSON.parse(text))
  } catch {
    return { ok: false, error: 'File is not valid JSON' }
  }
}

export function serializeTheme(theme: ThemeSpec): string {
  const file = {
    format: THEME_FILE_FORMAT,
    name: theme.name,
    author: theme.author,
    kind: theme.kind,
    colors: theme.colors,
    code: theme.code,
  }
  return `${JSON.stringify(file, null, 2)}\n`
}
