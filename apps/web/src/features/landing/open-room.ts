/** Start a fresh room from the landing or start screen. */
import { navigate, randomRoomSlug } from '../../app/route'

export function openNewRoom(): void {
  navigate(`/r/${randomRoomSlug()}`)
}
