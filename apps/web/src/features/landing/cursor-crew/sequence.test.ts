import { describe, expect, it } from 'vitest'
import {
  BUILD_END_MS,
  DWELL_MS,
  SEQUENCE_MS,
  STEPS,
  clampRect,
  clickPulse,
  crewOpacity,
  cursorTarget,
  homeFor,
  planCursor,
  revealClip,
  revealProgress,
  sampleRoute,
  type Rect,
  type Step,
} from './sequence'

const rect: Rect = { x: 100, y: 200, width: 400, height: 50 }
const step = (over: Partial<Step> = {}): Step => ({
  id: 'x',
  cursor: 0,
  mode: 'drag',
  start: 1000,
  duration: 500,
  ...over,
})

describe('steps', () => {
  it('every step has a positive duration and the crew leaves after the last one', () => {
    for (const s of STEPS) expect(s.duration).toBeGreaterThan(0)
    expect(BUILD_END_MS).toBe(Math.max(...STEPS.map((s) => s.start + s.duration)))
    expect(SEQUENCE_MS).toBeGreaterThan(BUILD_END_MS)
  })

  it('never asks one cursor to build two things at once', () => {
    for (const a of STEPS) {
      for (const b of STEPS) {
        if (a === b || a.cursor !== b.cursor) continue
        const overlaps = a.start < b.start + b.duration && b.start < a.start + a.duration
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false)
      }
    }
  })
})

describe('revealProgress', () => {
  it('clamps to the step window', () => {
    const s = step()
    expect(revealProgress(s, 0)).toBe(0)
    expect(revealProgress(s, 1250)).toBeCloseTo(0.5)
    expect(revealProgress(s, 9999)).toBe(1)
  })
})

describe('cursorTarget', () => {
  it('drags from the top-left corner to the bottom-right', () => {
    expect(cursorTarget(step(), rect, 0)).toEqual({ x: 100, y: 200 })
    expect(cursorTarget(step(), rect, 1)).toEqual({ x: 500, y: 250 })
  })

  it('types left to right along one line', () => {
    const typing = step({ mode: 'type' })
    expect(cursorTarget(typing, rect, 0).x).toBe(100)
    expect(cursorTarget(typing, rect, 1).x).toBe(500)
    expect(cursorTarget(typing, rect, 0).y).toBe(cursorTarget(typing, rect, 1).y)
  })

  it('holds still on the centre for a click', () => {
    const placing = step({ mode: 'place' })
    expect(cursorTarget(placing, rect, 0)).toEqual(cursorTarget(placing, rect, 1))
    expect(cursorTarget(placing, rect, 0)).toEqual({ x: 300, y: 225 })
  })
})

describe('planCursor and sampleRoute', () => {
  const rects = new Map<string, Rect>([
    ['a', rect],
    ['b', { x: 700, y: 400, width: 100, height: 100 }],
  ])
  const steps: Step[] = [
    step({ id: 'a', start: 1000, duration: 500 }),
    step({ id: 'b', start: 2000, duration: 400, mode: 'place' }),
  ]
  const home = { x: -70, y: 300 }

  it('starts off-screen and leaves the same way once its work is done', () => {
    const route = planCursor(0, steps, rects, home)
    expect(sampleRoute(route, 0)).toEqual(home)
    // Holds on the finished piece...
    expect(sampleRoute(route, 2400 + DWELL_MS)).toEqual({ x: 750, y: 450 })
    // ...then goes home rather than parking on the page.
    expect(sampleRoute(route, 99_999)).toEqual(home)
  })

  it('never leaves a cursor motionless on the page for over a second', () => {
    const viewport = { width: 1440, height: 900 }
    const heroRects = new Map(
      STEPS.map((s, i) => [s.id, { x: 200 + i * 40, y: 120 + i * 90, width: 320, height: 60 }]),
    )
    for (let cursor = 0; cursor < 4; cursor++) {
      const route = planCursor(
        cursor,
        STEPS,
        heroRects,
        homeFor(cursor, viewport.width, viewport.height),
      )
      let still = 0
      let previous = sampleRoute(route, 0)
      for (let t = 50; t <= SEQUENCE_MS; t += 50) {
        const at = sampleRoute(route, t)
        const moved = Math.abs(at.x - previous.x) + Math.abs(at.y - previous.y) > 0.5
        still = moved ? 0 : still + 50
        previous = at
        // Parked off-screen is the point of leaving; only visible stillness reads as frozen.
        const onScreen =
          at.x > 0 && at.x < viewport.width && at.y > 0 && at.y < viewport.height
        if (!onScreen) continue
        expect(still, `cursor ${cursor} froze at ${t}ms`).toBeLessThanOrEqual(1000)
      }
    }
  })

  it('travels between steps instead of jumping', () => {
    const route = planCursor(0, steps, rects, home)
    const midway = sampleRoute(route, 1750)
    expect(midway.x).toBeGreaterThan(500)
    expect(midway.x).toBeLessThan(750)
  })

  it('ignores steps for other cursors and targets that are not on the page', () => {
    expect(planCursor(1, steps, rects, home)).toEqual([])
    expect(planCursor(0, steps, new Map(), home)).toEqual([])
  })

  it('is a safe no-op when there is no route', () => {
    expect(sampleRoute([], 500)).toEqual({ x: 0, y: 0 })
  })
})

describe('revealClip', () => {
  it('hides the target at 0 and clears it at 1', () => {
    expect(revealClip('type', 0)).toBe('inset(0 100% 0 0)')
    expect(revealClip('type', 1)).toBe('inset(0 0% 0 0)')
    expect(revealClip('drag', 0)).toBe('inset(0 100% 100% 0)')
    expect(revealClip('place', 1)).toBe('inset(0% 0% 0% 0% round 14px)')
  })
})

describe('the crew leaving', () => {
  it('stays solid through the build then fades out', () => {
    expect(crewOpacity(0)).toBe(1)
    expect(crewOpacity(BUILD_END_MS)).toBe(1)
    expect(crewOpacity(SEQUENCE_MS)).toBe(0)
    expect(crewOpacity(SEQUENCE_MS + 1000)).toBe(0)
  })
})

describe('clampRect', () => {
  it('keeps a tall target from pulling the cursor below the fold', () => {
    const tall = clampRect({ x: 100, y: 500, width: 1200, height: 900 }, 1440, 900)
    expect(tall.y + tall.height).toBeLessThanOrEqual(900)
    expect(tall.x + tall.width).toBeLessThanOrEqual(1440)
  })

  it('leaves a target that already fits alone', () => {
    const small = { x: 10, y: 10, width: 100, height: 40 }
    expect(clampRect(small, 1440, 900)).toEqual(small)
  })

  it('never returns a negative size', () => {
    const offscreen = clampRect({ x: 2000, y: 2000, width: 50, height: 50 }, 1440, 900)
    expect(offscreen.width).toBe(0)
    expect(offscreen.height).toBe(0)
  })
})

describe('clickPulse', () => {
  it('only pulses for a click, and decays', () => {
    expect(clickPulse(step({ mode: 'drag' }), 1000)).toBe(0)
    const placing = step({ mode: 'place' })
    expect(clickPulse(placing, 1000)).toBe(1)
    expect(clickPulse(placing, 1500)).toBe(0)
  })
})

describe('homeFor', () => {
  it('starts every cursor outside the viewport', () => {
    const width = 1440
    const height = 900
    for (let i = 0; i < 4; i++) {
      const { x, y } = homeFor(i, width, height)
      const outside = x < 0 || y < 0 || x > width || y > height
      expect(outside, `cursor ${i} starts on screen`).toBe(true)
    }
  })
})
