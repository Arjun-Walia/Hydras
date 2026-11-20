/** Connection-style dot. `pulse` draws a soft ring for in-progress states. */
import { cn } from './cn'

export type StatusTone = 'ok' | 'warn' | 'busy' | 'danger'

const TONE: Record<StatusTone, string> = {
  ok: 'bg-[var(--accent)]',
  warn: 'bg-[var(--warn)]',
  busy: 'bg-[var(--muted)]',
  danger: 'bg-[var(--danger)]',
}

export function StatusDot({ tone, pulse = false }: { tone: StatusTone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2 shrink-0">
      {pulse && (
        <span
          className={cn(
            'absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping',
            TONE[tone],
          )}
        />
      )}
      <span className={cn('relative inline-flex size-2 rounded-full', TONE[tone])} />
    </span>
  )
}
