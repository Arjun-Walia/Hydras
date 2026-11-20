/**
 * Dotted world map with pulsing markers. Ported from the reference's
 * components/ui/dotted-map.tsx (MIT), built on svg-dotted-map (MIT).
 */
import { useMemo } from 'react'
import { createMap } from 'svg-dotted-map'

export interface Marker {
  lat: number
  lng: number
  size?: number
  pulse?: boolean
}

interface DottedMapProps {
  width?: number
  height?: number
  mapSamples?: number
  markers?: Marker[]
  dotColor?: string
  markerColor?: string
  dotRadius?: number
  stagger?: boolean
  pulse?: boolean
}

export function DottedMap({
  width = 150,
  height = 75,
  mapSamples = 5000,
  markers = [],
  dotColor = 'currentColor',
  markerColor = '#FF6900',
  dotRadius = 0.2,
  stagger = true,
  pulse = false,
}: DottedMapProps) {
  const { points, addMarkers } = useMemo(
    () => createMap({ width, height, mapSamples }),
    [width, height, mapSamples],
  )
  const processedMarkers = useMemo(() => addMarkers(markers), [addMarkers, markers])

  const { xStep, yToRowIndex } = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x)
    const rowMap = new Map<number, number>()
    let step = 0
    let prevY = Number.NaN
    let prevXInRow = Number.NaN
    for (const p of sorted) {
      if (p.y !== prevY) {
        prevY = p.y
        prevXInRow = Number.NaN
        if (!rowMap.has(p.y)) rowMap.set(p.y, rowMap.size)
      }
      if (!Number.isNaN(prevXInRow)) {
        const delta = p.x - prevXInRow
        if (delta > 0) step = step === 0 ? delta : Math.min(step, delta)
      }
      prevXInRow = p.x
    }
    return { xStep: step || 1, yToRowIndex: rowMap }
  }, [points])

  const offsetFor = (y: number) => (stagger && (yToRowIndex.get(y) ?? 0) % 2 === 1 ? xStep / 2 : 0)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={point.x + offsetFor(point.y)}
          cy={point.y}
          r={dotRadius}
          fill={dotColor}
        />
      ))}
      {processedMarkers.map((marker, index) => {
        const x = marker.x + offsetFor(marker.y)
        const y = marker.y
        const r = marker.size ?? dotRadius
        const shouldPulse = pulse ? marker.pulse !== false : marker.pulse === true
        const pulseTo = r * 2.8
        return (
          <g key={`${marker.x}-${marker.y}-${index}`}>
            <circle cx={x} cy={y} r={r} fill={markerColor} />
            {shouldPulse && (
              <g pointerEvents="none">
                {[0, 0.7].map((begin) => (
                  <circle
                    key={begin}
                    cx={x}
                    cy={y}
                    r={r}
                    fill="none"
                    stroke={markerColor}
                    strokeWidth={0.35}
                  >
                    <animate
                      attributeName="r"
                      values={`${r};${pulseTo}`}
                      dur="1.4s"
                      begin={`${begin}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;0"
                      dur="1.4s"
                      begin={`${begin}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
