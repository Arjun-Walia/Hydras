/**
 * Settings model (Opcodex-style): theme, workspace layout, editor, sync, motion.
 * Pure: defaults, layout presets, and `sanitizeSettings`, which turns whatever is in
 * localStorage (old versions, hand edits, garbage) into a valid Settings object.
 */
import { DEFAULT_SYNC_URL } from '@hydras/shared'
import { clampCodeSize, defaultEditorPrefs, type EditorPrefs } from '@hydras/editor'
import { DEFAULT_THEME_ID, parseThemeFile, type ThemeSpec } from '@hydras/ui'

export type LayoutPresetId = 'explore' | 'pair' | 'focus' | 'review'

export interface LayoutSettings {
  showFiles: boolean
  showInspector: boolean
  compactRows: boolean
}

export interface Settings {
  themeId: string
  customThemes: ThemeSpec[]
  layout: LayoutSettings
  editor: EditorPrefs
  reduceMotion: boolean
  /** null means the build-time default sync server. */
  syncUrl: string | null
}

export interface LayoutPreset {
  id: LayoutPresetId
  name: string
  description: string
  layout: Pick<LayoutSettings, 'showFiles' | 'showInspector'>
}

export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
  {
    id: 'explore',
    name: 'Explore',
    description: 'Files on the left, code in the middle.',
    layout: { showFiles: true, showInspector: false },
  },
  {
    id: 'pair',
    name: 'Pair',
    description: 'Adds the sync inspector, for watching merges live.',
    layout: { showFiles: true, showInspector: true },
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'Just the code. Jump anywhere with Ctrl K.',
    layout: { showFiles: false, showInspector: false },
  },
  {
    id: 'review',
    name: 'Review',
    description: 'Code with the inspector, for checking changes.',
    layout: { showFiles: false, showInspector: true },
  },
]

export const DEFAULT_SETTINGS: Settings = {
  themeId: DEFAULT_THEME_ID,
  customThemes: [],
  layout: { showFiles: true, showInspector: false, compactRows: false },
  editor: defaultEditorPrefs,
  reduceMotion: false,
  syncUrl: null,
}

/** Which preset the panels match, or 'custom' after manual changes. */
export function presetOf(layout: LayoutSettings): LayoutPresetId | 'custom' {
  const match = LAYOUT_PRESETS.find(
    (p) =>
      p.layout.showFiles === layout.showFiles && p.layout.showInspector === layout.showInspector,
  )
  return match?.id ?? 'custom'
}

/** ws:// or wss:// only; returns the normalized URL or null if invalid. */
export function normalizeSyncUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function effectiveSyncUrl(
  settings: Settings,
  buildDefault: string = DEFAULT_SYNC_URL,
): string {
  return settings.syncUrl ?? buildDefault
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

function sanitizeThemes(value: unknown): ThemeSpec[] {
  if (!Array.isArray(value)) return []
  const themes: ThemeSpec[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const parsed = parseThemeFile({ ...item, format: 'hydras-theme/1' })
    if (parsed.ok && !themes.some((t) => t.id === parsed.theme.id)) themes.push(parsed.theme)
  }
  return themes
}

export function sanitizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS
  const layout = isRecord(raw.layout) ? raw.layout : {}
  const editor = isRecord(raw.editor) ? raw.editor : {}
  const d = DEFAULT_SETTINGS
  return {
    themeId: typeof raw.themeId === 'string' ? raw.themeId : d.themeId,
    customThemes: sanitizeThemes(raw.customThemes),
    layout: {
      showFiles: bool(layout.showFiles, d.layout.showFiles),
      showInspector: bool(layout.showInspector, d.layout.showInspector),
      compactRows: bool(layout.compactRows, d.layout.compactRows),
    },
    editor: {
      fontSize:
        typeof editor.fontSize === 'number' ? clampCodeSize(editor.fontSize) : d.editor.fontSize,
      lineNumbers: bool(editor.lineNumbers, d.editor.lineNumbers),
      wrapLines: bool(editor.wrapLines, d.editor.wrapLines),
    },
    reduceMotion: bool(raw.reduceMotion, d.reduceMotion),
    syncUrl: typeof raw.syncUrl === 'string' ? normalizeSyncUrl(raw.syncUrl) : null,
  }
}
