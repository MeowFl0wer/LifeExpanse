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
  height?: number
  className?: string
  showLabels?: boolean
}

const VB_W = 200
const VB_H = 100
const LAT_MIN = -56
const LAT_MAX = 75

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * VB_W
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VB_H
  return { x, y }
}

function arcPath(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const p1 = project(fromLat, fromLng)
  const p2 = project(toLat, toLng)
  const mx = (p1.x + p2.x) / 2
  const lift = Math.min(26, Math.abs(p2.x - p1.x) / 3 + 10)
  const my = (p1.y + p2.y) / 2 - lift
  return `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`
}

const LON_LINES = [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180]
const LAT_LINES = [-30, 0, 30, 60]

// Rough centroids, used only to place faint reference labels — not a claim of precise borders.
const CONTINENT_LABELS = [
  { name: '北美洲', lat: 45, lng: -100 },
  { name: '南美洲', lat: -15, lng: -60 },
  { name: '欧洲', lat: 50, lng: 15 },
  { name: '非洲', lat: 2, lng: 20 },
  { name: '亚洲', lat: 40, lng: 95 },
  { name: '大洋洲', lat: -25, lng: 135 },
]

export default function WorldMap({ points = [], arcs = [], height = 320, className = '', showLabels = true }: WorldMapProps) {
  const maxValue = Math.max(1, ...points.map(p => p.value ?? 1))

  return (
    <div className={className} style={{ width: '100%', height }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="世界地图示意">
        <rect x={0} y={0} width={VB_W} height={VB_H} rx={2} fill="var(--secondary)" opacity={0.5} />

        {LON_LINES.map(lon => {
          const { x } = project(0, lon)
          return (
            <line
              key={`lon-${lon}`}
              x1={x} y1={0} x2={x} y2={VB_H}
              stroke="var(--border)"
              strokeWidth={lon === 0 ? 0.3 : 0.15}
              opacity={lon === 0 ? 0.7 : 0.45}
            />
          )
        })}
        {LAT_LINES.map(lat => {
          const { y } = project(lat, 0)
          return (
            <line
              key={`lat-${lat}`}
              x1={0} y1={y} x2={VB_W} y2={y}
              stroke="var(--border)"
              strokeWidth={lat === 0 ? 0.3 : 0.15}
              opacity={lat === 0 ? 0.7 : 0.45}
            />
          )
        })}
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="none" stroke="var(--border)" strokeWidth={0.4} />

        {showLabels && CONTINENT_LABELS.map(label => {
          const { x, y } = project(label.lat, label.lng)
          return (
            <text
              key={label.name}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={4.2}
              fill="var(--muted-foreground)"
              opacity={0.5}
              style={{ userSelect: 'none' }}
            >
              {label.name}
            </text>
          )
        })}

        {arcs.map(arc => (
          <path
            key={arc.id}
            d={arcPath(arc.fromLat, arc.fromLng, arc.toLat, arc.toLng)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={0.4}
            opacity={0.75}
            strokeLinecap="round"
          />
        ))}

        {arcs.map(arc => {
          const from = project(arc.fromLat, arc.fromLng)
          const to = project(arc.toLat, arc.toLng)
          return (
            <g key={`${arc.id}-dots`}>
              <circle cx={from.x} cy={from.y} r={0.65} fill="var(--foreground)" opacity={0.55} />
              <circle cx={to.x} cy={to.y} r={0.65} fill="var(--foreground)" opacity={0.55} />
            </g>
          )
        })}

        {points.map(p => {
          const { x, y } = project(p.lat, p.lng)
          const r = 0.9 + ((p.value ?? 1) / maxValue) * 1.7
          return (
            <g key={p.id}>
              <circle cx={x} cy={y} r={r + 1.1} fill="var(--primary)" opacity={0.14} />
              <circle cx={x} cy={y} r={r} fill="var(--primary)" opacity={0.88} />
              <title>{p.label}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
