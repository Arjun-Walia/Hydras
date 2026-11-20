/**
 * A theme is a small set of hex colors. Everything else (soft surfaces, selection,
 * scrollbars) is derived in CSS with color-mix, so a theme file stays short and every
 * theme gets the same, consistent derived tones.
 */

export type ThemeKind = 'dark' | 'light'
export type ThemeSource = 'hydras' | 'community' | 'imported'

export interface ThemeColors {
  background: string
  surface: string
  border: string
  text: string
  /** Secondary text. Optional: derived from text + background when absent. */
  muted?: string
  accent: string
  warning: string
  danger: string
}

export interface CodeColors {
  keyword: string
  type: string
  function: string
  string: string
  number: string
  comment: string
}

export interface ThemeSpec {
  id: string
  name: string
  author: string
  kind: ThemeKind
  source: ThemeSource
  colors: ThemeColors
  code: CodeColors
}

export const THEME_COLOR_KEYS = [
  'background',
  'surface',
  'border',
  'text',
  'accent',
  'warning',
  'danger',
] as const satisfies readonly (keyof ThemeColors)[]

export const CODE_COLOR_KEYS = [
  'keyword',
  'type',
  'function',
  'string',
  'number',
  'comment',
] as const satisfies readonly (keyof CodeColors)[]
