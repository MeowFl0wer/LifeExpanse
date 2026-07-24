import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import WorldMap from '../components/WorldMap'
import PrivateModuleGate from '../components/PrivateModuleGate'
import CitySearchInput from '../components/CitySearchInput'
import { listPlaces, addVisit } from '../api/footprint'
import { ApiError } from '../api/client'
import { countryName } from '../lib/country'
import type { FootprintPlace, FootprintCityResult } from '../types'
import { useIsOwnerOf, useCurrentUser } from '../auth'

type SortKey = 'visitCount' | 'lastVisit' | 'city'

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

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—'
}

export default function FootprintMapPage() {
  const { username } = useParams<{ username: string }>()
  const isOwner = useIsOwnerOf(username)
  const viewer = useCurrentUser()

  const [places, setPlaces] = useState<FootprintPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('visitCount')

  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedCity, setSelectedCity] = useState<FootprintCityResult | null>(null)
  const [arrival, setArrival] = useState('')
  const [note, setNote] = useState('')
  const [formMsg, setFormMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadPlaces = useCallback(async () => {
    if (!username) return
    setLoading(true)
    try {
      setPlaces(await listPlaces(username, viewer))
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [username, viewer])

  useEffect(() => {
    // Only the owner has a footprint to load; a guest sees the gate below.
    if (!isOwner) {
      setLoading(false)
      return
    }
    void loadPlaces()
  }, [isOwner, loadPlaces])

  const countryCount = useMemo(() => new Set(places.map(p => p.countryCode)).size, [places])
  const totalVisits = useMemo(() => places.reduce((s, p) => s + p.visitCount, 0), [places])
  const visitedCountries = useMemo(() => places.map(p => p.countryCode), [places])

  const sortedPlaces = useMemo(() => {
    const list = [...places]
    if (sortKey === 'visitCount') list.sort((a, b) => b.visitCount - a.visitCount)
    if (sortKey === 'lastVisit') list.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
    if (sortKey === 'city') list.sort((a, b) => a.city.localeCompare(b.city, 'zh-CN'))
    return list
  }, [places, sortKey])

  const mapPoints = useMemo(
    () => places.map(p => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      label: `${p.city} · 到访 ${p.visitCount} 次`,
      value: p.visitCount,
    })),
    [places]
  )

  async function handleAddVisit(e: React.FormEvent) {
    e.preventDefault()
    if (!username) return
    if (!selectedCity) {
      setFormMsg('请先搜索并选择城市')
      return
    }
    if (!arrival) {
      setFormMsg('请填写到达日期')
      return
    }

    setSubmitting(true)
    try {
      await addVisit(username, {
        city: selectedCity.name,
        countryCode: selectedCity.countryCode,
        visitedOn: arrival,
        note: note.trim() || undefined,
      })
      await loadPlaces()
      setFormMsg(`已记录到访「${selectedCity.name}」，地图已同步点亮。`)
      setSelectedCity(null)
      setArrival('')
      setNote('')
      setTimeout(() => {
        setShowAddForm(false)
        setFormMsg('')
      }, 2000)
    } catch (err) {
      setFormMsg(err instanceof ApiError ? err.message : '保存失败，请重试')
    } finally {
      setSubmitting(false)
    }
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

        {!isOwner ? (
          <PrivateModuleGate label="城市足迹" summary="城市足迹地图" preview="map" />
        ) : (
        <>
        <div className="life-surface mb-10 flex flex-wrap divide-x divide-[color:var(--border)]">
          <StatBlock value={countryCount} label="国家 / 地区" />
          <StatBlock value={places.length} label="城市" />
          <StatBlock value={totalVisits} label="累计到访次数" />
        </div>

        {showAddForm && (
          <section className="life-surface mb-10 p-6">
            <SectionTitle title="添加到访记录" desc="搜索并选择城市，坐标从数据集获取。每次提交记一次到访；多次到访多次提交即可。" />
            <form onSubmit={handleAddVisit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">城市</label>
                  <CitySearchInput
                    selected={selectedCity}
                    onSelect={setSelectedCity}
                    onClear={() => setSelectedCity(null)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">到达日期</label>
                  <input
                    type="date"
                    value={arrival}
                    onChange={e => setArrival(e.target.value)}
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">备注（可选）</label>
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="例如：出差、转机、旅行"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {formMsg && <p className="text-xs text-[color:var(--primary)]">{formMsg}</p>}
              <div className="flex justify-end">
                <button type="submit" disabled={submitting} className="life-button life-button-primary text-sm disabled:opacity-60">
                  {submitting ? '保存中…' : '保存到访记录'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mb-10">
          <SectionTitle title="世界地图" desc="点的大小代表到访次数；去过的国家会整体点亮。坐标为城市中心点，仅作展示。" />
          <div className="life-surface p-4">
            <WorldMap points={mapPoints} visitedCountries={visitedCountries} height={340} />
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

          {loadError && <p className="py-4 text-center text-sm text-red-600">{loadError}</p>}

          {!loadError && loading && (
            <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">加载中…</p>
          )}

          {!loadError && !loading && sortedPlaces.length === 0 && (
            <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">还没有到访记录。</p>
          )}

          {!loadError && !loading && (
            <div className="border-t border-[color:var(--border)]">
              {sortedPlaces.map(place => (
                <div key={place.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">{place.city}</p>
                      <span className="text-xs text-[color:var(--muted-foreground)]">{countryName(place.countryCode)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                      首次到达 {fmtDate(place.firstVisit)} · 最近到达 {fmtDate(place.lastVisit)}
                    </p>
                  </div>
                  <div className="text-sm text-[color:var(--muted-foreground)]">
                    到访 <span className="font-medium text-[color:var(--foreground)]">{place.visitCount}</span> 次
                  </div>
                </div>
              ))}
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
