import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, serializeTheme } from '@hydras/ui'
import {
  DEFAULT_SETTINGS,
  LAYOUT_PRESETS,
  effectiveSyncUrl,
  normalizeSyncUrl,
  presetOf,
  sanitizeSettings,
} from './settings'

describe('layout presets', () => {
  it('recognises every preset from its panel switches', () => {
    for (const preset of LAYOUT_PRESETS) {
      expect(presetOf({ ...preset.layout, compactRows: true })).toBe(preset.id)
    }
  })

  it('has one preset per panel combination, so nothing is "custom" yet', () => {
    const combos = new Set(
      LAYOUT_PRESETS.map((p) => `${p.layout.showFiles}-${p.layout.showInspector}`),
    )
    expect(combos.size).toBe(4)
  })
})

describe('sync server URL', () => {
  it('accepts ws and wss, trims, and drops a trailing slash', () => {
    expect(normalizeSyncUrl(' wss://sync.hydras.software/ ')).toBe('wss://sync.hydras.software')
    expect(normalizeSyncUrl('ws://localhost:1234')).toBe('ws://localhost:1234')
  })

  it('rejects other schemes and garbage', () => {
    expect(normalizeSyncUrl('https://example.com')).toBeNull()
    expect(normalizeSyncUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeSyncUrl('not a url')).toBeNull()
  })

  it('falls back to the build default when unset', () => {
    expect(effectiveSyncUrl(DEFAULT_SETTINGS, 'ws://default:1')).toBe('ws://default:1')
  })
})

describe('sanitizeSettings', () => {
  it('returns defaults for missing or corrupt storage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps the code size and ignores wrong types field by field', () => {
    const result = sanitizeSettings({
      editor: { fontSize: 40, lineNumbers: 'yes', wrapLines: true },
      layout: { showFiles: false },
      reduceMotion: 1,
    })
    expect(result.editor).toEqual({ fontSize: 18, lineNumbers: true, wrapLines: true })
    expect(result.layout.showFiles).toBe(false)
    expect(result.layout.showInspector).toBe(DEFAULT_SETTINGS.layout.showInspector)
    expect(result.reduceMotion).toBe(false)
  })

  it('keeps valid imported themes and drops tampered ones', () => {
    const good = JSON.parse(serializeTheme(BUILTIN_THEMES[0]!))
    const bad = { ...good, name: 'Bad', colors: { ...good.colors, accent: 'url(x)' } }
    const result = sanitizeSettings({ customThemes: [good, bad] })
    expect(result.customThemes).toHaveLength(1)
    expect(result.customThemes[0]?.name).toBe(good.name)
  })

  it('drops an invalid saved sync URL', () => {
    expect(sanitizeSettings({ syncUrl: 'http://x' }).syncUrl).toBeNull()
  })
})
