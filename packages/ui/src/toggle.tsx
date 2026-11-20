/** Accessible on/off switch with a label and optional description. */
import { useId } from 'react'
import { cn } from './cn'

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ label, description, checked, onChange }: ToggleProps) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-6 py-2.5">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[13px] text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[12px] text-faint">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-150 ease-out',
          checked ? 'border-accent bg-accent' : 'border-line bg-surface-soft',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] left-[2px] size-3 rounded-full transition-transform duration-150 ease-out',
            checked ? 'translate-x-[14px] bg-[var(--accent-ink)]' : 'bg-muted',
          )}
        />
      </button>
    </div>
  )
}
