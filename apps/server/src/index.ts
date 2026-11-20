/**
 * Hydras sync server: Hocuspocus relay + SQLite persistence, one process.
 *
 * Invariant: the server never interprets document contents. It authenticates (stub),
 * relays Yjs updates and awareness, and stores snapshots. Rooms are addressed by name.
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Server } from '@hocuspocus/server'
import { SQLite } from '@hocuspocus/extension-sqlite'
import { loadConfig } from './config'
import { log } from './log'

const config = loadConfig(process.env)
const databasePath = resolve(config.sqlitePath)
mkdirSync(dirname(databasePath), { recursive: true })

const server = new Server({
  name: 'hydras-sync',
  port: config.port,
  quiet: true,
  extensions: [new SQLite({ database: databasePath })],

  async onAuthenticate({ documentName }) {
    // Room link is the only access control for now. Real auth plugs in here.
    if (!config.roomPattern.test(documentName)) {
      throw new Error(`Invalid room name: ${documentName}`)
    }
  },

  async onConnect({ documentName, socketId }) {
    log('connect', { room: documentName, socket: socketId })
  },

  async onDisconnect({ documentName, clientsCount }) {
    log('disconnect', { room: documentName, remaining: clientsCount })
  },

  async onLoadDocument({ documentName }) {
    log('load', { room: documentName })
  },
})

await server.listen()
log('listening', { port: config.port, database: databasePath })
