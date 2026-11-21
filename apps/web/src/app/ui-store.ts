/**
 * Session-only UI state (zustand): dialogs, tabs, cursor. Not persisted.
 * Persisted preferences live in settings-store; document state lives in the Y.Doc.
 */
import { create } from 'zustand'

export interface CursorPosition {
  line: number
  column: number
}

export type SettingsSection = 'theme' | 'layout' | 'editor' | 'sync' | 'general'

/** What the main area shows: the code editor or the room's shared whiteboard. */
export type WorkspaceView = 'code' | 'board'

interface UiState {
  view: WorkspaceView
  setView(view: WorkspaceView): void
  roomPanelOpen: boolean
  setRoomPanelOpen(open: boolean): void
  paletteOpen: boolean
  settingsSection: SettingsSection | null
  openTabs: string[]
  activeFileId: string | null
  cursor: CursorPosition | null
  terminalOpen: boolean
  /** Absolute root of the folder mirrored on this machine (desktop only), for terminals. */
  folderRoot: string | null
  setPaletteOpen(open: boolean): void
  toggleTerminal(open?: boolean): void
  setFolderRoot(root: string | null): void
  openSettings(section?: SettingsSection): void
  closeSettings(): void
  openFile(id: string): void
  closeTab(id: string): void
  pruneTabs(validIds: ReadonlySet<string>): void
  setCursor(cursor: CursorPosition | null): void
}

function neighbourAfterClose(tabs: readonly string[], closing: string): string | null {
  const index = tabs.indexOf(closing)
  const remaining = tabs.filter((id) => id !== closing)
  return remaining[Math.min(index, remaining.length - 1)] ?? null
}

export const useUiStore = create<UiState>()((set) => ({
  view: 'code',
  setView: (view) => set({ view }),
  roomPanelOpen: false,
  setRoomPanelOpen: (roomPanelOpen) => set({ roomPanelOpen }),
  paletteOpen: false,
  settingsSection: null,
  openTabs: [],
  activeFileId: null,
  cursor: null,
  terminalOpen: false,
  folderRoot: null,

  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  toggleTerminal: (open) => set((s) => ({ terminalOpen: open ?? !s.terminalOpen })),
  setFolderRoot: (folderRoot) => set({ folderRoot }),
  openSettings: (section = 'theme') => set({ settingsSection: section, paletteOpen: false }),
  closeSettings: () => set({ settingsSection: null }),

  openFile: (id) =>
    set((s) => ({
      openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
      activeFileId: id,
    })),

  closeTab: (id) =>
    set((s) => ({
      openTabs: s.openTabs.filter((tab) => tab !== id),
      activeFileId: s.activeFileId === id ? neighbourAfterClose(s.openTabs, id) : s.activeFileId,
    })),

  pruneTabs: (validIds) =>
    set((s) => {
      const openTabs = s.openTabs.filter((id) => validIds.has(id))
      if (openTabs.length === s.openTabs.length) return s
      const activeFileId =
        s.activeFileId && validIds.has(s.activeFileId) ? s.activeFileId : (openTabs[0] ?? null)
      return { openTabs, activeFileId }
    }),

  setCursor: (cursor) => set({ cursor }),
}))
