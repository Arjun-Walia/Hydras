/**
 * Four named cursors build the hero, then leave.
 *
 * Invariants:
 * - The hero's text is always in the DOM. This only reveals it visually (`clip-path` +
 *   `opacity`), so screen readers and crawlers see the finished page from the first paint.
 * - Targets are hidden in a layout effect, before the browser paints, so nothing flashes.
 * - Only `clip-path` and `opacity` are written on targets. Motion owns their `transform`.
 * - Any click, key, scroll or resize finishes the build immediately. Nobody waits on it.
 */
import { useLayoutEffect, useRef } from 'react'
import { useSettingsStore } from '../../../app/settings-store'
import { CREW, cursorBuildEnabled } from './crew'
import {
  SEQUENCE_MS,
  STEPS,
  clampRect,
  clickPulse,
  crewOpacity,
  homeFor,
  planCursor,
  revealClip,
  revealProgress,
  sampleRoute,
  type Rect,
  type Waypoint,
} from './sequence'

export function CursorCrew() {
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const layerRef = useRef<HTMLDivElement>(null)
  const cursorRefs = useRef<(HTMLDivElement | null)[]>([])
  const pulseRefs = useRef<(HTMLSpanElement | null)[]>([])

  useLayoutEffect(() => {
    if (!cursorBuildEnabled(reduceMotion)) return
    const layer = layerRef.current
    if (!layer) return

    const targets = new Map<string, HTMLElement>()
    for (const step of STEPS) {
      const element = document.querySelector<HTMLElement>(`[data-build="${step.id}"]`)
      if (!element) return // A hero we don't recognise: leave the page alone.
      targets.set(step.id, element)
    }

    const rects = new Map<string, Rect>()
    for (const [id, element] of targets) {
      const box = element.getBoundingClientRect()
      rects.set(
        id,
        clampRect(
          { x: box.x, y: box.y, width: box.width, height: box.height },
          window.innerWidth,
          window.innerHeight,
        ),
      )
    }

    for (const element of targets.values()) {
      element.style.willChange = 'clip-path, opacity'
      element.style.opacity = '0'
    }

    // A previous run's cleanup parks the layer; StrictMode's double mount in dev would
    // otherwise leave the crew invisible for the whole build.
    layer.style.visibility = 'visible'
    layer.style.opacity = '1'

    const routes: Waypoint[][] = CREW.map((_, index) =>
      planCursor(index, STEPS, rects, homeFor(index, window.innerWidth, window.innerHeight)),
    )

    let frame = 0
    let finished = false
    const started = performance.now()

    const finish = () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      for (const element of targets.values()) {
        element.style.clipPath = ''
        element.style.opacity = ''
        element.style.willChange = ''
      }
      layer.style.opacity = '0'
      layer.style.visibility = 'hidden'
      window.removeEventListener('pointerdown', finish)
      window.removeEventListener('keydown', finish)
      window.removeEventListener('wheel', finish)
      window.removeEventListener('scroll', finish)
      window.removeEventListener('resize', finish)
    }

    const tick = () => {
      const now = performance.now() - started
      if (now >= SEQUENCE_MS) return finish()

      for (const step of STEPS) {
        const element = targets.get(step.id)!
        const progress = revealProgress(step, now)
        element.style.opacity = progress > 0 ? '1' : '0'
        element.style.clipPath = revealClip(step.mode, progress)
      }

      layer.style.opacity = String(crewOpacity(now))

      for (let index = 0; index < CREW.length; index++) {
        const node = cursorRefs.current[index]
        if (!node) continue
        const { x, y } = sampleRoute(routes[index]!, now)
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`

        const pulse = pulseRefs.current[index]
        if (pulse) {
          const step = STEPS.find((s) => s.cursor === index && clickPulse(s, now) > 0)
          const strength = step ? clickPulse(step, now) : 0
          pulse.style.opacity = String(strength * 0.5)
          pulse.style.transform = `translate(-50%, -50%) scale(${1 + (1 - strength) * 1.6})`
        }
      }

      frame = requestAnimationFrame(tick)
    }

    // The hero image decides the preview's height; wait a beat so the rects are real.
    frame = requestAnimationFrame(tick)
    window.addEventListener('pointerdown', finish)
    window.addEventListener('keydown', finish)
    window.addEventListener('wheel', finish, { passive: true })
    window.addEventListener('scroll', finish, { passive: true })
    window.addEventListener('resize', finish)

    return finish
  }, [reduceMotion])

  if (!cursorBuildEnabled(reduceMotion)) return null

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {CREW.map((member, index) => (
        <div
          key={member.name}
          ref={(node) => {
            cursorRefs.current[index] = node
          }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ transform: 'translate3d(-200px, -200px, 0)' }}
        >
          <span
            ref={(node) => {
              pulseRefs.current[index] = node
            }}
            className="absolute top-0 left-0 block size-10 rounded-full"
            style={{ background: member.color, opacity: 0, transform: 'translate(-50%, -50%)' }}
          />
          <svg
            width="20"
            height="22"
            viewBox="0 0 20 22"
            fill="none"
            className="relative drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
          >
            <path
              d="M1.5 1.2 L1.5 17.2 L5.6 13.3 L8.4 20 L11.4 18.7 L8.7 12.1 L14.2 11.8 Z"
              fill={member.color}
              stroke="#fff"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="absolute top-[18px] left-[14px] rounded-[5px] px-1.5 py-[3px] text-[11px] leading-none font-medium whitespace-nowrap text-white"
            style={{ background: member.color }}
          >
            {member.name}
          </span>
        </div>
      ))}
    </div>
  )
}
