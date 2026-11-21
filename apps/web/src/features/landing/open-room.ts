/** Start a fresh room from the landing or start screen. */
import { rememberFreshRoom } from '../../app/fresh-room'
import { navigate, randomRoomSlug } from '../../app/route'

export function openNewRoom(): void {
  const slug = randomRoomSlug()
  rememberFreshRoom(slug)
  navigate(`/r/${slug}`)
}
