/** 11px uppercase section label with wide tracking (Opcodex pattern). */
import type { ReactNode } from 'react'
import { cn } from './cn'

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'text-[11px] font-medium tracking-[0.12em] text-[var(--faint)] uppercase select-none',
        className,
      )}
    >
      {children}
    </span>
  )
}
