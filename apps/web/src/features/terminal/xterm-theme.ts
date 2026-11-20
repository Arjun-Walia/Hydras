/**
 * xterm.js needs concrete colors, but our tokens can be color-mix() expressions.
 * Resolve them through the browser by painting a probe element.
 */
import type { ITheme } from '@xterm/xterm'

function resolve(probe: HTMLElement, cssVar: string, fallback: string): string {
  probe.style.color = fallback
  probe.style.color = `var(${cssVar})`
  return getComputedStyle(probe).color || fallback
}

export function xtermThemeFromTokens(): ITheme {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  try {
    const isDark = document.documentElement.dataset.theme !== 'light'
    return {
      background: resolve(probe, '--bg', isDark ? '#090909' : '#f7f7f6'),
      foreground: resolve(probe, '--fg', isDark ? '#f0f0ed' : '#202020'),
      cursor: resolve(probe, '--accent', '#b1cfc0'),
      cursorAccent: resolve(probe, '--bg', '#090909'),
      selectionBackground: resolve(probe, '--selection', 'rgba(177,207,192,0.2)'),
      black: isDark ? '#1c1c1b' : '#3a3a38',
      red: resolve(probe, '--danger', '#ec6a5e'),
      green: resolve(probe, '--syn-string', '#a3d6a8'),
      yellow: resolve(probe, '--warn', '#e6b45a'),
      blue: resolve(probe, '--syn-function', '#a5d4e3'),
      magenta: resolve(probe, '--syn-keyword', '#c3a9e4'),
      cyan: resolve(probe, '--syn-type', '#96d9cd'),
      white: resolve(probe, '--muted', '#a4a4a0'),
      brightBlack: resolve(probe, '--faint', '#6b6b67'),
      brightWhite: resolve(probe, '--fg', '#f0f0ed'),
    }
  } finally {
    probe.remove()
  }
}
