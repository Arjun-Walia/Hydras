/**
 * Top-level routing: landing (web) or start screen (desktop) at "/", a room at /r/<slug>.
 * Heavy screens are lazy-loaded so the landing page doesn't ship the editor.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import type { UserIdentity } from '@hydras/shared'
import { Toaster } from 'sonner'
import { AccessGate } from '../features/join/AccessGate'
import { applyInvite } from './access'
import { JoinScreen } from '../features/join/JoinScreen'
import { loadIdentity, saveIdentity } from './identity'
import { isDesktopApp } from './platform'
import { navigate, slugFromPath, usePathname } from './route'
import { resolveTheme, useSettingsStore } from './settings-store'

const Workspace = lazy(() =>
  import('../features/workspace/Workspace').then((m) => ({ default: m.Workspace })),
)
const Landing = lazy(() =>
  import('../features/landing/Landing').then((m) => ({ default: m.Landing })),
)
const StartScreen = lazy(() =>
  import('../features/start/StartScreen').then((m) => ({ default: m.StartScreen })),
)

if (window.location.hash.includes('server=')) {
  try {
    applyInvite(window.location.href)
    window.history.replaceState(null, '', window.location.pathname)
  } catch {
    /* invalid invites are ignored */
  }
}

export function App() {
  const pathname = usePathname()
  const slug = slugFromPath(pathname)
  const themeKind = useSettingsStore((s) => resolveTheme(s).kind)

  useEffect(() => {
    if (!slug && pathname !== '/') navigate('/')
    if (!slug) document.title = 'Hydras · Offline-first multiplayer code editor'
  }, [slug, pathname])

  return (
    <>
      <Suspense fallback={<div className="h-full bg-bg" />}>
        {slug ? (
          <Room key={slug} slug={slug} />
        ) : isDesktopApp() ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ? (
          <StartScreen />
        ) : (
          <Landing />
        )}
      </Suspense>
      <Toaster
        theme={themeKind}
        position="bottom-right"
        offset={40}
        toastOptions={{
          style: {
            background: 'var(--surface-raised)',
            border: '1px solid var(--line)',
            color: 'var(--fg)',
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            borderRadius: 'var(--radius-dialog)',
          },
        }}
      />
    </>
  )
}

function Room({ slug }: { slug: string }) {
  const [identity, setIdentity] = useState<UserIdentity | null>(loadIdentity)
  if (!identity)
    return <JoinScreen slug={slug} onJoin={(name) => setIdentity(saveIdentity(name))} />
  return (
    <AccessGate slug={slug}>
      <Workspace slug={slug} identity={identity} />
    </AccessGate>
  )
}
