/**
 * The reference's "How it works": one bordered strip, three columns, each with a
 * numbered badge, a small product visual, a title and a line of text.
 */
import { motion } from 'motion/react'
import { Check, GitMerge, Monitor, Terminal, WifiOff } from 'lucide-react'
import { FACES, Logo, logo, reveal } from './shared'

const panel =
  'w-full rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]'

function StartVisual() {
  return (
    <div className={panel}>
      <div className="flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 font-mono text-[11px] text-neutral-100">
        <Terminal className="size-3.5 text-neutral-400" />
        pnpm install &amp;&amp; pnpm dev
      </div>
      <pre className="mt-3 overflow-hidden rounded-lg bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed text-neutral-700">
        {`sync  ws://localhost:1234
web   http://localhost:5173
room  /r/hackathon`}
      </pre>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>with</span>
        <span className="flex size-7 items-center justify-center rounded-full border border-black/[0.06] bg-white">
          <Logo src={logo('pnpm.svg')} alt="pnpm" className="size-4" />
        </span>
        <span>or the</span>
        <span className="flex size-7 items-center justify-center rounded-full border border-black/[0.06] bg-white">
          <Monitor className="size-3.5" />
        </span>
        <span>Windows app</span>
      </div>
    </div>
  )
}

function ShareVisual() {
  return (
    <div className={panel}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">hackathon</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
          Live
        </span>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        {[
          ['Ana', 'room.ts'],
          ['Ravi', 'room.ts'],
          ['Mei', 'offline · 7 pending'],
        ].map(([n, f], i) => (
          <div
            key={n}
            className={`flex justify-between rounded-lg border px-3 py-2 ${i === 2 ? 'border-indigo-300/60 bg-indigo-50' : 'border-black/[0.05] bg-neutral-50'}`}
          >
            <span className="font-medium">{n}</span>
            <span className="text-neutral-500">{f}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-black/[0.06] px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5">
          <WifiOff className="size-3.5" /> Go offline
        </span>
        <span className="flex h-4 w-7 items-center justify-end rounded-full bg-indigo-500 px-0.5">
          <span className="size-3 rounded-full bg-white" />
        </span>
      </div>
    </div>
  )
}

function MergeVisual() {
  const people = [
    { n: 'Ana', s: FACES[0]! },
    { n: 'Ravi', s: FACES[2]! },
    { n: 'Mei', s: FACES[1]! },
  ]
  return (
    <div className={panel}>
      <div className="flex justify-center gap-2.5">
        {people.map((b, i) => (
          <motion.div
            key={b.n}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-1"
          >
            <span className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-black/[0.07] bg-white shadow-xs">
              <img
                src={b.s}
                alt=""
                className="size-full object-cover object-top"
                draggable={false}
              />
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">{b.n}</span>
          </motion.div>
        ))}
      </div>
      <div className="mx-auto my-3 h-4 w-px bg-gradient-to-b from-neutral-300 to-indigo-400" />
      <div className="flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">
        <GitMerge className="size-3.5" /> Merge on reconnect
      </div>
      <ul className="mt-3 space-y-1.5 text-[11px] text-neutral-600">
        {[
          'Sends only what is missing',
          'Replayed updates are no-ops',
          'Undo reverts only yours',
        ].map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <Check className="size-3 text-emerald-600" /> {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

const STEPS = [
  {
    n: 1,
    title: 'Open a room',
    text: 'Start the server and the app with one command, or install the Windows app. Every room has its own link.',
    visual: <StartVisual />,
  },
  {
    n: 2,
    title: 'Share the link and edit',
    text: 'Teammates join from the link and see each other’s cursors live. Anyone can drop offline at any time.',
    visual: <ShareVisual />,
  },
  {
    n: 3,
    title: 'Reconnect and merge',
    text: 'Offline edits sync the moment the network returns. Nothing is overwritten and nobody’s undo is touched.',
    visual: <MergeVisual />,
  },
]

export function Steps() {
  return (
    <section id="how" className="w-full scroll-mt-4 bg-white px-4 pb-24 select-none md:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
          How Hydras works
        </h2>
        <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
          Understand it in 3 simple steps, from an empty room to a merged offline edit.
        </p>

        <div className="mt-12 grid divide-black/[0.07] overflow-hidden rounded-3xl border border-black/[0.07] bg-neutral-50/60 max-md:divide-y md:grid-cols-3 md:divide-x">
          {STEPS.map((s, i) => (
            <motion.div key={s.n} {...reveal(i)} className="relative flex flex-col p-6 md:p-7">
              <span className="flex size-6 items-center justify-center rounded-full border border-black/[0.1] bg-white text-xs font-semibold shadow-2xs">
                {s.n}
              </span>
              <div className="flex flex-1 items-center py-6">{s.visual}</div>
              <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
