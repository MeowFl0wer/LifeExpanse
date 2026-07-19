import { Link } from 'react-router-dom'

interface PrivateModuleGateProps {
  /** Module name, e.g. 人生轨迹 */
  label: string
  /** What exists, without revealing it — e.g. "8 条记录 · 7 座城市" */
  summary: string
  /** Shape of the redacted preview below the notice. */
  preview?: 'rows' | 'map' | 'table'
}

/**
 * Guest view for a module whose contents are private by default.
 *
 * The blurred bars below are placeholders, not real records with a CSS filter
 * over them: no private value is placed in the DOM, so nothing is recoverable
 * from devtools or view-source. Only the aggregate count is disclosed, which
 * is what tells a visitor the module is not empty.
 */
export default function PrivateModuleGate({ label, summary, preview = 'rows' }: PrivateModuleGateProps) {
  return (
    <section>
      <div className="life-surface relative overflow-hidden">
        {/* Redacted placeholder — decorative only */}
        <div aria-hidden="true" className="pointer-events-none select-none blur-[6px] opacity-55">
          {preview === 'map' && <MapSkeleton />}
          {preview === 'rows' && <RowSkeleton />}
          {preview === 'table' && <TableSkeleton />}
        </div>

        {/* Notice */}
        <div className="absolute inset-0 flex items-center justify-center bg-white/45 px-6 backdrop-blur-[2px]">
          <div className="text-center">
            <svg
              width="22" height="22" viewBox="0 0 22 22" fill="none"
              className="mx-auto mb-3 text-[color:var(--muted-foreground)]"
              aria-hidden="true"
            >
              <rect x="4" y="9.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7.5 9.5V7a3.5 3.5 0 1 1 7 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              隐私内容请登录后查看
            </p>
            <p className="mt-1.5 text-xs text-[color:var(--muted-foreground)]">
              {label} · {summary}
            </p>
            <Link to="/login" className="life-button life-button-primary mt-4 text-sm">
              登录查看
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-6 text-[color:var(--muted-foreground)]">
        {label}默认不公开。这里只显示有多少条记录，具体内容需要作者本人登录后才能查看。
      </p>
    </section>
  )
}

function Bar({ w }: { w: string }) {
  return <div className="h-3 rounded-full bg-[color:var(--muted)]" style={{ width: w }} />
}

function RowSkeleton() {
  const widths = ['62%', '48%', '71%', '55%', '66%', '43%']
  return (
    <div className="space-y-5 p-6">
      {widths.map((w, i) => (
        <div key={i} className="grid grid-cols-[5rem_1fr] gap-4">
          <Bar w="70%" />
          <Bar w={w} />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="grid grid-cols-[4.5rem_4rem_1fr_4rem_4rem] gap-3">
          <Bar w="80%" />
          <Bar w="70%" />
          <Bar w="55%" />
          <Bar w="75%" />
          <Bar w="60%" />
        </div>
      ))}
    </div>
  )
}

function MapSkeleton() {
  const dots = [
    { x: '18%', y: '32%' }, { x: '31%', y: '54%' }, { x: '47%', y: '28%' },
    { x: '58%', y: '44%' }, { x: '72%', y: '36%' }, { x: '81%', y: '61%' },
  ]
  return (
    <div className="relative h-64 w-full bg-[color:var(--secondary)]">
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute h-3 w-3 rounded-full bg-[color:var(--accent)]"
          style={{ left: d.x, top: d.y }}
        />
      ))}
    </div>
  )
}
