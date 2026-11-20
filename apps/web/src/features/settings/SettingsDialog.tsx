/**
 * Settings (Ctrl+,): Opcodex-style dialog with a section rail on the left.
 * Uses a native <dialog> for focus trapping, Escape-to-close and the top layer.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Code2, Cog, LayoutPanelLeft, Palette, Radio, X } from 'lucide-react'
import { IconButton, cn } from '@hydras/ui'
import { useUiStore, type SettingsSection } from '../../app/ui-store'
import { EditorSection } from './EditorSection'
import { GeneralSection } from './GeneralSection'
import { LayoutSection } from './LayoutSection'
import { SyncSection } from './SyncSection'
import { ThemeSection } from './ThemeSection'

const SECTIONS: { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: 'theme', label: 'Theme', icon: <Palette size={14} /> },
  { id: 'layout', label: 'Workspace layout', icon: <LayoutPanelLeft size={14} /> },
  { id: 'editor', label: 'Editor', icon: <Code2 size={14} /> },
  { id: 'sync', label: 'Sync server', icon: <Radio size={14} /> },
  { id: 'general', label: 'General', icon: <Cog size={14} /> },
]

const CONTENT: Record<SettingsSection, () => ReactNode> = {
  theme: () => <ThemeSection />,
  layout: () => <LayoutSection />,
  editor: () => <EditorSection />,
  sync: () => <SyncSection />,
  general: () => <GeneralSection />,
}

export function SettingsDialog() {
  const section = useUiStore((s) => s.settingsSection)
  const openSettings = useUiStore((s) => s.openSettings)
  const closeSettings = useUiStore((s) => s.closeSettings)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (section && !dialog.open) dialog.showModal()
    if (!section && dialog.open) dialog.close()
  }, [section])

  return (
    <dialog
      ref={dialogRef}
      onClose={closeSettings}
      onClick={(event) => event.target === dialogRef.current && closeSettings()}
      aria-label="Settings"
      className="m-auto h-[min(620px,calc(100vh-48px))] w-[min(880px,calc(100vw-32px))] overflow-hidden rounded-[var(--radius-dialog)] border border-line bg-surface p-0 text-fg shadow-[0_30px_80px_-24px_rgb(0_0_0/0.65)] backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
    >
      {section && (
        <div className="grid h-full grid-cols-[200px_1fr]">
          <nav
            className="flex flex-col gap-0.5 border-r border-line-soft bg-surface-soft p-2.5"
            aria-label="Settings sections"
          >
            <p className="px-2.5 pt-1.5 pb-3 font-serif text-[22px] leading-none italic">
              Settings
            </p>
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openSettings(item.id)}
                aria-current={item.id === section ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2.5 rounded-[var(--radius-chrome)] px-2.5 text-left text-[12.5px] transition-colors duration-150',
                  item.id === section
                    ? 'bg-accent-soft text-fg'
                    : 'text-muted hover:bg-surface-raised hover:text-fg',
                )}
              >
                <span className={item.id === section ? 'text-accent' : 'text-faint'}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="relative min-h-0 overflow-y-auto px-8 py-7">
            <IconButton
              label="Close settings"
              onClick={closeSettings}
              className="absolute top-3 right-3"
            >
              <X size={15} />
            </IconButton>
            {CONTENT[section]()}
          </div>
        </div>
      )}
    </dialog>
  )
}
