/**
 * Talk to a real shell running on a native PTY in the desktop shell.
 */
import { Channel, invoke } from '@tauri-apps/api/core'

export interface TerminalHandle {
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

export interface SpawnOptions {
  /** Absolute project root the shell starts in; null for the home directory. */
  root: string | null
  cols: number
  rows: number
  onData: (text: string) => void
  onExit: (code: number) => void
}

export async function spawnTerminal(options: SpawnOptions): Promise<TerminalHandle> {
  const onData = new Channel<string>()
  onData.onmessage = options.onData
  const onExit = new Channel<number>()
  onExit.onmessage = options.onExit
  const id = await invoke<number>('terminal_spawn', {
    root: options.root,
    cols: options.cols,
    rows: options.rows,
    onData,
    onExit,
  })
  return {
    write: (data) => void invoke('terminal_write', { id, data }).catch(() => undefined),
    resize: (cols, rows) =>
      void invoke('terminal_resize', { id, cols, rows }).catch(() => undefined),
    kill: () => void invoke('terminal_kill', { id }).catch(() => undefined),
  }
}
