/**
 * Turn a ThemeSpec into the CSS custom properties the app and editor read.
 * `themeToCssVars` is pure (tested); `applyTheme` writes them onto an element.
 */
import type { ThemeSpec } from './types'

const mix = (a: string, pct: number, b: string) => `color-mix(in oklab, ${a} ${pct}%, ${b})`
const alpha = (color: string, pct: number) => mix(color, pct, 'transparent')

export function themeToCssVars(theme: ThemeSpec): Record<string, string> {
  const { colors, code } = theme
  const muted = colors.muted ?? mix(colors.text, 62, colors.background)
  const raiseToward = theme.kind === 'dark' ? colors.text : colors.background
  return {
    '--bg': colors.background,
    '--surface': colors.surface,
    '--surface-soft': mix(colors.background, 55, colors.surface),
    '--surface-raised': mix(colors.surface, 92, raiseToward),
    '--line': colors.border,
    '--line-soft': mix(colors.border, 55, colors.background),
    '--fg': colors.text,
    '--muted': muted,
    // Stay close to `muted`. A 62% mix fell under 4.5:1 on both the dark and light backgrounds.
    '--faint': mix(muted, 92, colors.background),
    '--accent': colors.accent,
    '--accent-ink': colors.background,
    '--accent-soft': alpha(colors.accent, 13),
    '--selection': alpha(colors.accent, 20),
    '--warn': colors.warning,
    '--warn-soft': alpha(colors.warning, 13),
    '--danger': colors.danger,
    '--scrollbar': alpha(colors.text, 14),
    '--syn-keyword': code.keyword,
    '--syn-string': code.string,
    '--syn-number': code.number,
    '--syn-function': code.function,
    '--syn-type': code.type,
    '--syn-comment': code.comment,
  }
}

export function applyTheme(
  theme: ThemeSpec,
  element: HTMLElement = document.documentElement,
): void {
  element.dataset.theme = theme.kind
  for (const [name, value] of Object.entries(themeToCssVars(theme))) {
    element.style.setProperty(name, value)
  }
}
