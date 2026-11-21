/**
 * Hero: background video, nav, badge, display headline, subhead, CTAs and the
 * glass-framed product preview. Ported 1:1 from the reference Hero.
 *
 * `data-build` marks the pieces the cursor crew assembles (see cursor-crew/). When the
 * crew is running it owns the entrance, so each piece skips its own fade-up.
 */
import { Play, Rocket } from 'lucide-react'
import { motion } from 'motion/react'
import { useSettingsStore } from '../../app/settings-store'
import { cursorBuildEnabled } from './cursor-crew/crew'
import { ASSET, Wordmark } from './shared'
import { openNewRoom } from './open-room'

const NAV = [
  ['Home', '#home'],
  ['Features', '#features'],
  ['How it works', '#how'],
  ['Download', '#download'],
] as const

export function Hero() {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const built = cursorBuildEnabled(reduceMotion)
  /** `false` tells Motion to render at the animate state with no entrance of its own. */
  const enter = (from: { opacity: number; y: number }) => (built ? false : from)

  return (
    <div id="home" className="relative flex min-h-screen flex-col overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="pointer-events-none absolute inset-x-0 -top-40 z-0 h-[calc(100%+10rem)] w-full object-cover object-bottom opacity-90"
      >
        <source src={`${ASSET}/hero.mp4`} type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-white/15 via-transparent to-white/40" />

      <header className="relative z-20 flex shrink-0 items-center justify-between px-6 py-5 md:px-12 lg:px-20">
        <a href="#home" className="flex cursor-pointer items-center gap-2" aria-label="Hydras home">
          <Wordmark className="h-10" />
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={openNewRoom}
          className="inline-flex h-8 items-center justify-center rounded-full px-5 text-sm font-medium text-foreground shadow-sm transition-all hover:scale-[1.02]"
        >
          Open a room
        </button>
      </header>

      <main className="relative z-10 mt-10 flex w-full flex-1 flex-col items-center px-4 pb-10">
        <motion.div
          initial={enter({ opacity: 0, y: 10 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-4 md:mb-6"
        >
          <div
            data-build="badge"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-md"
          >
            <span>Offline-first code editor ✨</span>
          </div>
        </motion.div>

        <motion.h1
          initial={enter({ opacity: 0, y: 16 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="max-w-4xl px-2 text-center font-display text-5xl leading-[0.98] tracking-tight text-foreground md:text-6xl lg:text-[5rem]"
        >
          <span className="block">
            <span data-build="line1" className="inline-block">
              Your Team&apos;s Code
            </span>
          </span>
          <span className="mt-1 block">
            <span data-build="line2" className="inline-block">
              Never Lost
            </span>
          </span>
        </motion.h1>

        <motion.p
          data-build="subhead"
          initial={enter({ opacity: 0, y: 16 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="mt-4 max-w-[650px] px-4 text-center text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          Edit the same files live with your whole team, keep typing when the Wi-Fi drops, and merge
          cleanly the moment you reconnect.
        </motion.p>

        <motion.div
          data-build="cta"
          initial={enter({ opacity: 0, y: 16 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="mt-5 flex items-center gap-3"
        >
          <button
            type="button"
            onClick={openNewRoom}
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-foreground shadow-sm transition-all hover:scale-[1.02]"
          >
            Open a room <Rocket className="size-4" />
          </button>
          <a
            href="#features"
            aria-label="See how it works"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-105 active:scale-95"
          >
            <Play className="h-4 w-4 translate-x-0.5 fill-foreground text-foreground" />
          </a>
        </motion.div>

        <motion.div
          initial={enter({ opacity: 0, y: 30 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
          className="mt-8 w-full max-w-5xl shrink-0"
        >
          <div data-build="preview" className="dashboard-glass rounded-2xl p-3 md:p-4">
            <img
              src={`${ASSET}/hero-app.png`}
              alt="Hydras workspace: files, a shared editor and the sync inspector"
              width={2000}
              height={1070}
              fetchPriority="high"
              className="h-auto w-full rounded-xl border border-black/[0.06] shadow-sm"
            />
          </div>
        </motion.div>
      </main>
    </div>
  )
}
