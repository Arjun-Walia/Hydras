/**
 * Marketing landing page at "/", ported section by section from the Agentic-marketplace
 * client (MIT): same layout, motion and assets, with Hydras content.
 * Light-only by design; it does not follow the in-app theme.
 */
import { MotionConfig } from 'motion/react'
import { useSettingsStore } from '../../app/settings-store'
import { Bento } from './Bento'
import { CodeDemo } from './CodeDemo'
import { CursorCrew } from './cursor-crew/CursorCrew'
import { CrdtCube } from './CrdtCube'
import { Footer } from './Footer'
import { Global } from './Global'
import { Hero } from './Hero'
import { Integrations } from './Integrations'
import { Scenarios } from './Scenarios'
import { Showcase } from './Showcase'
import { Steps } from './Steps'

export function Landing() {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div
        data-theme="light"
        className="h-full w-full overflow-x-hidden overflow-y-auto bg-white font-body text-base text-foreground select-none"
        style={{ colorScheme: 'light' }}
      >
        <Hero />
        <Showcase />
        <Bento />
        <CrdtCube />
        <Steps />
        <CodeDemo />
        <Global />
        <Integrations />
        <Scenarios />
        <Footer />
        <CursorCrew />
      </div>
    </MotionConfig>
  )
}
