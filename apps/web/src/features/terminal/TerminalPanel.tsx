/**
 * Bottom panel with terminal tabs. Shells start in the folder opened on this machine
 * (or the home directory). Terminals are local to you; they are not shared in the room.
 * In a browser tab there is no way to start a process, so we say so plainly.
 */
import { useState } from 'react'
import { Plus, SquareTerminal, X } from 'lucide-react'
import { Eyebrow, IconButton, cn } from '@hydras/ui'
import { isDesktopApp } from '../../app/platform'
import { useUiStore } from '../../app/ui-store'
import { TerminalView } from './TerminalView'

interface Session {
  key: number
  title: string
}

let nextKey = 1

export function TerminalPanel() {
  const folderRoot = useUiStore((s) => s.folderRoot)
  const toggleTerminal = useUiStore((s) => s.toggleTerminal)
  const [sessions, setSessions] = useState<Session[]>(() => [{ key: nextKey++, title: 'shell' }])
  const [activeKey, setActiveKey] = useState(sessions[0]!.key)

  const addSession = () => {
    const session = { key: nextKey++, title: 'shell' }
    setSessions((s) => [...s, session])
    setActiveKey(session.key)
  }

  const closeSession = (key: number) => {
    const remaining = sessions.filter((s) => s.key !== key)
    if (remaining.length === 0) {
      toggleTerminal(false)
      return
    }
    setSessions(remaining)
    if (key === activeKey) setActiveKey(remaining[remaining.length - 1]!.key)
  }

  const rename = (key: number, title: string) =>
    setSessions((s) =>
      s.map((x) => (x.key === key ? { ...x, title: title.slice(0, 40) || 'shell' } : x)),
    )

  return (
    <section className="flex h-full flex-col border-t border-line-soft bg-bg" aria-label="Terminal">
      <div className="flex h-8 shrink-0 items-center gap-1 px-2">
        <Eyebrow className="mr-2">Terminal</Eyebrow>
        {isDesktopApp() &&
          sessions.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveKey(s.key)}
              className={cn(
                'group flex h-6 items-center gap-1.5 rounded-[var(--radius-chrome)] pr-1 pl-2 text-[12px]',
                s.key === activeKey ? 'bg-surface-raised text-fg' : 'text-muted hover:text-fg',
              )}
            >
              <SquareTerminal size={12} />
              <span className="max-w-[140px] truncate">{s.title}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Close ${s.title}`}
                onClick={(e) => {
                  e.stopPropagation()
                  closeSession(s.key)
                }}
                onKeyDown={(e) => e.key === 'Enter' && closeSession(s.key)}
                className="grid size-4 place-items-center rounded opacity-0 group-hover:opacity-100 hover:bg-surface"
              >
                <X size={10} />
              </span>
            </button>
          ))}
        <span className="flex-1" />
        {isDesktopApp() && (
          <IconButton label="New terminal" className="size-6" onClick={addSession}>
            <Plus size={13} />
          </IconButton>
        )}
        <IconButton
          label="Hide terminal (Ctrl+`)"
          className="size-6"
          onClick={() => toggleTerminal(false)}
        >
          <X size={13} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1">
        {isDesktopApp() ? (
          sessions.map((s) => (
            <TerminalView
              key={s.key}
              root={folderRoot}
              isActive={s.key === activeKey}
              onTitle={(t) => rename(s.key, t)}
            />
          ))
        ) : (
          <div className="flex h-full flex-col items-start justify-center gap-3 px-5 py-4">
            <p className="max-w-[60ch] text-[13px] text-muted">
              Terminals run a real shell (PowerShell, bash, zsh) in your project folder. A browser
              tab isn't allowed to start programs, so the terminal lives in the Hydras desktop app.
              Install it in one click, then open this room there.
            </p>
            <a
              href="https://github.com/Arjun-Walia/Hydras/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-chrome)] bg-accent px-3 text-[12.5px] font-semibold text-[var(--accent-ink)] hover:opacity-90"
            >
              <SquareTerminal size={13} /> Get the desktop app
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
