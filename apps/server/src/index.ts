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
import { AccessStore, accessApi } from './access'

const config = loadConfig(process.env)
const databasePath = resolve(config.sqlitePath)
mkdirSync(dirname(databasePath), { recursive: true })

const access = new AccessStore(resolve(dirname(databasePath), 'access.json'))
const api = accessApi(access)
const server = new Server({
  name: 'hydras-sync',
  port: config.port,
  quiet: true,
  extensions: [new SQLite({ database: databasePath })],

  async onAuthenticate({ documentName, token, connectionConfig }) {
    const role = access.role(documentName, token)
    if (role === 'pending' || role === 'rejected')
      throw new Error(role === 'pending' ? 'Waiting for host approval' : 'Room access denied')
    connectionConfig.readOnly = role === 'viewer'
    if (!config.roomPattern.test(documentName)) {
      throw new Error(`Invalid room name: ${documentName}`)
    }
    return { token }
  },

  async onRequest({ request, response, instance }) {
    if (await api(request, response)) {
      if (request.url?.startsWith('/api/approve') && response.statusCode === 200) {
        const room = new URL(request.url, 'http://localhost').searchParams.get('room') ?? ''
        for (const connection of instance.documents.get(room)?.getConnections() ?? []) {
          const role = access.role(room, connection.context.token ?? '')
          connection.readOnly = role === 'viewer'
          if (role === 'rejected' || role === 'pending') connection.close()
        }
      }
      throw null
    }
  },
  async beforeHandleMessage({ documentName, context, connection }) {
    const role = access.role(documentName, context.token ?? '')
    if (role === 'pending' || role === 'rejected') throw new Error('Room access revoked')
    connection.readOnly = role === 'viewer'
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

if (process.env.HYDRAS_LAUNCHER_PID) {
  const parent = Number(process.env.HYDRAS_LAUNCHER_PID)
  setInterval(() => {
    try {
      process.kill(parent, 0)
    } catch {
      void server.destroy().finally(() => process.exit(0))
    }
  }, 2000).unref()
}
