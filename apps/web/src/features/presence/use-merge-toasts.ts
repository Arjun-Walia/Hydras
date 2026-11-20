/**
 * The reconnect moment: when the connection reports a new merge, say how much merged
 * and with how many collaborators.
 */
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Room } from '@hydras/sync'

export function useMergeToasts(room: Room): void {
  const lastSeen = useRef<number | null>(room.connection.get().lastMerge?.at ?? null)

  useEffect(
    () =>
      room.connection.subscribe(() => {
        const merge = room.connection.get().lastMerge
        if (!merge || merge.at === lastSeen.current) return
        lastSeen.current = merge.at
        const others = room.peers.get().filter((peer) => !peer.isSelf).length
        const changes = `${merge.changes} ${merge.changes === 1 ? 'change' : 'changes'}`
        const withWhom =
          others > 0 ? ` with ${others} ${others === 1 ? 'collaborator' : 'collaborators'}` : ''
        toast.success(`Back online. Merged ${changes}${withWhom}.`)
      }),
    [room],
  )
}
