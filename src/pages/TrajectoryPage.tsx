import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import TagList from '../components/TagList'
import { trajectoryEntries, generateHeatmapData } from '../mockData'
import type { TrajectoryEntry } from '../types'
import { isOwnerOf } from '../auth'

const heatmapData = generateHeatmapData()
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function HeatmapGrid() {
  type HeatmapDay = (typeof heatmapData)[number]
  const weeks: HeatmapDay[][] = []
  for (let i = 0; i < heatmapData.length; i += 7) {
    weeks.push(heatmapData.slice(i, i + 7))
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div key={di} className="heatmap-cell shrink-0" data-level={day.level} title={`${day.date}: ${day.level > 0 ? `${day.level} 条记录` : '无记录'}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-xs text-[color:var(--muted-foreground)]">少</span>
        {[0, 1, 2, 3, 4].map(l => (
          <div key={l} className="heatmap-cell shrink-0" data-level={l} />
        ))}
        <span className="text-xs text-[color:var(--muted-foreground)]">多</span>
      </div>
    </div>
  )
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{title}</h2>
      {desc && <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{desc}</p>}
    </div>
  )
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function formatMonthLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
}

export default function TrajectoryPage() {
  const { username } = useParams<{ username: string }>()
  const isOwner = isOwnerOf(username)

  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline')
  const [cursor, setCursor] = useState(() => {
    const d = new Date('2024-11-20T00:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [filterCity, setFilterCity] = useState('')
  const [filterTag, setFilterTag] = useState('')

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TrajectoryEntry[]>()
    for (const entry of trajectoryEntries) {
      const list = map.get(entry.date) ?? []
      list.push(entry)
      map.set(entry.date, list)
    }
    return map
  }, [])

  const cities = useMemo(
    () => Array.from(new Set(trajectoryEntries.map(e => e.city))).sort(),
    []
  )
  const tags = useMemo(
    () => Array.from(new Set(trajectoryEntries.flatMap(e => e.tags.map(t => t.name)))).sort(),
    []
  )

  const filteredEntries = useMemo(() => {
    return trajectoryEntries
      .filter(e => (!filterCity || e.city === filterCity) && (!filterTag || e.tags.some(t => t.name === filterTag)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [filterCity, filterTag])

  const groupedByMonth = useMemo(() => {
    const groups: { label: string; entries: TrajectoryEntry[] }[] = []
    for (const entry of filteredEntries) {
      const label = formatMonthLabel(entry.date)
      const last = groups[groups.length - 1]
      if (last && last.label === label) {
        last.entries.push(entry)
      } else {
        groups.push({ label, entries: [entry] })
      }
    }
    return groups
  }, [filteredEntries])

  const totalCities = new Set(trajectoryEntries.map(e => e.city)).size
  const thisYearDays = new Set(trajectoryEntries.filter(e => e.date.startsWith('2024')).map(e => e.date)).size

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function goToMonth(delta: number) {
    setSelectedDate(null)
    setCursor(prev => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) ?? [] : []

  function handleRecordClick() {
    alert('前端原型：将打开人生轨迹记录表单，支持选择连续或非连续的多个日期，并把地点、事项和心得一次性应用到所有选中日期。')
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="life-shell flex-1 py-12">
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-[color:var(--border)] pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="life-kicker mb-2">人生轨迹</p>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-light text-[color:var(--foreground)]">时间与地点</h1>
              <span className="text-sm text-[color:var(--muted-foreground)]">@{username}</span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              {trajectoryEntries.length} 条记录 · 去过 {totalCities} 座城市 · 今年记录 {thisYearDays} 天
            </p>
          </div>
          {isOwner && (
            <button type="button" onClick={handleRecordClick} className="life-button life-button-primary text-sm">
              记录轨迹
            </button>
          )}
        </div>

        <section className="mb-12">
          <SectionTitle title="活跃热力图" desc="按日期查看最近一年的记录密度。" />
          <div className="life-surface p-4">
            <HeatmapGrid />
          </div>
        </section>

        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex overflow-hidden rounded-full border border-[color:var(--border)] bg-white/70">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-1.5 text-xs transition-colors ${viewMode === 'timeline' ? 'bg-[color:var(--secondary)] font-medium text-[color:var(--foreground)]' : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'}`}
            >
              时间线
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`border-l border-[color:var(--border)] px-4 py-1.5 text-xs transition-colors ${viewMode === 'calendar' ? 'bg-[color:var(--secondary)] font-medium text-[color:var(--foreground)]' : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'}`}
            >
              月历
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="life-input px-3 py-1.5 text-xs"
            >
              <option value="">所有城市</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              className="life-input px-3 py-1.5 text-xs"
            >
              <option value="">所有标签</option>
              {tags.map(tag => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <section>
            <div className="life-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <button type="button" onClick={() => goToMonth(-1)} className="life-button px-2.5 py-1 text-xs" aria-label="上个月">
                  ←
                </button>
                <p className="text-sm font-medium text-[color:var(--foreground)]">{cursor.year} 年 {cursor.month + 1} 月</p>
                <button type="button" onClick={() => goToMonth(1)} className="life-button px-2.5 py-1 text-xs" aria-label="下个月">
                  →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-[color:var(--muted-foreground)]">
                {WEEKDAY_LABELS.map(w => <div key={w} className="pb-1">{w}</div>)}
                {calendarCells.map((day, idx) => {
                  if (day === null) return <div key={`empty-${idx}`} />
                  const date = ymd(cursor.year, cursor.month, day)
                  const hasEntry = entriesByDate.has(date)
                  const isSelected = selectedDate === date
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedDate(isSelected ? null : date)}
                      className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[var(--radius)] border text-xs transition-colors ${
                        isSelected
                          ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                          : hasEntry
                            ? 'border-[color:var(--accent)]/50 bg-white text-[color:var(--foreground)] hover:border-[color:var(--primary)]'
                            : 'border-[color:var(--border)] bg-white/50 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                      }`}
                    >
                      <span>{day}</span>
                      {hasEntry && <span className="h-1 w-1 rounded-full bg-[color:var(--accent)]" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-6">
              {selectedDate ? (
                selectedEntries.length > 0 ? (
                  <div className="space-y-4">
                    {selectedEntries.map(entry => (
                      <div key={entry.id} className="life-surface p-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <p className="text-sm font-medium text-[color:var(--foreground)]">{entry.city}, {entry.country}</p>
                          <time className="text-xs text-[color:var(--muted-foreground)]">{entry.date}</time>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">{entry.summary}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <TagList tags={entry.tags} small />
                          <div className="flex items-center gap-3">
                            {entry.diarySlug && (
                              <Link to={`/${username}/diary/${entry.diarySlug}`} className="text-xs text-[color:var(--primary)] hover:underline">
                                查看关联日记 →
                              </Link>
                            )}
                            {isOwner && (
                              <button type="button" onClick={() => alert('前端原型：这里会打开轨迹编辑表单。')} className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
                                编辑
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-[color:var(--muted-foreground)]">{selectedDate} 没有记录。</p>
                )
              ) : (
                <p className="py-6 text-center text-sm text-[color:var(--muted-foreground)]">点击日历中的某一天，查看当天的全部记录。</p>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-10">
            {groupedByMonth.length === 0 ? (
              <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">没有符合筛选条件的记录。</p>
            ) : (
              groupedByMonth.map(group => (
                <div key={group.label}>
                  <p className="life-kicker mb-3">{group.label}</p>
                  <div className="border-t border-[color:var(--border)]">
                    {group.entries.map(entry => (
                      <div key={entry.id} className="grid grid-cols-1 gap-2 border-b border-[color:var(--border)] py-5 sm:grid-cols-[5.5rem_1fr]">
                        <time className="text-xs text-[color:var(--muted-foreground)]">{entry.date}</time>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[color:var(--foreground)]">{entry.city}, {entry.country}</p>
                          <p className="mt-1 text-sm leading-7 text-[color:var(--muted-foreground)]">{entry.summary}</p>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <TagList tags={entry.tags} small />
                            {entry.diarySlug && (
                              <Link to={`/${username}/diary/${entry.diarySlug}`} className="text-xs text-[color:var(--primary)] hover:underline">
                                查看关联日记 →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
