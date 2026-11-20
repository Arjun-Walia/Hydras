/**
 * Section 2 of the reference: a five-card bento (faces, pill grid, floating pills,
 * two-row marquee, and the animated "gateway" flow). Layout and motion are 1:1;
 * content is Hydras' real stack and behavior.
 */
import type { ComponentType } from 'react'
import { motion } from 'motion/react'
import { Braces, Database, Globe, HardDrive, Monitor, Radio, Server } from 'lucide-react'
import { FACES, Logo, logo, reveal } from './shared'

const card =
  'relative overflow-hidden rounded-3xl border border-black/[0.07] bg-neutral-50/70 p-6 flex flex-col'

function Title({ tag, title, text }: { tag: string; title: string; text: string }) {
  return (
    <div>
      <span className="text-[11px] font-semibold tracking-wider text-indigo-500 uppercase">
        {tag}
      </span>
      <h3 className="mt-1.5 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  )
}

type IconType = ComponentType<{ className?: string }>
type Chip = { n: string; s?: string; icon?: IconType }

function ChipIcon({ chip, className }: { chip: Chip; className: string }) {
  if (chip.s) return <Logo src={chip.s} alt="" className={className} />
  const Icon = chip.icon ?? Braces
  return <Icon className={`${className} text-neutral-700`} />
}

/* ---------- 1. Team ---------- */
const FACE_BG = ['bg-amber-100', 'bg-sky-100', 'bg-rose-100']

function TeamBox() {
  return (
    <motion.div {...reveal(0)} className={card}>
      <Title
        tag="Teams"
        title="For your whole team"
        text="Four or more people in one file, each with a named, colored cursor that stays put as others type."
      />
      <div className="mt-auto flex items-center pt-6">
        {FACES.map((f, i) => (
          <motion.div
            key={f}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
            className={`-ml-3 size-14 overflow-hidden rounded-full border-2 border-white shadow-sm first:ml-0 ${FACE_BG[i]}`}
          >
            <img src={f} alt="" className="size-full object-cover object-top" draggable={false} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ---------- 2. Languages ---------- */
const LANGUAGES: Chip[] = [
  { n: 'TypeScript', s: logo('typescript.png') },
  { n: 'Python', s: logo('python.png') },
  { n: 'Markdown', s: logo('doc.svg') },
  { n: 'JSON', icon: Braces },
]

function LanguagesBox() {
  return (
    <motion.div {...reveal(1)} className={card}>
      <Title
        tag="Editor"
        title="Highlighting for the files you ship"
        text="CodeMirror 6 with syntax for JavaScript, TypeScript, Python, JSON and Markdown."
      />
      <div className="mt-auto grid grid-cols-2 gap-2.5 pt-6">
        {LANGUAGES.map((t, i) => (
          <motion.div
            key={t.n}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.1 }}
            whileHover={{ y: -3 }}
            className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs font-medium shadow-2xs"
          >
            <ChipIcon chip={t} className="size-5" />
            {t.n}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ---------- 3. Self-host ---------- */
const RUNTIME: Chip[] = [
  { n: 'pnpm', s: logo('pnpm.svg') },
  { n: 'Node 22+', icon: Server },
  { n: 'SQLite', icon: Database },
  { n: 'Windows app', icon: Monitor },
]

function SelfHostBox() {
  return (
    <motion.div {...reveal(2)} className={card}>
      <Title
        tag="Self-host"
        title="Run it on your own machine"
        text="One pnpm command starts the sync server and the app. Rooms persist in SQLite."
      />
      <div className="mt-auto flex flex-wrap gap-2.5 pt-6">
        {RUNTIME.map((t, i) => (
          <motion.div
            key={t.n}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
            className="flex items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3.5 py-2 text-xs font-medium shadow-2xs"
          >
            <ChipIcon chip={t} className="size-4" />
            {t.n}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ---------- 4. Open-source marquee ---------- */
const STACK_A = ['Yjs', 'CodeMirror 6', 'Hocuspocus', 'y-indexeddb', 'SQLite']
const STACK_B = ['React 19', 'Vite', 'Tailwind CSS', 'Tauri 2', 'fast-check']

function Monogram({ name }: { name: string }) {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
      {name.slice(0, 1)}
    </span>
  )
}

function MarqueeRow({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const loop = [...items, ...items, ...items, ...items]
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
      <div className={`flex w-max gap-2.5 ${reverse ? 'lp-marquee-rev' : 'lp-marquee'}`}>
        {loop.map((n, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-full border border-black/[0.06] bg-white px-5 py-3 text-base font-medium whitespace-nowrap shadow-2xs"
          >
            <Monogram name={n} />
            {n}
          </div>
        ))}
      </div>
    </div>
  )
}

function StackBox() {
  return (
    <motion.div {...reveal(3)} className={card}>
      <Title
        tag="Open source"
        title="Built on proven foundations"
        text="Yjs does the merging. Hydras adds the file policy, the inspector and the UX, in strict TypeScript."
      />
      <div className="mt-6 flex items-center gap-2">
        <Logo src={logo('typescript.png')} alt="TypeScript" className="size-5 rounded" />
      </div>
      <div className="mt-auto space-y-2.5 pt-5">
        <MarqueeRow items={STACK_A} />
        <MarqueeRow items={STACK_B} reverse />
      </div>
    </motion.div>
  )
}

/* ---------- 5. One room ---------- */
type FlowNode = { n: string; face?: string; icon?: IconType }
const CLIENTS: FlowNode[] = [
  { n: 'Ana · browser', face: FACES[0] },
  { n: 'Ravi · offline', face: FACES[2] },
  { n: 'Mei · desktop', face: FACES[1] },
]
const STORES: FlowNode[] = [
  { n: 'IndexedDB', icon: HardDrive },
  { n: 'SQLite', icon: Database },
  { n: 'Awareness', icon: Radio },
]
const Y = [20, 50, 80]

function Pill({ n, face, icon: Icon }: FlowNode) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-black/[0.07] bg-white px-3.5 py-2 text-xs font-semibold shadow-xs md:text-sm">
      {face ? (
        <img
          src={face}
          alt=""
          className="size-5 rounded-full object-cover object-top"
          draggable={false}
        />
      ) : Icon ? (
        <Icon className="size-4" />
      ) : null}
      {n}
    </div>
  )
}

const curve = (side: 'l' | 'r', y: number) =>
  side === 'l' ? `M 24 ${y} C 36 ${y}, 38 50, 44 50` : `M 56 50 C 62 50, 64 ${y}, 76 ${y}`

function RoomBox() {
  return (
    <motion.div {...reveal(4)} className={`${card} md:col-span-2`}>
      <Title
        tag="One room"
        title="Every client, one document"
        text="Browsers, the desktop app and offline laptops all sync through the room. The server keeps it in SQLite; each client keeps a full copy locally."
      />
      <div className="relative mt-6 h-52 w-full md:h-56">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {(['l', 'r'] as const).flatMap((side) =>
            Y.map((y, i) => (
              <g key={side + i}>
                <path
                  d={curve(side, y)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  className="text-neutral-300"
                />
                <path
                  d={curve(side, y)}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="lp-flow"
                  style={{ animationDelay: `${i * 0.5}s` }}
                />
              </g>
            )),
          )}
        </svg>

        {CLIENTS.map((b, i) => (
          <div key={b.n} className="absolute left-0 -translate-y-1/2" style={{ top: `${Y[i]}%` }}>
            <Pill {...b} />
          </div>
        ))}

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white shadow-md md:text-sm"
          >
            <Globe className="size-4" />
            Hydras <span className="font-mono text-neutral-400">/r/room</span>
          </motion.div>
        </div>

        {STORES.map((b, i) => (
          <div key={b.n} className="absolute right-0 -translate-y-1/2" style={{ top: `${Y[i]}%` }}>
            <Pill {...b} />
          </div>
        ))}

        <span className="absolute bottom-0 left-0 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Clients
        </span>
        <span className="absolute right-0 bottom-0 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Storage
        </span>
      </div>
    </motion.div>
  )
}

export function Bento() {
  return (
    <section className="w-full bg-white px-4 pb-16 select-none md:px-8">
      <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">
        <TeamBox />
        <LanguagesBox />
        <SelfHostBox />
        <StackBox />
        <RoomBox />
      </div>
    </section>
  )
}
