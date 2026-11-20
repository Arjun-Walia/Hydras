/** Keyboard shortcut hint. */
import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-[var(--line)] bg-[var(--surface-soft)] px-1 font-[family-name:var(--font-ui)] text-[10.5px] font-medium text-[var(--muted)]">
      {children}
    </kbd>
  )
}
