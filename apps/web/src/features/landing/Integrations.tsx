/**
 * The reference's integrations strip: heading, a centered icon, and two opposing logo
 * marquees. Logos are languages and package managers whose files Hydras edits; the copy
 * makes no claim of tool integrations.
 */
import { motion } from 'motion/react'
import { Code2 } from 'lucide-react'
import { logo } from './shared'

type L = { n: string; s: string }

const ROW_A: L[] = [
  { n: 'TypeScript', s: logo('typescript.png') },
  { n: 'Python', s: logo('python.png') },
  { n: 'npm', s: logo('npm.svg') },
  { n: 'pnpm', s: logo('pnpm.svg') },
  { n: 'Bun', s: logo('bun.svg') },
  { n: 'Markdown', s: logo('doc.svg') },
  { n: 'Poetry', s: logo('poetry.svg') },
  { n: 'Pydantic', s: logo('pydantic.svg') },
]

const ROW_B: L[] = [
  { n: 'pnpm', s: logo('pnpm.svg') },
  { n: 'Pydantic', s: logo('pydantic.svg') },
  { n: 'TypeScript', s: logo('typescript.png') },
  { n: 'Bun', s: logo('bun.svg') },
  { n: 'Python', s: logo('python.png') },
  { n: 'Poetry', s: logo('poetry.svg') },
  { n: 'Markdown', s: logo('doc.svg') },
  { n: 'npm', s: logo('npm.svg') },
]

function Row({ items, reverse }: { items: L[]; reverse?: boolean }) {
  const loop = [...items, ...items, ...items]
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className={`flex w-max gap-4 py-2 ${reverse ? 'lp-int-rev' : 'lp-int'}`}>
        {loop.map((l, i) => (
          <div
            key={i}
            title={l.n}
            className="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-black/[0.05] bg-white shadow-[0_6px_20px_-8px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-1 md:size-24"
          >
            <img
              src={l.s}
              alt={l.n}
              draggable={false}
              className="size-9 object-contain md:size-11"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Integrations() {
  return (
    <section className="relative w-full overflow-hidden bg-white px-4 pb-24 select-none">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="mx-auto max-w-3xl text-center"
      >
        <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
          Bring the code
          <br />
          you already write
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
          Whatever your language or package manager, it&apos;s plain files in a room, edited
          together.
        </p>
        <div className="mx-auto mt-8 flex size-12 items-center justify-center rounded-2xl border border-black/[0.06] bg-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]">
          <Code2 className="size-5" />
        </div>
      </motion.div>

      <div className="relative mt-10 space-y-3">
        <div className="pointer-events-none absolute top-0 left-1/2 h-6 w-px bg-gradient-to-b from-neutral-300 to-transparent" />
        <Row items={ROW_A} />
        <Row items={ROW_B} reverse />
      </div>
    </section>
  )
}
