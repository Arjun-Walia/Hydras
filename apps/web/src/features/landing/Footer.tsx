/**
 * The reference's footer: landscape photo fading up into white, brand column with CTA,
 * three link columns, and a giant full-width wordmark.
 */
import { ArrowRight } from 'lucide-react'
import { Wordmark } from './shared'
import { openNewRoom } from './open-room'

type FooterLink = { label: string; href: string }

const COLS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how' },
      { label: 'Download', href: '#download' },
      { label: 'Open a room', href: '#home' },
    ],
  },
  {
    title: 'Under the hood',
    links: [
      { label: 'Yjs CRDT', href: 'https://yjs.dev' },
      { label: 'CodeMirror 6', href: 'https://codemirror.net' },
      { label: 'Hocuspocus', href: 'https://tiptap.dev/docs/hocuspocus' },
      { label: 'Tauri', href: 'https://tauri.app' },
    ],
  },
  {
    title: 'Use cases',
    links: [
      { label: 'Hackathons', href: '#download' },
      { label: 'Pair programming', href: '#features' },
      { label: 'Offline workshops', href: '#download' },
      { label: 'Teaching', href: '#features' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-white select-none">
      <img
        src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=2400&q=80"
        alt=""
        draggable={false}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover object-bottom"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white/60 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6 pt-10 md:px-8">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark className="h-9" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-600">
              The offline-first multiplayer code editor. Edit together, keep working through bad
              Wi-Fi, and merge cleanly on reconnect.
            </p>
            <button
              type="button"
              onClick={openNewRoom}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
            >
              Open a room today <ArrowRight className="size-4" />
            </button>
            <p className="mt-4 text-xs text-neutral-600">© 2026 Hydras · Built for bad Wi-Fi</p>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <h4 className="text-base font-semibold text-foreground">{c.title}</h4>
              <ul className="mt-3 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      {...(l.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="text-sm text-neutral-600 transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <svg
        viewBox="0 0 1000 190"
        className="relative mt-10 block w-full"
        aria-label="Hydras"
        role="img"
      >
        <text
          x="0"
          y="212"
          textLength="1000"
          lengthAdjust="spacingAndGlyphs"
          fontSize="290"
          fontWeight="800"
          fill="rgba(255,255,255,0.78)"
          fontFamily="'Inter Variable', Inter, system-ui, sans-serif"
        >
          Hydras
        </text>
      </svg>
    </footer>
  )
}
