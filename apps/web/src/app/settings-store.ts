/**
 * Persisted settings (zustand). Saved to localStorage for this browser / desktop install,
 * validated on every load through `sanitizeSettings`. Side effects on the page (theme
 * variables, motion flag, row density) are applied by `applyDocumentSettings`.
 */
import { create } from 'zustand'
import type { EditorPrefs } from '@hydras/editor'
import { BUILTIN_THEMES, DEFAULT_THEME_ID, applyTheme, type ThemeSpec } from '@hydras/ui'
import {
  DEFAULT_SETTINGS,
  LAYOUT_PRESETS,
  sanitizeSettings,
  type LayoutPresetId,
  type LayoutSettings,
  type Settings,
} from './settings'
import { readLocal, writeLocal } from './storage'

const STORAGE_KEY = 'hydras.settings.v1'

interface SettingsActions {
  setTheme(id: string): void
  addCustomTheme(theme: ThemeSpec): void
  removeCustomTheme(id: string): void
  applyPreset(id: LayoutPresetId): void
  setLayout(patch: Partial<LayoutSettings>): void
  setEditor(patch: Partial<EditorPrefs>): void
  setReduceMotion(value: boolean): void
  setSyncUrl(url: string | null): void
  reset(): void
}

export type SettingsState = Settings & SettingsActions

function loadSettings(): Settings {
  const raw = readLocal(STORAGE_KEY)
  if (!raw) return DEFAULT_SETTINGS
  try {
    return sanitizeSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

function pickSettings(state: SettingsState): Settings {
  const { themeId, customThemes, layout, editor, reduceMotion, syncUrl } = state
  return { themeId, customThemes, layout, editor, reduceMotion, syncUrl }
}

export function allThemes(settings: Pick<Settings, 'customThemes'>): ThemeSpec[] {
  return [...BUILTIN_THEMES, ...settings.customThemes]
}

export function resolveTheme(settings: Pick<Settings, 'themeId' | 'customThemes'>): ThemeSpec {
  const themes = allThemes(settings)
  return (
    themes.find((t) => t.id === settings.themeId) ??
    themes.find((t) => t.id === DEFAULT_THEME_ID) ??
    BUILTIN_THEMES[0]!
  )
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...loadSettings(),

  setTheme: (themeId) => set({ themeId }),
  addCustomTheme: (theme) =>
    set((s) => ({
      customThemes: [...s.customThemes.filter((t) => t.id !== theme.id), theme],
      themeId: theme.id,
    })),
  removeCustomTheme: (id) =>
    set((s) => ({
      customThemes: s.customThemes.filter((t) => t.id !== id),
      themeId: s.themeId === id ? DEFAULT_THEME_ID : s.themeId,
    })),
  applyPreset: (id) => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === id)
    if (preset) set((s) => ({ layout: { ...s.layout, ...preset.layout } }))
  },
  setLayout: (patch) => set((s) => ({ layout: { ...s.layout, ...patch } })),
  setEditor: (patch) => set((s) => ({ editor: { ...s.editor, ...patch } })),
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
  setSyncUrl: (syncUrl) => set({ syncUrl }),
  reset: () => set(DEFAULT_SETTINGS),
}))

useSettingsStore.subscribe((state) => writeLocal(STORAGE_KEY, JSON.stringify(pickSettings(state))))

/** Push theme, motion and density onto <html>. Safe to call on every settings change. */
export function applyDocumentSettings(
  settings: Settings,
  root: HTMLElement = document.documentElement,
) {
  applyTheme(resolveTheme(settings), root)
  root.dataset.reduceMotion = String(settings.reduceMotion)
  root.dataset.density = settings.layout.compactRows ? 'compact' : 'comfortable'
}
