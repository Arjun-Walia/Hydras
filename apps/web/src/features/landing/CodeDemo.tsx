/**
 * The reference's code section: copy on the left, a dark tabbed code card on the right.
 * Both tabs are real Hydras code: the @hydras/sync client API and apps/server.
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Copy } from 'lucide-react'
import { logo } from './shared'
import { openNewRoom } from './open-room'

const FILES = [
  {
    id: 'client',
    name: 'room.ts',
    icon: logo('typescript.png'),
    code: `import { createRoom } from '@hydras/sync'

const room = createRoom({
  slug: 'hackathon',
  serverUrl: 'ws://localhost:1234',
  user: { id, name: 'Ana', color, colorLight },
})

await room.ready // IndexedDB loaded: works offline

const id = room.createFile('notes.md', '# Plan')
const binding = room.bindFile(id) // Y.Text + per-user undo

room.connection.subscribe(() => {
  const { status, pendingChanges } = room.connection.get()
  console.log(status, pendingChanges)
})

room.goOffline() // edits keep applying locally
room.goOnline() // merges on reconnect`,
  },
  {
    id: 'server',
    name: 'server.ts',
    icon: logo('typescript.png'),
    code: `import { Server } from '@hocuspocus/server'
import { SQLite } from '@hocuspocus/extension-sqlite'

const server = new Server({
  name: 'hydras-sync',
  port: 1234,
  extensions: [new SQLite({ database: 'data/hydras.sqlite' })],

  async onAuthenticate({ documentName }) {
    // The room link is the access control. Real auth goes here.
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(documentName)) {
      throw new Error('Invalid room name')
    }
  },
})

await server.listen()`,
  },
]

const KEYWORDS = new Set([
  'from',
  'import',
  'const',
  'await',
  'async',
  'new',
  'export',
  'default',
  'if',
  'throw',
  'return',
])

type Tok = { t: string; c?: string }

function tokenize(line: string): Tok[] {
  const comment = line.indexOf('//')
  if (comment >= 0 && !line.slice(0, comment).includes("'")) {
    return [...tokenize(line.slice(0, comment)), { t: line.slice(comment), c: 'text-neutral-500' }]
  }
  const out: Tok[] = []
  const re =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\^[^/]*\/)|(\b\d+\b)|([A-Za-z_][A-Za-z0-9_]*)(?=\()|([A-Za-z_][A-Za-z0-9_]*)|(\s+|.)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    if (m[1]) out.push({ t: m[1], c: 'text-emerald-300' })
    else if (m[2]) out.push({ t: m[2], c: 'text-amber-300' })
    else if (m[3]) out.push({ t: m[3], c: 'text-orange-300' })
    else if (m[4]) {
      const w = m[4]
      if (KEYWORDS.has(w)) out.push({ t: w, c: 'text-sky-300' })
      else if (/^[A-Z]/.test(w)) out.push({ t: w, c: 'text-violet-300' })
      else out.push({ t: w })
    } else out.push({ t: m[5] ?? '' })
  }
  return out
}

export function CodeDemo() {
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const file = FILES[active]!
  const lines = file.code.split('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (permissions or insecure context): nothing to copy into.
    }
  }

  return (
    <section className="w-full bg-white px-4 pb-24 md:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
            A small API over a proven sync engine
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            Call{' '}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.9em] text-foreground">
              createRoom()
            </code>{' '}
            and you get a document that loads from the browser first, syncs through Hocuspocus, and
            tracks connection, files and per-user undo. The server is twenty lines of config.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {['ws://localhost:1234', '/r/<room>', 'IndexedDB + SQLite'].map((e) => (
              <span
                key={e}
                className="rounded-full border border-black/[0.08] bg-neutral-50 px-3 py-1 font-mono text-xs text-neutral-700"
              >
                {e}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={openNewRoom}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
          >
            Try it in a room
            <ArrowRight className="size-4" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e10] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
            </div>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copy code"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-white"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="mt-3 flex gap-1">
            {FILES.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActive(i)}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  i === active
                    ? 'border border-white/10 bg-white/[0.06] text-white'
                    : 'border border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <img src={f.icon} alt="" className="size-4 rounded-sm object-contain" />
                {f.name}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-[420px] overflow-x-auto px-2 pb-4">
            <AnimatePresence mode="wait">
              <motion.pre
                key={file.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="font-mono text-[13px] leading-[1.75] text-neutral-100"
              >
                {lines.map((l, i) => (
                  <div key={i} className="flex">
                    <span className="w-7 shrink-0 pr-3 text-right text-neutral-600 select-none">
                      {i + 1}
                    </span>
                    <code className="whitespace-pre">
                      {tokenize(l).map((tk, j) => (
                        <span key={j} className={tk.c}>
                          {tk.t}
                        </span>
                      ))}
                    </code>
                  </div>
                ))}
              </motion.pre>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
