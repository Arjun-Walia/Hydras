/** Title + one-line description at the top of each settings section. */
import type { ReactNode } from 'react'
import { Eyebrow } from '@hydras/ui'

export function SectionHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="mb-6 max-w-[56ch]">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-1.5 text-[13px] text-muted">{children}</p>
    </header>
  )
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <Eyebrow className="mt-6 mb-2.5 block">{children}</Eyebrow>
}
