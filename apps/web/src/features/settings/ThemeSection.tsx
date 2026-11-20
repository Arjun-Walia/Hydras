/**
 * Theme picker: Hydras, Community and imported ("Yours") themes as live-preview cards,
 * plus Import / Export of theme files.
 */
import { useRef, type ChangeEvent, type ReactNode } from 'react'
import { Check, Download, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  BUILTIN_THEMES,
  IconButton,
  cn,
  parseThemeText,
  serializeTheme,
  slugifyThemeName,
  type ThemeSpec,
} from '@hydras/ui'
import { resolveTheme, useSettingsStore } from '../../app/settings-store'
import { SectionHeader, SubHeading } from './SectionHeader'

const MAX_THEME_FILE_BYTES = 64 * 1024

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function ThemeSection() {
  const themeId = useSettingsStore((s) => s.themeId)
  const customThemes = useSettingsStore((s) => s.customThemes)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const addCustomTheme = useSettingsStore((s) => s.addCustomTheme)
  const removeCustomTheme = useSettingsStore((s) => s.removeCustomTheme)
  const fileInput = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const theme = resolveTheme(useSettingsStore.getState())
    downloadText(
      `${slugifyThemeName(theme.name) || 'theme'}.hydras-theme.json`,
      serializeTheme(theme),
    )
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_THEME_FILE_BYTES) {
      toast.error('Theme file is too large')
      return
    }
    const result = parseThemeText(await file.text())
    if (!result.ok) {
      toast.error(`Could not import theme: ${result.error}`)
      return
    }
    addCustomTheme(result.theme)
    toast.success(`Imported ${result.theme.name}`)
  }

  const groups: { title: string; themes: readonly ThemeSpec[] }[] = [
    { title: 'Hydras', themes: BUILTIN_THEMES.filter((t) => t.source === 'hydras') },
    { title: 'Community', themes: BUILTIN_THEMES.filter((t) => t.source === 'community') },
    { title: 'Yours', themes: customThemes },
  ]

  return (
    <>
      <SectionHeader title="Theme">
        Colors the interface and the code. Import a{' '}
        <code className="font-mono text-[12px]">.hydras-theme.json</code> (Opcodex theme files work
        too) or export the current one to share it.
      </SectionHeader>

      <div className="flex gap-2">
        <ActionButton onClick={() => fileInput.current?.click()} icon={<Upload size={13} />}>
          Import
        </ActionButton>
        <ActionButton onClick={handleExport} icon={<Download size={13} />}>
          Export current
        </ActionButton>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void handleImport(e)}
        />
      </div>

      {groups.map((group) => (
        <section key={group.title}>
          <SubHeading>{group.title}</SubHeading>
          {group.themes.length === 0 ? (
            <p className="font-serif text-[17px] text-faint italic">Nothing imported yet</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
              {group.themes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isActive={theme.id === themeId}
                  onSelect={() => setTheme(theme.id)}
                  onRemove={
                    theme.source === 'imported' ? () => removeCustomTheme(theme.id) : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  )
}

type CardProps = {
  theme: ThemeSpec
  isActive: boolean
  onSelect: () => void
  onRemove?: () => void
}

function ThemeCard({ theme, isActive, onSelect, onRemove }: CardProps) {
  const { colors, code } = theme
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
        className={cn(
          'w-full overflow-hidden rounded-[8px] border text-left transition-[border-color,transform] duration-150 ease-out hover:-translate-y-0.5',
          isActive ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-muted',
        )}
      >
        <div
          className="h-[74px] p-2.5 font-mono text-[10px] leading-[1.55]"
          style={{ background: colors.background }}
        >
          <div className="mb-1.5 flex gap-1">
            {[colors.accent, colors.warning, colors.danger].map((c) => (
              <span key={c} className="size-1.5 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div>
            <span style={{ color: code.keyword }}>const</span>{' '}
            <span style={{ color: colors.text }}>doc</span>{' '}
            <span style={{ color: colors.muted ?? colors.text }}>=</span>{' '}
            <span style={{ color: code.function }}>sync</span>
            <span style={{ color: colors.text }}>(</span>
            <span style={{ color: code.string }}>'room'</span>
            <span style={{ color: colors.text }}>)</span>
          </div>
          <div style={{ color: code.comment }}>// merged {''}</div>
        </div>
        <div className="flex items-center gap-2 border-t border-line-soft bg-surface-soft px-2.5 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] text-fg">{theme.name}</span>
            <span className="block truncate text-[11px] text-faint">
              {theme.kind === 'dark' ? 'Dark' : 'Light'} · {theme.author}
            </span>
          </span>
          {isActive && <Check size={14} className="shrink-0 text-accent" />}
        </div>
      </button>
      {onRemove && (
        <IconButton
          label={`Remove ${theme.name}`}
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 size-6 bg-surface/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 size={12} />
        </IconButton>
      )}
    </div>
  )
}

function ActionButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-chrome)] border border-line px-3 text-[12.5px] text-muted transition-colors duration-150 hover:border-muted hover:text-fg"
    >
      {icon}
      {children}
    </button>
  )
}
