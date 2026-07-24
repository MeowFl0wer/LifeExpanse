import { useMemo } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldAtlas from 'world-atlas/countries-110m.json'
import { numericFor } from '../lib/country'

/**
 * The one map component (v1.9 §33 / handoff §5).
 *
 * Real country geometry via d3-geo + world-atlas (an offline TopoJSON vector —
 * no map tiles, no map API). This first version is the static world view:
 * country outlines, visited-country highlight, and city points. Zoom, layer
 * toggles, and great-circle routes are deferred to the trip module, where the
 * flight data joins in; the `arcs` layer below stays only so the existing
 * flights prototype keeps rendering until then.
 *
 * world-atlas indexes geometries by ISO 3166-1 numeric code. The app speaks
 * alpha-3, so `numericFor` bridges the two — one tested lookup, not a second
 * naming map that could drift.
 */

interface MapPoint {
  id: string
  lat: number
  lng: number
  label: string
  value?: number
}

interface MapArc {
  id: string
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
}

interface WorldMapProps {
  points?: MapPoint[]
  arcs?: MapArc[]
  /** Alpha-3 codes of countries to highlight (any spelling normalised upstream). */
  visitedCountries?: string[]
  height?: number
  className?: string
}

/** Minimal shape we read off a world-atlas country feature. */
interface CountryFeature {
  type: 'Feature'
  id?: string | number
  properties: { name?: string }
  geometry: unknown
}

// ISO numeric codes carry a leading zero in some sources (`004`) and not in
// others (`4`). Normalise both sides the same way so `004 === 4`.
function normNumeric(code: string | number | undefined | null): string {
  if (code == null) return ''
  return String(code).replace(/^0+/, '')
}

// --- Base map: computed once at module load, never per render ---------------

const COUNTRIES: CountryFeature[] = (
  feature(
    worldAtlas as never,
    (worldAtlas as { objects: { countries: unknown } }).objects.countries as never,
  ) as unknown as { features: CountryFeature[] }
).features

const COUNTRIES_FC = { type: 'FeatureCollection' as const, features: COUNTRIES }

const VB_W = 960
// Fit Web Mercator to the width, then crop the viewBox tightly to the drawn
// land so there is no dead vertical margin.
const PROJECTION = geoMercator().fitWidth(VB_W, COUNTRIES_FC as never)
const BASE_PATH = geoPath(PROJECTION)
const [[, minY], [, maxY]] = BASE_PATH.bounds(COUNTRIES_FC as never)
const VB_H = Math.round(maxY - minY)
const [tx, ty] = PROJECTION.translate()
PROJECTION.translate([tx, ty - minY])
const PATH = geoPath(PROJECTION)

// Country outlines never change, so build their `d` strings once.
const COUNTRY_SHAPES = COUNTRIES.map(f => ({
  cc: normNumeric(f.id),
  name: f.properties?.name ?? '',
  d: PATH(f as never),
})).filter(s => s.d)

export default function WorldMap({
  points = [],
  arcs = [],
  visitedCountries = [],
  height = 320,
  className = '',
}: WorldMapProps) {
  const visitedCodes = useMemo(() => {
    const set = new Set<string>()
    for (const alpha3 of visitedCountries) {
      const num = numericFor(alpha3)
      if (num) set.add(normNumeric(num))
    }
    return set
  }, [visitedCountries])

  const projected = useMemo(() => {
    const maxValue = Math.max(1, ...points.map(p => p.value ?? 1))
    return points.map(p => {
      const xy = PROJECTION([p.lng, p.lat])
      if (!xy) return null
      const r = 3.5 + ((p.value ?? 1) / maxValue) * 5.5
      return { id: p.id, label: p.label, x: xy[0], y: xy[1], r }
    }).filter((p): p is NonNullable<typeof p> => p !== null)
  }, [points])

  const arcShapes = useMemo(() => {
    return arcs.map(a => {
      const from = PROJECTION([a.fromLng, a.fromLat])
      const to = PROJECTION([a.toLng, a.toLat])
      if (!from || !to) return null
      const mx = (from[0] + to[0]) / 2
      const lift = Math.min(90, Math.abs(to[0] - from[0]) / 3 + 30)
      const my = (from[1] + to[1]) / 2 - lift
      return { id: a.id, d: `M ${from[0]} ${from[1]} Q ${mx} ${my} ${to[0]} ${to[1]}`, from, to }
    }).filter((a): a is NonNullable<typeof a> => a !== null)
  }, [arcs])

  return (
    <div className={className} style={{ width: '100%', height }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="世界地图，标出去过的城市与国家"
      >
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="var(--secondary)" opacity={0.35} />

        {COUNTRY_SHAPES.map(s => {
          const visited = s.cc !== '' && visitedCodes.has(s.cc)
          return (
            <path
              key={s.cc || s.name}
              d={s.d as string}
              data-cc={s.cc}
              data-name={s.name}
              data-visited={visited ? 'true' : 'false'}
              fill={visited ? 'var(--primary)' : 'var(--secondary)'}
              fillOpacity={visited ? 0.2 : 0.85}
              stroke={visited ? 'var(--primary)' : 'var(--border)'}
              strokeOpacity={visited ? 0.5 : 0.8}
              strokeWidth={0.75}
              vectorEffect="non-scaling-stroke"
            >
              {s.name && <title>{s.name}</title>}
            </path>
          )
        })}

        {arcShapes.map(a => (
          <g key={a.id}>
            <path
              d={a.d}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.4}
              strokeOpacity={0.75}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={a.from[0]} cy={a.from[1]} r={2.4} fill="var(--foreground)" opacity={0.55} />
            <circle cx={a.to[0]} cy={a.to[1]} r={2.4} fill="var(--foreground)" opacity={0.55} />
          </g>
        ))}

        {projected.map(p => (
          <g key={p.id} data-point-id={p.id}>
            <circle cx={p.x} cy={p.y} r={p.r + 3} fill="var(--primary)" opacity={0.16} />
            <circle cx={p.x} cy={p.y} r={p.r} fill="var(--primary)" opacity={0.9} />
            <title>{p.label}</title>
          </g>
        ))}
      </svg>
    </div>
  )
}
