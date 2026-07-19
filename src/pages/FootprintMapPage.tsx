import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import WorldMap from '../components/WorldMap'
import { footprintCities, addTrajectoryEntry } from '../mockData'
import type { FootprintCity } from '../types'
import { isOwnerOf } from '../auth'

type SortKey = 'visitCount' | 'lastVisit' | 'city'

const KNOWN_CITY_COORDS: Record<string, { lat: number; lng: number; country: string }> = {
  纽约: { lat: 40.7128, lng: -74.0060, country: '美国' },
  悉尼: { lat: -33.8688, lng: 151.2093, country: '澳大利亚' },
  柏林: { lat: 52.5200, lng: 13.4050, country: '德国' },
  曼谷: { lat: 13.7563, lng: 100.5018, country: '泰国' },
  香港: { lat: 22.3193, lng: 114.1694, country: '中国' },
  台北: { lat: 25.0330, lng: 121.5654, country: '中国' },
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

const emptyForm = {
  country: '',
  city: '',
  arrival: '',
  departure: '',
  visitCount: '1',
  note: '',
  linkToTrajectory: true,
}

export default function FootprintMapPage() {
  const { username } = useParams<{ username: string }>()
  const isOwner = isOwnerOf(username)

  const [cities, setCities] = useState<FootprintCity[]>(footprintCities)
  const [sortKey, setSortKey] = useState<SortKey>('visitCount')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formMsg, setFormMsg] = useState('')

  const countryCount = new Set(cities.map(c => c.country)).size
  const totalVisits = cities.reduce((s, c) => s + c.visitCount, 0)

  const sortedCities = useMemo(() => {
    const list = [...cities]
    if (sortKey === 'visitCount') list.sort((a, b) => b.visitCount - a.visitCount)
    if (sortKey === 'lastVisit') list.sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
    if (sortKey === 'city') list.sort((a, b) => a.city.localeCompare(b.city, 'zh-CN'))
    return list
  }, [cities, sortKey])

  const mapPoints = cities
    .filter(c => !c.pending)
    .map(c => ({ id: c.id, lat: c.lat, lng: c.lng, label: `${c.city} · 到访 ${c.visitCount} 次`, value: c.visitCount }))

  function handleAddVisit(e: React.FormEvent) {
    e.preventDefault()
    const city = form.city.trim()
    const country = form.country.trim()
    if (!country || !city || !form.arrival) {
      setFormMsg('请填写国家、城市和到达日期')
      return
    }
    const existing = cities.find(c => c.city === city && c.country === country)
    if (existing) {
      setFormMsg(`「${city}」已有到访记录，建议合并到已有城市而不是新增（前端原型暂不支持自动合并）。`)
      return
    }
    const matched = KNOWN_CITY_COORDS[city]
    const newCity: FootprintCity = {
      id: `fp-${Date.now()}`,
      city,
      country,
      lat: matched?.lat ?? 0,
      lng: matched?.lng ?? 0,
      firstVisit: form.arrival,
      lastVisit: form.departure || form.arrival,
      visitCount: Number(form.visitCount) || 1,
      pending: !matched,
      note: form.note.trim() || undefined,
    }
    setCities(prev => [...prev, newCity])

    if (form.linkToTrajectory) {
      addTrajectoryEntry({
        id: `tr-${Date.now()}`,
        date: form.arrival,
        city,
        country,
        summary: form.note.trim() || `到访 ${city}`,
        tags: [{ id: `tt-fp-${Date.now()}`, name: '足迹' }],
      })
    }

    setFormMsg(
      matched
        ? `已添加「${city}」到访记录，地图已同步点亮${form.linkToTrajectory ? '，并已写入人生轨迹' : ''}。`
        : `已添加「${city}」到访记录，坐标暂待人工确认，暂不会出现在地图上${form.linkToTrajectory ? '（人生轨迹记录已同步创建）' : ''}。`
    )
    setForm(emptyForm)
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
            <p className="life-kicker mb-2">足迹地图</p>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-light text-[color:var(--foreground)]">去过的地方</h1>
              <span className="text-sm text-[color:var(--muted-foreground)]">@{username}</span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              记录到城市级别，不保存精确地址或 GPS 轨迹。
            </p>
          </div>
          {isOwner && (
            <button type="button" onClick={() => setShowAddForm(v => !v)} className="life-button life-button-primary text-sm">
              {showAddForm ? '取消添加' : '添加到访记录'}
            </button>
          )}
        </div>

        <div className="life-surface mb-10 flex flex-wrap divide-x divide-[color:var(--border)]">
          <StatBlock value={countryCount} label="国家 / 地区" />
          <StatBlock value={cities.length} label="城市" />
          <StatBlock value={totalVisits} label="累计到访次数" />
        </div>

        {isOwner && showAddForm && (
          <section className="life-surface mb-10 p-6">
            <SectionTitle title="添加到访记录" desc="只保存到城市级别；没有匹配到坐标的城市会先加入列表，等待人工确认。" />
            <form onSubmit={handleAddVisit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">国家 / 地区</label>
                  <input
                    value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    placeholder="例如：日本"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">城市</label>
                  <input
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="例如：大阪"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">到达日期</label>
                  <input
                    type="date"
                    value={form.arrival}
                    onChange={e => setForm(f => ({ ...f, arrival: e.target.value }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">离开日期（可选）</label>
                  <input
                    type="date"
                    value={form.departure}
                    onChange={e => setForm(f => ({ ...f, departure: e.target.value }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">到访次数</label>
                  <input
                    type="number"
                    min={1}
                    value={form.visitCount}
                    onChange={e => setForm(f => ({ ...f, visitCount: e.target.value }))}
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-xs text-[color:var(--muted-foreground)]">
                  <input
                    type="checkbox"
                    checked={form.linkToTrajectory}
                    onChange={e => setForm(f => ({ ...f, linkToTrajectory: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-[color:var(--primary)]"
                  />
                  关联到人生轨迹
                </label>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">备注（可选）</label>
                <input
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="例如：出差、转机、旅行"
                  className="life-input w-full px-3 py-2 text-sm"
                />
              </div>
              {formMsg && <p className="text-xs text-[color:var(--primary)]">{formMsg}</p>}
              <div className="flex justify-end">
                <button type="submit" className="life-button life-button-primary text-sm">保存到访记录</button>
              </div>
            </form>
          </section>
        )}

        <section className="mb-10">
          <SectionTitle title="世界地图" desc="点的大小代表到访次数；坐标为城市中心点，仅作展示，不代表精确位置。" />
          <div className="life-surface p-4">
            <WorldMap points={mapPoints} height={340} />
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="城市列表" />
            <div className="flex gap-2">
              {([
                { key: 'visitCount', label: '按到访次数' },
                { key: 'lastVisit', label: '按最近到访' },
                { key: 'city', label: '按城市名' },
              ] as { key: SortKey; label: string }[]).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSortKey(opt.key)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    sortKey === opt.key
                      ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                      : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[color:var(--border)]">
            {sortedCities.map(city => (
              <div key={city.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">{city.city}</p>
                    <span className="text-xs text-[color:var(--muted-foreground)]">{city.country}</span>
                    {city.pending && (
                      <span className="rounded-full border border-amber-300 px-2 py-0.5 text-[10px] text-amber-600">
                        坐标待确认
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                    首次到达 {city.firstVisit} · 最近到达 {city.lastVisit}
                  </p>
                  {city.note && (
                    <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{city.note}</p>
                  )}
                </div>
                <div className="text-sm text-[color:var(--muted-foreground)]">
                  到访 <span className="font-medium text-[color:var(--foreground)]">{city.visitCount}</span> 次
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
