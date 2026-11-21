import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from './builtin'
import { themeToCssVars } from './apply'
import { parseThemeFile, parseThemeText, serializeTheme } from './theme-file'

const graphite = BUILTIN_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!

describe('built-in themes', () => {
  it('have unique ids and only hex colors', () => {
    expect(new Set(BUILTIN_THEMES.map((t) => t.id)).size).toBe(BUILTIN_THEMES.length)
    for (const theme of BUILTIN_THEMES) {
      for (const value of [...Object.values(theme.colors), ...Object.values(theme.code)]) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('include both a dark and a light Hydras theme', () => {
    const hydras = BUILTIN_THEMES.filter((t) => t.source === 'hydras').map((t) => t.kind)
    expect(hydras).toEqual(expect.arrayContaining(['dark', 'light']))
  })
})

describe('theme files', () => {
  it('round-trips through export and import', () => {
    const result = parseThemeText(serializeTheme(graphite))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.theme).toMatchObject({
      name: graphite.name,
      kind: 'dark',
      source: 'imported',
      colors: graphite.colors,
      code: graphite.code,
    })
  })

  it('accepts an Opcodex theme file, ignoring its extra keys', () => {
    const opcodex = {
      format: 'opcodex-theme/1',
      name: 'My theme',
      author: 'You',
      kind: 'dark',
      colors: {
        background: '#111214',
        surface: '#16171a',
        border: '#2a2b30',
        text: '#ececee',
        accent: '#5b8def',
        success: '#6fbf8e',
        warning: '#d9b26a',
        danger: '#e07a7a',
      },
      code: {
        keyword: '#c09ad8',
        type: '#8fc3b8',
        function: '#8fb3e8',
        variable: '#d9d9de',
        string: '#a8c79a',
        number: '#d9a386',
        comment: '#6b6b74',
        operator: '#a1a1aa',
      },
    }
    const result = parseThemeFile(opcodex)
    expect(result.ok && result.theme.id).toBe('imported-my-theme')
    expect(result.ok && result.theme.colors.muted).toBeUndefined()
  })

  it('rejects non-hex colors so a file cannot inject CSS', () => {
    const bad = JSON.parse(serializeTheme(graphite))
    bad.colors.accent = 'red; background: url(x)'
    expect(parseThemeFile(bad)).toEqual({
      ok: false,
      error: 'colors.accent must be a hex color like #1e1e2e',
    })
  })

  it('rejects wrong formats, missing names and bad JSON', () => {
    expect(parseThemeFile({ format: 'vscode' }).ok).toBe(false)
    expect(parseThemeFile({ ...JSON.parse(serializeTheme(graphite)), name: '  ' }).ok).toBe(false)
    expect(parseThemeText('{not json')).toEqual({ ok: false, error: 'File is not valid JSON' })
  })
})

describe('themeToCssVars', () => {
  it('maps the spec onto the app tokens and derives soft tones', () => {
    const vars = themeToCssVars(graphite)
    expect(vars['--bg']).toBe('#090909')
    expect(vars['--accent-ink']).toBe('#090909')
    expect(vars['--faint']).toContain('92%')
    expect(vars['--selection']).toContain('color-mix')
    expect(vars['--syn-keyword']).toBe(graphite.code.keyword)
  })

  it('derives muted text when a theme does not set it', () => {
    const colors = { ...graphite.colors, muted: undefined }
    const vars = themeToCssVars({ ...graphite, colors })
    expect(vars['--muted']).toContain('color-mix')
  })
})
