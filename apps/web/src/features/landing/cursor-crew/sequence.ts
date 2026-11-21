/**
 * Timeline maths for the hero's multiplayer build: where each cursor is at time t, and
 * how far each target has been revealed.
 *
 * Pure on purpose. The component owns the DOM and the clock; everything here is a
 * function of (steps, measured rects, elapsed ms) so the choreography can be tested
 * without a browser.
 */

export type Rect = { x: number; y: number; width: number; height: number }
export type Point = { x: number; y: number }

/**
 * How a target arrives:
 * - `place`: the cursor stops on it and it pops in (a click).
 * - `type`: the cursor rides left to right and the line wipes in behind it.
 * - `drag`: the cursor pulls the box out from its top-left to its bottom-right corner.
 */
export type StepMode = 'place' | 'type' | 'drag'

export interface Step {
  /** Matches a `data-build` attribute in the hero. */
  readonly id: string
  /** Index into CREW. */
  readonly cursor: number
  readonly mode: StepMode
  readonly start: number
  readonly duration: number
}

export interface Waypoint {
  readonly t: number
  readonly x: number
  readonly y: number
  /** Ease the segment ending here. Travel eases; a build drags at a constant rate. */
  readonly ease: boolean
}

/** Lead time a cursor gets to reach its first target. */
export const TRAVEL_MS = 620
/** Beat a cursor holds on its finished work before heading off. */
export const DWELL_MS = 340
/** How long a cursor takes to leave the screen. */
export const EXIT_TRAVEL_MS = 620
/** Total time between the last build finishing and an empty screen. */
export const EXIT_MS = DWELL_MS + EXIT_TRAVEL_MS

export const STEPS: readonly Step[] = [
  { id: 'badge', cursor: 0, mode: 'place', start: 620, duration: 320 },
  { id: 'line1', cursor: 1, mode: 'type', start: 700, duration: 780 },
  { id: 'line2', cursor: 1, mode: 'type', start: 1520, duration: 680 },
  { id: 'subhead', cursor: 2, mode: 'place', start: 2040, duration: 340 },
  { id: 'cta', cursor: 2, mode: 'place', start: 2520, duration: 340 },
  { id: 'preview', cursor: 3, mode: 'drag', start: 2400, duration: 900 },
]

export const BUILD_END_MS = STEPS.reduce((end, s) => Math.max(end, s.start + s.duration), 0)
export const SEQUENCE_MS = BUILD_END_MS + EXIT_MS

export const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** Symmetric ease, so a cursor leaves and arrives without a jolt. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** 0 before the step, 1 after it. */
export function revealProgress(step: Step, now: number): number {
  return clamp01((now - step.start) / step.duration)
}

/** Where the cursor sits at `progress` through its step. */
export function cursorTarget(step: Step, rect: Rect, progress: number): Point {
  switch (step.mode) {
    case 'place':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    case 'type':
      // Rides the wipe edge, a little below the middle so it sits on the text baseline.
      return { x: rect.x + rect.width * progress, y: rect.y + rect.height * 0.78 }
    case 'drag':
      return {
        x: lerp(rect.x, rect.x + rect.width, progress),
        y: lerp(rect.y, rect.y + rect.height, progress),
      }
  }
}

/**
 * The route one cursor takes: in from off-screen, through each of its steps, holding
 * between them, then back off-screen once its last piece is done. Gaps between waypoints
 * are the travel, so no explicit travel step is needed.
 *
 * Leaving as soon as the work is finished matters: a cursor parked on the page for two
 * seconds reads as a frozen frame, not a person.
 */
export function planCursor(
  cursor: number,
  steps: readonly Step[],
  rects: ReadonlyMap<string, Rect>,
  home: Point,
): Waypoint[] {
  const mine = steps
    .filter((step) => step.cursor === cursor && rects.has(step.id))
    .sort((a, b) => a.start - b.start)
  if (mine.length === 0) return []

  const first = mine[0]!
  const waypoints: Waypoint[] = [
    { t: Math.max(0, first.start - TRAVEL_MS), x: home.x, y: home.y, ease: false },
  ]
  for (const step of mine) {
    const rect = rects.get(step.id)!
    const from = cursorTarget(step, rect, 0)
    const to = cursorTarget(step, rect, 1)
    waypoints.push({ t: step.start, x: from.x, y: from.y, ease: true })
    waypoints.push({ t: step.start + step.duration, x: to.x, y: to.y, ease: false })
  }

  const last = waypoints[waypoints.length - 1]!
  waypoints.push({ t: last.t + DWELL_MS, x: last.x, y: last.y, ease: false })
  waypoints.push({
    t: last.t + DWELL_MS + EXIT_TRAVEL_MS,
    x: home.x,
    y: home.y,
    ease: true,
  })
  return waypoints
}

/**
 * Trim a measured rect to the part that is on screen, so a cursor never drags toward a
 * corner below the fold. Only cursor positions use this; the reveal is a percentage of
 * the element itself.
 */
export function clampRect(rect: Rect, width: number, height: number, margin = 28): Rect {
  const right = Math.min(rect.x + rect.width, width - margin)
  const bottom = Math.min(rect.y + rect.height, height - margin)
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(0, right - rect.x),
    height: Math.max(0, bottom - rect.y),
  }
}

/** Position along a planned route. Clamps at both ends. */
export function sampleRoute(waypoints: readonly Waypoint[], now: number): Point {
  if (waypoints.length === 0) return { x: 0, y: 0 }
  const first = waypoints[0]!
  const last = waypoints[waypoints.length - 1]!
  if (now <= first.t) return { x: first.x, y: first.y }
  if (now >= last.t) return { x: last.x, y: last.y }

  for (let i = 1; i < waypoints.length; i++) {
    const to = waypoints[i]!
    if (now > to.t) continue
    const from = waypoints[i - 1]!
    const span = to.t - from.t
    const raw = span <= 0 ? 1 : (now - from.t) / span
    const t = to.ease ? easeInOut(raw) : raw
    return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) }
  }
  return { x: last.x, y: last.y }
}

/**
 * 1 while the crew is working, falling to 0 as it leaves. Cursors fly off on their own
 * routes; this just makes sure nothing is left behind at the edges.
 */
export function crewOpacity(now: number): number {
  const fadeFrom = BUILD_END_MS + DWELL_MS
  if (now <= fadeFrom) return 1
  return 1 - clamp01((now - fadeFrom) / EXIT_TRAVEL_MS)
}

/** Short pulse under the pointer as a `place` step lands. */
export function clickPulse(step: Step, now: number): number {
  if (step.mode !== 'place') return 0
  return 1 - clamp01((now - step.start) / step.duration)
}

/** The `clip-path` that reveals a target at `progress`. */
export function revealClip(mode: StepMode, progress: number): string {
  const remaining = (1 - progress) * 100
  switch (mode) {
    case 'type':
      return `inset(0 ${remaining}% 0 0)`
    case 'drag':
      return `inset(0 ${remaining}% ${remaining}% 0)`
    case 'place': {
      // Pops open from slightly inset rather than scaling, so it never fights the
      // transform Motion already owns on these elements.
      const inset = (1 - progress) * 4
      return `inset(${inset}% ${inset}% ${inset}% ${inset}% round 14px)`
    }
  }
}

/** Off-screen start for each cursor, spread around the viewport edges. */
export function homeFor(cursor: number, width: number, height: number): Point {
  switch (cursor % 4) {
    case 0:
      return { x: -70, y: height * 0.34 }
    case 1:
      return { x: width * 0.28, y: height + 70 }
    case 2:
      return { x: width + 70, y: height * 0.42 }
    default:
      return { x: width * 0.78, y: -70 }
  }
}
