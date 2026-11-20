/**
 * The reference's testimonials grid, ported 1:1 in layout. Hydras has no customers to
 * quote yet, so the cards are labeled scenarios describing real behavior, not invented
 * quotes. The blue CTA card is the download target (#download).
 */
import { motion } from 'motion/react'
import { ArrowRight, MonitorDown } from 'lucide-react'
import { FACES } from './shared'
import { openNewRoom } from './open-room'
import { formatSize, useDownloadsManifest } from './use-downloads-manifest'

type Tag = 'Team' | 'Solo'

type Scenario = {
  text: string
  who: string
  setting: string
  tag: Tag
  face: string
  bg: string
}

const ITEMS: Scenario[] = [
  {
    text: 'Four people edit the same file during a hackathon. The venue Wi-Fi drops twice; everyone keeps typing, and the room merges each time it comes back without a single conflict dialog.',
    who: 'Scenario',
    setting: 'Hackathon team of four',
    tag: 'Team',
    face: FACES[0]!,
    bg: 'bg-amber-100',
  },
  {
    text: 'Writing notes on a train with no signal. The file stays editable, survives a reload, and syncs at the next station.',
    who: 'Scenario',
    setting: 'Commuting offline',
    tag: 'Solo',
    face: FACES[1]!,
    bg: 'bg-rose-100',
  },
  {
    text: 'One person deletes a file while another is still editing it offline. On reconnect the file lands in Trash with those offline edits inside, one click from restore.',
    who: 'Scenario',
    setting: 'Delete vs offline edit',
    tag: 'Team',
    face: FACES[2]!,
    bg: 'bg-sky-100',
  },
  {
    text: 'Two people type in the same function at once. Pressing Ctrl Z removes only your own last change and leaves your teammate’s line exactly where it was.',
    who: 'Scenario',
    setting: 'Undo during pairing',
    tag: 'Team',
    face: FACES[1]!,
    bg: 'bg-emerald-100',
  },
  {
    text: 'Run the sync server on one laptop at a workshop with no internet at all. Everyone on the local network points Settings → Sync server at it, joins by link, and the room is saved in SQLite.',
    who: 'Scenario',
    setting: 'Offline workshop on a LAN',
    tag: 'Team',
    face: FACES[0]!,
    bg: 'bg-violet-100',
  },
]

const tagStyle: Record<Tag, string> = {
  Team: 'bg-indigo-50 text-indigo-600',
  Solo: 'bg-emerald-50 text-emerald-600',
}

function Card({ t, i, className = '' }: { t: Scenario; i: number; className?: string }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: i * 0.08, ease: 'easeOut' }}
      className={`flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-neutral-50/70 p-6 ${className}`}
    >
      <div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${tagStyle[t.tag]}`}
        >
          {t.tag}
        </span>
        <p className="mt-4 text-[15px] leading-relaxed text-foreground">{t.text}</p>
      </div>
      <figcaption className="mt-8 flex items-center gap-3">
        <span className={`size-9 overflow-hidden rounded-lg ${t.bg}`}>
          <img
            src={t.face}
            alt=""
            className="size-full object-cover object-top"
            draggable={false}
          />
        </span>
        <span className="leading-tight">
          <span className="block text-xs text-muted-foreground">{t.who}</span>
          <span className="block text-sm font-semibold">{t.setting}</span>
        </span>
      </figcaption>
    </motion.figure>
  )
}

function DownloadCard() {
  const state = useDownloadsManifest()
  const installer =
    state.status === 'ready' ? state.manifest.assets.find((a) => a.kind === 'nsis') : undefined

  return (
    <motion.div
      id="download"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: 0.3, ease: 'easeOut' }}
      className="relative flex scroll-mt-6 flex-col justify-between overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1e40af_0%,#3b82f6_35%,#93c5fd_65%,#ffffff_100%)] p-7 text-white md:row-span-2"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="relative">
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase backdrop-blur">
          Get started
        </span>
        <h3 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight">
          Try it yourself.
        </h3>
        <p className="mt-3 text-base leading-relaxed text-white/90">
          Open a room in the browser, or install Hydras for Windows and keep your rooms in a native
          window.
        </p>
      </div>
      <div className="relative mt-10 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={openNewRoom}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-lg transition-transform hover:scale-[1.03]"
        >
          Open a room <ArrowRight className="size-4" />
        </button>
        {installer ? (
          <a
            href={`/downloads/${installer.file}`}
            download
            className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-900/85 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03]"
          >
            <MonitorDown className="size-4" /> Windows · {formatSize(installer.bytes)}
          </a>
        ) : (
          <span className="text-xs text-neutral-700">
            {state.status === 'loading'
              ? 'Checking for the Windows installer…'
              : 'Windows installer: build it with pnpm release:desktop'}
          </span>
        )}
      </div>
    </motion.div>
  )
}

export function Scenarios() {
  return (
    <section className="w-full bg-white px-4 pb-28 select-none md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="inline-block rounded-full border border-black/[0.08] bg-neutral-50 px-3 py-1 text-[11px] text-muted-foreground">
            Use cases
          </span>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
            Made for the moments
            <br />
            the network lets you down
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Card t={ITEMS[0]!} i={0} className="md:row-span-2 md:min-h-[360px]" />
          <Card t={ITEMS[1]!} i={1} />
          <Card t={ITEMS[3]!} i={2} />
          <Card t={ITEMS[2]!} i={3} className="md:col-span-1" />
          <DownloadCard />
          <Card t={ITEMS[4]!} i={4} className="md:col-span-2" />
        </div>
      </div>
    </section>
  )
}
