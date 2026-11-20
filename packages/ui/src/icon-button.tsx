/** Square ghost button for toolbar icons. Always needs an accessible label. */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  children: ReactNode
}

export function IconButton({ label, active, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-grid size-7 place-items-center rounded-[var(--radius-chrome)] text-[var(--muted)] transition-colors duration-150 ease-out',
        'hover:bg-[var(--surface-raised)] hover:text-[var(--fg)] active:scale-[0.96]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-[var(--accent-soft)] text-[var(--accent)]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
