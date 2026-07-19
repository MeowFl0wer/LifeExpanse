import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import WorldMap from '../components/WorldMap'
import FlightCsvImport from '../components/FlightCsvImport'
import PrivateModuleGate from '../components/PrivateModuleGate'
import { flightRecords, airports } from '../mockData'
import type { FlightRecord, FlightStatus } from '../types'
import { useIsOwnerOf } from '../auth'

const statusConfig: Record<FlightStatus, { label: string; cls: string }> = {
  normal: { label: '正常', cls: 'bg-[#EEF8F0] text-[#3F744D] border-[#D5EBD9]' },
  delayed: { label: '延误', cls: 'bg-[#FFF8E9] text-[#8A6428] border-[#F3E5BD]' },
  cancelled: { label: '取消 / 退票', cls: 'bg-[#FDEEEE] text-[#B23B3B] border-[#F3D3D3]' },
}

function StatusBadge({ status }: { status: FlightStatus }) {
  const { label, cls } = statusConfig[status]
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{title}</h2>
      {desc && <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{desc}</p>}
    </div>
  )
}

function StatBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 px-5 py-4 text-center first:pl-0 last:pr-0">
      <div className="text-2xl font-light text-[color:var(--foreground)]">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">{label}</div>
    </div>
  )
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h} 小时 ${m ? `${m} 分` : ''}`.trim()
}

const emptyFlight = {
  date: '',
  airline: '',
  flightNo: '',
  from: '',
  to: '',
  distance: '',
  duration: '',
  status: 'normal' as FlightStatus,
}

export default function FlightsPage() {
  const { username } = useParams<{ username: string }>()
  const isOwner = useIsOwnerOf(username)

  const [records, setRecords] = useState<FlightRecord[]>(flightRecords)
  const [yearFilter, setYearFilter] = useState('all')
  const [airlineFilter, setAirlineFilter] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState(emptyFlight)
  const [formMsg, setFormMsg] = useState('')

  const years = useMemo(
    () => Array.from(new Set(records.map(f => f.date.slice(0, 4)))).sort().reverse(),
    [records]
  )
  const airlines = useMemo(() => Array.from(new Set(records.map(f => f.airline))).sort(), [records])

  const filtered = useMemo(() => {
    return records
      .filter(f => (yearFilter === 'all' || f.date.startsWith(yearFilter)) && (airlineFilter === 'all' || f.airline === airlineFilter))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [records, yearFilter, airlineFilter])

  const totalDistance = filtered.reduce((s, f) => s + f.distance, 0)
  const totalMinutes = filtered.reduce((s, f) => s + f.durationMinutes, 0)
  const airportCodes = Array.from(new Set(filtered.flatMap(f => [f.from, f.to])))
  const countryCount = new Set(airportCodes.map(code => airports[code]?.country).filter(Boolean)).size

  const airlineCounts = filtered.reduce<Record<string, number>>((acc, f) => {
    acc[f.airline] = (acc[f.airline] ?? 0) + 1
    return acc
  }, {})
  const topAirline = Object.entries(airlineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  const mapArcs = filtered
    .filter(f => airports[f.from] && airports[f.to])
    .map(f => {
      const from = airports[f.from]!
      const to = airports[f.to]!
      return { id: f.id, fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng }
    })
  const mapPoints = airportCodes
    .map(code => airports[code])
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map(a => ({ id: a.iata, lat: a.lat, lng: a.lng, label: `${a.city} (${a.iata})` }))

  function handleAddFlight(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date || !form.airline.trim() || !form.flightNo.trim() || !form.from || !form.to) {
      setFormMsg('请填写日期、航空公司、航班号、出发和到达机场')
      return
    }
    if (form.from === form.to) {
      setFormMsg('出发机场和到达机场不能相同')
      return
    }
    const flightNo = form.flightNo.trim().toUpperCase()
    const duplicate = records.some(f => f.date === form.date && f.flightNo === flightNo)
    if (duplicate) {
      setFormMsg('检测到疑似重复航班（日期 + 航班号相同），已跳过保存。')
      return
    }
    const rec: FlightRecord = {
      id: `fl-${Date.now()}`,
      date: form.date,
      airline: form.airline.trim(),
      flightNo,
      from: form.from,
      to: form.to,
      distance: Number(form.distance) || 0,
      durationMinutes: Number(form.duration) || 0,
      status: form.status,
    }
    setRecords(prev => [...prev, rec])
    setFormMsg(`已新增航班 ${rec.flightNo}（${rec.from} → ${rec.to}）。`)
    setForm(emptyFlight)
    setTimeout(() => {
      setShowAddForm(false)
      setFormMsg('')
    }, 2200)
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="life-shell flex-1 py-12">
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-[color:var(--border)] pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="life-kicker mb-2">飞行日志</p>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-light text-[color:var(--foreground)]">航班与航线</h1>
              <span className="text-sm text-[color:var(--muted-foreground)]">@{username}</span>
            </div>
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setShowImport(v => !v); setShowAddForm(false) }} className="life-button text-sm">
                {showImport ? '取消导入' : '导入 CSV'}
              </button>
              <button type="button" onClick={() => { setShowAddForm(v => !v); setShowImport(false) }} className="life-button life-button-primary text-sm">
                {showAddForm ? '取消添加' : '新增记录'}
              </button>
            </div>
          )}
        </div>

        {!isOwner ? (
          <PrivateModuleGate
            label="飞行记录"
            summary={`${records.length} 段航班`}
            preview="table"
          />
        ) : (
        <>
        <div className="life-surface mb-10 flex flex-wrap divide-x divide-[color:var(--border)]">
          <StatBlock value={filtered.length} label="总航段" />
          <StatBlock value={totalDistance.toLocaleString()} label="总里程 (km)" />
          <StatBlock value={formatDuration(totalMinutes)} label="总飞行时长" />
          <StatBlock value={airportCodes.length} label="到访机场" />
          <StatBlock value={countryCount} label="到访国家" />
          <StatBlock value={topAirline} label="最常乘坐" />
        </div>

        {isOwner && showImport && (
          <FlightCsvImport
            existing={records}
            knownAirports={Object.keys(airports)}
            onClose={() => setShowImport(false)}
            onImport={imported => {
              setRecords(prev => [...prev, ...imported])
              setShowImport(false)
              alert(`导入完成：新增 ${imported.length} 条飞行记录。`)
            }}
          />
        )}

        {isOwner && showAddForm && (
          <section className="life-surface mb-10 p-6">
            <SectionTitle title="新增飞行记录" desc="唯一键为日期 + 航班号，重复提交会被跳过。" />
            <form onSubmit={handleAddFlight} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">日期</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">航空公司</label>
                  <input
                    value={form.airline}
                    onChange={e => setForm(f => ({ ...f, airline: e.target.value }))}
                    placeholder="例如：CA"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">航班号</label>
                  <input
                    value={form.flightNo}
                    onChange={e => setForm(f => ({ ...f, flightNo: e.target.value }))}
                    placeholder="例如：CA981"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">出发机场</label>
                  <select
                    value={form.from}
                    onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  >
                    <option value="">请选择</option>
                    {Object.values(airports).map(a => (
                      <option key={a.iata} value={a.iata}>{a.city} ({a.iata})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">到达机场</label>
                  <select
                    value={form.to}
                    onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  >
                    <option value="">请选择</option>
                    {Object.values(airports).map(a => (
                      <option key={a.iata} value={a.iata}>{a.city} ({a.iata})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">状态</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as FlightStatus }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  >
                    <option value="normal">正常</option>
                    <option value="delayed">延误</option>
                    <option value="cancelled">取消 / 退票</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">里程数 (km)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.distance}
                    onChange={e => setForm(f => ({ ...f, distance: e.target.value }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">飞行时长（分钟）</label>
                  <input
                    type="number"
                    min={0}
                    value={form.duration}
                    onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {formMsg && <p className="text-xs text-[color:var(--primary)]">{formMsg}</p>}
              <div className="flex justify-end">
                <button type="submit" className="life-button life-button-primary text-sm">保存记录</button>
              </div>
            </form>
          </section>
        )}

        <section className="mb-10">
          <SectionTitle title="航线地图" desc="曲线代表航段，坐标为机场中心点。" />
          <div className="life-surface p-4">
            <WorldMap points={mapPoints} arcs={mapArcs} height={340} />
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="飞行记录" />
            <div className="flex flex-wrap gap-3">
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="life-input px-3 py-1.5 text-xs">
                <option value="all">所有年份</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={airlineFilter} onChange={e => setAirlineFilter(e.target.value)} className="life-input px-3 py-1.5 text-xs">
                <option value="all">所有航司</option>
                {airlines.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">
              {yearFilter !== 'all' || airlineFilter !== 'all'
                ? '没有符合筛选条件的飞行记录。'
                : isOwner
                  ? '还没有飞行记录。'
                  : '作者没有公开任何飞行记录哦～'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px] border-t border-[color:var(--border)]">
                <div className="grid grid-cols-[5.5rem_5rem_1fr_5.5rem_6.5rem_6rem] gap-3 border-b border-[color:var(--border)] py-2.5 text-xs text-[color:var(--muted-foreground)]">
                  <span>日期</span>
                  <span>航班号</span>
                  <span>航线</span>
                  <span>里程</span>
                  <span>时长</span>
                  <span>状态</span>
                </div>
                {filtered.map(f => (
                  <div key={f.id} className="grid grid-cols-[5.5rem_5rem_1fr_5.5rem_6.5rem_6rem] items-center gap-3 border-b border-[color:var(--border)] py-3 text-sm">
                    <time className="text-xs text-[color:var(--muted-foreground)]">{f.date}</time>
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">{f.flightNo}</p>
                      <p className="text-xs text-[color:var(--muted-foreground)]">{f.airline}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[color:var(--foreground)]">
                      <span>{airports[f.from]?.city ?? f.from}</span>
                      <span className="h-px w-5 bg-[color:var(--accent)]" />
                      <span>{airports[f.to]?.city ?? f.to}</span>
                    </div>
                    <span className="text-[color:var(--foreground)]">{f.distance.toLocaleString()} km</span>
                    <span className="text-xs text-[color:var(--muted-foreground)]">{formatDuration(f.durationMinutes)}</span>
                    <StatusBadge status={f.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        </>
        )}
      </main>

      <Footer />
    </div>
  )
}
