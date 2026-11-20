/** Editor preferences: code size (11-18 px), line numbers, line wrapping. Applied live. */
import { MAX_CODE_SIZE, MIN_CODE_SIZE } from '@hydras/editor'
import { Toggle } from '@hydras/ui'
import { useSettingsStore } from '../../app/settings-store'
import { SectionHeader, SubHeading } from './SectionHeader'

export function EditorSection() {
  const editor = useSettingsStore((s) => s.editor)
  const setEditor = useSettingsStore((s) => s.setEditor)

  return (
    <>
      <SectionHeader title="Editor">Changes apply to open files immediately.</SectionHeader>

      <SubHeading>Code size</SubHeading>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={MIN_CODE_SIZE}
          max={MAX_CODE_SIZE}
          step={1}
          value={editor.fontSize}
          onChange={(event) => setEditor({ fontSize: Number(event.target.value) })}
          aria-label="Code size in pixels"
          className="w-64 accent-[var(--accent)]"
        />
        <span className="w-12 text-[13px] text-fg tabular-nums">{editor.fontSize} px</span>
      </div>
      <pre
        className="mt-3 max-w-md overflow-hidden rounded-[var(--radius-chrome)] border border-line-soft bg-bg px-3 py-2.5 font-mono leading-[1.65] text-fg"
        style={{ fontSize: editor.fontSize }}
      >
        <span className="text-[var(--syn-keyword)]">export function</span>{' '}
        <span className="text-[var(--syn-function)]">merge</span>(a, b) {'{'}
        {'\n'}
        {'  '}
        <span className="text-[var(--syn-keyword)]">return</span> a.concat(b)
        {'\n'}
        {'}'}
      </pre>

      <SubHeading>Code</SubHeading>
      <div className="divide-y divide-line-soft">
        <Toggle
          label="Line numbers"
          checked={editor.lineNumbers}
          onChange={(lineNumbers) => setEditor({ lineNumbers })}
        />
        <Toggle
          label="Wrap long lines"
          description="Soft-wrap instead of scrolling sideways."
          checked={editor.wrapLines}
          onChange={(wrapLines) => setEditor({ wrapLines })}
        />
      </div>
    </>
  )
}
