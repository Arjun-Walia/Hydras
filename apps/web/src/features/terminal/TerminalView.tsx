/**
 * One terminal: xterm.js rendering a real shell on a native PTY (desktop shell).
 * Stays mounted while hidden so the shell keeps running when you switch tabs.
 */
import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { RotateCcw } from 'lucide-react'
import { useSettingsStore } from '../../app/settings-store'
import { spawnTerminal, type TerminalHandle } from '../../platform/desktop-terminal'
import { xtermThemeFromTokens } from './xterm-theme'

type Props = {
  root: string | null
  isActive: boolean
  onTitle?: (title: string) => void
}

export function TerminalView({ root, isActive, onTitle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [generation, setGeneration] = useState(0)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const fontSize = useSettingsStore((s) => s.editor.fontSize)
  const themeId = useSettingsStore((s) => s.themeId)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const term = new Terminal({
      fontFamily: "'JetBrains Mono Variable', ui-monospace, Consolas, monospace",
      fontSize: useSettingsStore.getState().editor.fontSize,
      lineHeight: 1.25,
      cursorBlink: true,
      allowProposedApi: false,
      scrollback: 5000,
      theme: xtermThemeFromTokens(),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    let handle: TerminalHandle | null = null
    let disposed = false
    setExitCode(null)

    spawnTerminal({
      root,
      cols: term.cols,
      rows: term.rows,
      onData: (text) => term.write(text),
      onExit: (code) => {
        term.write(`\r\n\x1b[2m[process exited with code ${code}]\x1b[0m\r\n`)
        setExitCode(code)
      },
    })
      .then((h) => {
        if (disposed) h.kill()
        else handle = h
      })
      .catch((error: unknown) => {
        term.write(
          `\x1b[31mCould not start a shell: ${error instanceof Error ? error.message : String(error)}\x1b[0m\r\n`,
        )
        setExitCode(-1)
      })

    const input = term.onData((data) => handle?.write(data))
    const title = term.onTitleChange((t) => onTitle?.(t))
    const resized = term.onResize(({ cols, rows }) => handle?.resize(cols, rows))
    const observer = new ResizeObserver(() => {
      if (host.offsetWidth > 0 && host.offsetHeight > 0) fit.fit()
    })
    observer.observe(host)

    return () => {
      disposed = true
      observer.disconnect()
      input.dispose()
      title.dispose()
      resized.dispose()
      handle?.kill()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // A new generation (restart) or a different folder starts a new shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, generation])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontSize = fontSize
    term.options.theme = xtermThemeFromTokens()
    fitRef.current?.fit()
  }, [fontSize, themeId])

  useEffect(() => {
    if (!isActive) return
    fitRef.current?.fit()
    termRef.current?.focus()
  }, [isActive])

  return (
    <div className={isActive ? 'relative h-full' : 'hidden'}>
      <div ref={hostRef} className="h-full px-2 pt-1.5" />
      {exitCode !== null && (
        <button
          type="button"
          onClick={() => setGeneration((g) => g + 1)}
          className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-[var(--radius-chrome)] border border-line bg-surface px-2.5 py-1 text-[12px] text-muted hover:text-fg"
        >
          <RotateCcw size={12} /> Restart shell
        </button>
      )}
    </div>
  )
}
