/** Motion, keyboard shortcuts, reset, and the build's version. */
import { Kbd, Toggle } from '@hydras/ui'
import { useSettingsStore } from '../../app/settings-store'
import { SectionHeader, SubHeading } from './SectionHeader'

const SHORTCUTS: [string, string][] = [
  ['Search files and commands', 'Ctrl K'],
  ['Settings', 'Ctrl ,'],
  ['Toggle files panel', 'Ctrl B'],
  ['Toggle sync inspector', 'Ctrl I'],
  ['Undo my last change', 'Ctrl Z'],
  ['Redo', 'Ctrl Y'],
  ['Close a dialog', 'Esc'],
]

export function GeneralSection() {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion)
  const reset = useSettingsStore((s) => s.reset)

  return (
    <>
      <SectionHeader title="General">Motion, shortcuts and this install.</SectionHeader>

      <Toggle
        label="Reduce motion"
        description="Turns off animations. Your system setting is always respected too."
        checked={reduceMotion}
        onChange={setReduceMotion}
      />

      <SubHeading>Keyboard shortcuts</SubHeading>
      <dl className="max-w-md divide-y divide-line-soft">
        {SHORTCUTS.map(([action, keys]) => (
          <div key={action} className="flex items-center justify-between py-2 text-[13px]">
            <dt className="text-muted">{action}</dt>
            <dd>
              <Kbd>{keys}</Kbd>
            </dd>
          </div>
        ))}
      </dl>

      <SubHeading>About</SubHeading>
      <p className="text-[13px] text-muted">
        Hydras {__APP_VERSION__} · Settings are saved on this device.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 h-8 rounded-[var(--radius-chrome)] border border-line px-3 text-[12.5px] text-muted transition-colors hover:border-danger hover:text-danger"
      >
        Reset all settings
      </button>
    </>
  )
}
