import { useEffect, useState, type ReactNode } from 'react'
import { loadIdentity } from '../../app/identity'
import { roomApi, saveSession, session } from '../../app/access'
import { isFreshRoom } from '../../app/fresh-room'
export function AccessGate({ slug, children }: { slug: string; children: ReactNode }) {
  // A room this tab just created has nothing to protect. Enter it immediately and keep
  // editing locally when the host is down; a later status response can still lock it.
  const [role, setRole] = useState(
    () => session(slug)?.role ?? (isFreshRoom(slug) ? 'open' : 'checking'),
  )
  const [password, setPassword] = useState('')
  const [name, setName] = useState(() => loadIdentity()?.name ?? '')
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    const check = () =>
      navigator.onLine
        ? roomApi('status', slug)
            .then((data) => {
              if (!alive) return
              setRole(data.role)
              const existing = session(slug)
              if (existing) saveSession(slug, { ...existing, role: data.role })
              else if (data.role === 'open') saveSession(slug, { token: '', role: 'open' })
            })
            .catch(() => {
              if (alive)
                setError(
                  'Cannot reach host. Check the server address, host app, Private-network firewall permission, and Wi-Fi client isolation. Cached authorized work remains available offline.',
                )
            })
        : Promise.resolve()
    void check()
    const timer = setInterval(check, 4000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [slug])
  if (
    ['open', 'host', 'editor', 'viewer'].includes(role) ||
    (role === 'rejected' && session(slug)?.token)
  )
    return (
      <div key={role} className="h-full">
        {children}
      </div>
    )
  if (role === 'checking') {
    return (
      <main className="grid h-full place-items-center bg-bg text-fg">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-line p-8">
          <h1 className="text-2xl">{slug}</h1>
          <p role="status">{error || 'Checking the room…'}</p>
          <p>
            <a href="/?landing=1&watch=1">Watch the demo</a>
            {' · '}
            <a href="/">Back to Host / Join</a>
          </p>
        </div>
      </main>
    )
  }
  return (
    <main className="grid h-full place-items-center bg-bg text-fg">
      <form
        className="w-full max-w-md space-y-4 rounded-xl border border-line p-8"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            const data = await roomApi('join', slug, { password, name })
            saveSession(slug, data)
            setRole(data.role)
            setError('')
          } catch (e) {
            setError(String(e))
          }
        }}
      >
        <h1 className="text-2xl">Join {slug}</h1>
        <p>
          {role === 'pending'
            ? 'Waiting for the host to approve you as an editor or viewer.'
            : 'Enter the room password to request access.'}
        </p>
        {role !== 'pending' && (
          <>
            <input
              aria-label="Your name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border p-2"
              required
            />
            <input
              aria-label="Room password"
              type="password"
              placeholder="Room password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border p-2"
              required
            />
            <button className="rounded border px-4 py-2">Request access</button>
          </>
        )}
        <p role="status" className="text-sm text-warn">
          {error}
        </p>
        <a href="/">Back to Host / Join</a>
      </form>
    </main>
  )
}
