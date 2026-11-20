/**
 * Section 1 of the reference: heading row, then a notched photo frame with an
 * auto-advancing tab carousel and a glass card per tab. Ported 1:1; cards describe
 * Hydras' real behavior (live editing, offline queue, merge + per-user undo).
 */
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, FileCode2, GitMerge, HardDrive, Play, Undo2, Users, WifiOff } from 'lucide-react'
import { FACES } from './shared'

const INTERVAL_MS = 6000

type Slide = {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  image: string
  card: ReactNode
}

const glass =
  'w-[min(88%,360px)] rounded-2xl border border-white/60 bg-white/80 p-5 text-neutral-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] backdrop-blur-xl'

const EditCard = () => (
  <div className={glass}>
    <div className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-xs text-neutral-500">
      <FileCode2 className="size-3.5" /> room.ts
    </div>
    <div className="mt-3 space-y-2">
      {[
        { n: 'Ana', d: 'Typing on line 12', f: FACES[0], c: 'bg-amber-100', s: 'editing' },
        { n: 'Ravi', d: 'Selecting lines 4–9', f: FACES[2], c: 'bg-sky-100', s: 'editing' },
        { n: 'Mei', d: 'Reading README.md', f: FACES[1], c: 'bg-rose-100', s: 'viewing' },
      ].map((p, i) => (
        <div
          key={p.n}
          className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
            i === 0 ? 'border-indigo-300/60 bg-indigo-50' : 'border-black/[0.05] bg-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className={`size-8 overflow-hidden rounded-full ${p.c}`}>
              <img
                src={p.f}
                alt=""
                className="size-full object-cover object-top"
                draggable={false}
              />
            </span>
            <div>
              <p className="text-sm font-semibold">{p.n}</p>
              <p className="text-[11px] text-neutral-500">{p.d}</p>
            </div>
          </div>
          <span className="text-[10px] text-neutral-500">{p.s}</span>
        </div>
      ))}
    </div>
  </div>
)

const OfflineCard = () => (
  <div className={glass}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold">room.ts</p>
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        Offline
      </span>
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-xs">
      <HardDrive className="size-4 text-emerald-600" />
      <span>7 changes saved in this browser</span>
    </div>
    <div className="mt-4">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full w-[62%] rounded-full bg-indigo-500" />
      </div>
      <p className="mt-1.5 text-[11px] text-neutral-500">Waiting for the network…</p>
    </div>
    <ul className="mt-4 space-y-2 text-xs">
      {['Edits apply locally', 'Saved to IndexedDB', 'Survives a reload'].map((t) => (
        <li key={t} className="flex items-center gap-2">
          <Check className="size-3.5 text-emerald-600" /> {t}
        </li>
      ))}
      <li className="flex items-center gap-2 text-indigo-600">
        <Play className="size-3.5" /> Merge on reconnect
      </li>
    </ul>
    <p className="mt-4 border-t border-black/[0.06] pt-3 text-[11px] text-neutral-500">
      Offline is a normal state, not an error.
    </p>
  </div>
)

const MergeCard = () => (
  <div className={glass}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold">Back online</p>
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
        Merged 7 changes
      </span>
    </div>
    <p className="mt-3 flex items-baseline gap-1">
      <span className="text-3xl font-bold tracking-tight">0</span>
      <span className="text-xs text-neutral-500">characters lost</span>
    </p>
    <div className="mt-3 flex h-16 items-end gap-1.5">
      {[30, 42, 36, 55, 48, 70, 88].map((h, i) => (
        <div key={i} style={{ height: `${h}%` }} className="flex-1 rounded-t bg-indigo-400/70" />
      ))}
    </div>
    <div className="mt-4 space-y-2 text-xs">
      <div className="flex justify-between rounded-lg border border-black/[0.05] bg-white px-3 py-2">
        <span className="flex items-center gap-1.5">
          <Undo2 className="size-3.5" /> Ctrl Z
        </span>
        <span className="font-medium">only your edits</span>
      </div>
      <div className="flex justify-between rounded-lg border border-black/[0.05] bg-white px-3 py-2">
        <span>Ravi&apos;s edits</span>
        <span className="font-medium">kept</span>
      </div>
    </div>
  </div>
)

const SLIDES: Slide[] = [
  {
    id: 'edit',
    label: 'Edit Together',
    icon: Users,
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=80',
    card: <EditCard />,
  },
  {
    id: 'offline',
    label: 'Keep Typing Offline',
    icon: WifiOff,
    image:
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2000&q=80',
    card: <OfflineCard />,
  },
  {
    id: 'merge',
    label: 'Merge & Undo',
    icon: GitMerge,
    image:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2000&q=80',
    card: <MergeCard />,
  },
]

export function Showcase() {
  const [active, setActive] = useState(0)

  // Auto-advance every 6s; restarts whenever the user picks a tab.
  useEffect(() => {
    const t = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), INTERVAL_MS)
    return () => clearInterval(t)
  }, [active])

  const slide = SLIDES[active]!

  return (
    <section
      id="features"
      className="relative w-full scroll-mt-4 bg-white px-4 py-20 select-none md:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
            Your room is ready.
            <br />
            Now bring your team.
          </h2>
          <p className="text-base text-muted-foreground md:max-w-md md:justify-self-end md:text-lg">
            Share one link and edit the same files live, even when the connection gives up halfway
            through.
          </p>
        </div>

        <div className="relative mt-12 aspect-[4/5] w-full sm:aspect-[16/10] md:aspect-[1392/794]">
          <div className="absolute inset-0 overflow-hidden rounded-3xl bg-neutral-200 [clip-path:polygon(0_0,92%_0,100%_14%,100%_100%,29.5%_100%,21%_87%,21%_59%,0_59%)] max-md:[clip-path:polygon(0_0,90%_0,100%_8%,100%_100%,0_100%)]">
            <AnimatePresence mode="sync">
              <motion.img
                key={slide.id}
                src={slide.image}
                alt=""
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/70 via-white/10 to-transparent" />

            <div className="absolute inset-0 flex items-center justify-center pb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="flex w-full justify-center"
                >
                  {slide.card}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 max-md:rounded-2xl max-md:bg-white/85 max-md:p-2 max-md:backdrop-blur md:bottom-[2%] md:left-[2.2%] md:gap-2">
            {SLIDES.map((s, i) => {
              const Icon = s.icon
              const on = i === active
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`group flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors md:text-lg ${
                    on
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4 md:size-5" />
                  <span className="relative">
                    {s.label}
                    {on && (
                      <motion.span
                        key={`bar-${active}`}
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: INTERVAL_MS / 1000, ease: 'linear' }}
                        className="absolute -bottom-0.5 left-0 h-px bg-foreground/60"
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
