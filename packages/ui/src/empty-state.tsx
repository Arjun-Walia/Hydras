/** Empty state in the editorial serif voice: "Nothing here *yet*". */
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-[family-name:var(--font-serif)] text-[28px] leading-none text-[var(--fg)]">
        {title}
      </p>
      {hint && <p className="max-w-[34ch] text-[13px] text-[var(--muted)]">{hint}</p>}
      {action}
    </div>
  )
}
