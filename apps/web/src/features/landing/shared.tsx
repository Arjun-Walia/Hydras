/**
 * Small pieces shared by the landing sections, ported from the Agentic-marketplace
 * client (MIT, see /landing/LICENSE-agentic-marketplace.txt).
 */
import type { ReactNode } from 'react'

export const ASSET = '/landing'
export const FACES = [
  `${ASSET}/faces/face-1.png`,
  `${ASSET}/faces/face-2.webp`,
  `${ASSET}/faces/face-3.png`,
]
export const logo = (file: string) => `${ASSET}/logos/${file}`

export const reveal = (i: number) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, delay: i * 0.08, ease: 'easeOut' as const },
})

export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: 'easeOut' as const },
}

type LogoProps = { src: string; alt: string; className?: string; dark?: boolean }

export function Logo({ src, alt, className = 'size-6', dark }: LogoProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-contain ${dark ? 'brightness-0' : ''}`}
      draggable={false}
    />
  )
}

/** Hydras logo + wordmark in the reference's logo slot (their logo is their brand, not ours). */
export function Wordmark({ className = 'h-10' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/logo.svg" alt="" aria-hidden="true" className="h-[90%] w-auto" draggable={false} />
      <span className="text-[1.45em] leading-none font-semibold tracking-[-0.04em] text-[#252b31]">
        hydras
      </span>
    </span>
  )
}

export function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-full border border-black/[0.06] bg-white">
      {children}
    </span>
  )
}
