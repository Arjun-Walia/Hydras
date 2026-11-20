/**
 * Workspace layout: four presets drawn as mini wireframes, plus the individual switches.
 * Changing a switch by hand turns the preset into "Your own".
 */
import { Toggle, cn } from '@hydras/ui'
import { LAYOUT_PRESETS, presetOf, type LayoutPreset } from '../../app/settings'
import { useSettingsStore } from '../../app/settings-store'
import { SectionHeader, SubHeading } from './SectionHeader'

export function LayoutSection() {
  const layout = useSettingsStore((s) => s.layout)
  const applyPreset = useSettingsStore((s) => s.applyPreset)
  const setLayout = useSettingsStore((s) => s.setLayout)
  const current = presetOf(layout)

  return (
    <>
      <SectionHeader title="Workspace layout">
        Pick a starting arrangement. Panels stay resizable; Ctrl B and Ctrl I toggle them anywhere.
      </SectionHeader>

      <div className="grid grid-cols-2 gap-2.5">
        {LAYOUT_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isActive={preset.id === current}
            onSelect={() => applyPreset(preset.id)}
          />
        ))}
      </div>
      {current === 'custom' && (
        <p className="mt-2 text-[12px] text-faint">Using your own layout.</p>
      )}

      <SubHeading>Panels</SubHeading>
      <div className="divide-y divide-line-soft">
        <Toggle
          label="Files panel"
          description="File tree and Trash on the left."
          checked={layout.showFiles}
          onChange={(showFiles) => setLayout({ showFiles })}
        />
        <Toggle
          label="Sync inspector"
          description="Connection, state vector, undo stack and the update log."
          checked={layout.showInspector}
          onChange={(showInspector) => setLayout({ showInspector })}
        />
        <Toggle
          label="Compact rows"
          description="Tighter file tree and tabs for small screens."
          checked={layout.compactRows}
          onChange={(compactRows) => setLayout({ compactRows })}
        />
      </div>
    </>
  )
}

type CardProps = { preset: LayoutPreset; isActive: boolean; onSelect: () => void }

function PresetCard({ preset, isActive, onSelect }: CardProps) {
  const { showFiles, showInspector } = preset.layout
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={cn(
        'flex gap-3.5 rounded-[8px] border p-3 text-left transition-colors duration-150',
        isActive ? 'border-accent bg-accent-soft' : 'border-line hover:border-muted',
      )}
    >
      <span
        className="flex h-[54px] w-[78px] shrink-0 gap-[3px] rounded-[5px] border border-line bg-bg p-[3px]"
        aria-hidden="true"
      >
        {showFiles && <span className="w-[16px] rounded-[2px] bg-line" />}
        <span className="flex flex-1 flex-col gap-[3px] rounded-[2px] bg-surface-raised p-[4px]">
          {[70, 90, 55, 80].map((w) => (
            <span key={w} className="h-[2px] rounded-full bg-faint/60" style={{ width: `${w}%` }} />
          ))}
        </span>
        {showInspector && <span className="w-[18px] rounded-[2px] bg-accent/40" />}
      </span>
      <span>
        <span className="block text-[13px] font-medium text-fg">{preset.name}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted">
          {preset.description}
        </span>
      </span>
    </button>
  )
}
