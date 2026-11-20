/**
 * The current Room, provided once by the workspace. The Room object is stable for the
 * session; components subscribe to the specific Readable values they need.
 */
import { createContext, useContext } from 'react'
import type { Room } from '@hydras/sync'

export const RoomContext = createContext<Room | null>(null)

export function useCurrentRoom(): Room {
  const room = useContext(RoomContext)
  if (!room) throw new Error('useCurrentRoom() must be used inside <RoomContext.Provider>')
  return room
}
