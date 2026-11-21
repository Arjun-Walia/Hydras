/**
 * Who builds the hero, and whether they should.
 *
 * The crew uses the app's own name generator vocabulary and collaborator palette, so the
 * cursors on the landing page are the cursors you get in a real room.
 */
import { colorForUser } from '@hydras/shared'

export interface CrewMember {
  readonly name: string
  readonly color: string
}

export const CREW: readonly CrewMember[] = [
  'clever-otter',
  'nimble-gecko',
  'lucid-heron',
  'sly-lynx',
].map((name) => ({ name, color: colorForUser(name, 'light').color }))

const SESSION_KEY = 'hydras:landing-build'

/**
 * Decided once per page load so the hero and the overlay never disagree: the hero skips
 * its own entrance animation only when the crew is actually going to build it.
 *
 * Plays once a session, because a visitor who is navigating back to the page wants the
 * page, not the show. `?build=1` forces it for a demo, `?build=0` turns it off.
 */
let decision: boolean | null = null

function decide(): boolean {
  if (typeof window === 'undefined') return false

  const forced = new URLSearchParams(window.location.search).get('build')
  if (forced === '1') return true
  if (forced === '0') return false
  // Someone opened the page to watch the recording; don't cover it with the build.
  if (new URLSearchParams(window.location.search).get('watch') === '1') return false

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  // Phones only: below this the hero stacks and four cursors become a scribble.
  if (window.innerWidth < 720) return false

  try {
    if (window.sessionStorage.getItem(SESSION_KEY) === 'done') return false
    window.sessionStorage.setItem(SESSION_KEY, 'done')
  } catch {
    // Private mode without storage: show it, just don't remember.
  }
  return true
}

export function cursorBuildEnabled(reduceMotion: boolean): boolean {
  decision ??= decide()
  return decision && !reduceMotion
}
