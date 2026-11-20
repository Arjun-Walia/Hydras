/**
 * Server configuration from environment variables, validated at startup.
 * Fails fast with a clear message instead of starting half-configured.
 */

export interface ServerConfig {
  port: number
  sqlitePath: string
  roomPattern: RegExp
}

const DEFAULT_PORT = 1234
const DEFAULT_SQLITE_PATH = './data/hydras.sqlite'
/** Must match the client's ROOM_SLUG_PATTERN in @hydras/shared. */
const ROOM_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/

export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  const rawPort = env.PORT ?? String(DEFAULT_PORT)
  const port = Number.parseInt(rawPort, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${rawPort}"`)
  }
  return {
    port,
    sqlitePath: env.SQLITE_PATH ?? DEFAULT_SQLITE_PATH,
    roomPattern: ROOM_PATTERN,
  }
}
