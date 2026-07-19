import { useMemo, useState } from 'react'

interface BatchTrajectoryFormProps {
  onClose: () => void
  onSubmit: (dates: string[], data: { city: string; country: string; summary: string; writeToMap: boolean }) => void
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

export default function BatchTrajectoryForm({ onClose, onSubmit }: BatchTrajectoryFormProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date('2024-11-20T00:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [summary, setSummary] = useState('')
  const [writeToMap, setWriteToMap] = useState(true)
  const [error, setError] = useState('')

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const sortedSelection = useMemo(() => Array.from(selected).sort(), [selected])

  function toggleDay(date: string) {
    setError('')
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  function goToMonth(delta: number) {
    setCursor(prev => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  /** Continuous range, e.g. 7/1 – 7/5. */
  function applyRange() {
    setError('')
    if (!rangeStart || !rangeEnd) {
      setError('请选择开始和结束日期')
      return
    }
    if (rangeStart > rangeEnd) {
      setError('开始日期不能晚于结束日期')
      return
    }
    const next = new Set(selected)
    const start = new Date(`${rangeStart}T00:00:00`)
    const end = new Date(`${rangeEnd}T00:00:00`)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      next.add(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`)
    }
    setSelected(next)
  }

  /** Quick presets: weekdays / weekends in the current month, or the last N days. */
  function applyPreset(preset: 'weekdays' | 'weekends' | 'last7' | 'clear') {
    setError('')
    if (preset === 'clear') {
      setSelected(new Set())
      return
    }
    const next = new Set(selected)
    if (preset === 'last7') {
      const today = new Date('2024-11-20T00:00:00')
      for (let i = 0; i < 7; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        next.add(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`)
      }
    } else {
      for (let day = 1; day <= daysInMonth; day++) {
        const weekday = new Date(cursor.year, cursor.month, day).getDay()
        const isWeekend = weekday === 0 || weekday === 6
        if ((preset === 'weekends' && isWeekend) || (preset === 'weekdays' && !isWeekend)) {
          next.add(ymd(cursor.year, cursor.month, day))
        }
      }
    }
    setSelected(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sortedSelection.length === 0) {
      setError('请至少选择一个日期')
      return
    }
    if (!city.trim()) {
      setError('请填写城市')
      return
    }
    onSubmit(sortedSelection, {
      city: city.trim(),
      country: country.trim(),
      summary: summary.trim(),
      writeToMap,
    })
  }

  return (
    <section className="life-surface mb-10 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-[color:var(--foreground)]">批量记录</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
            可以选择连续日期范围，也可以在日历里点选多个不连续的日期。
            填写一次内容后会应用到全部选中日期，之后每天仍可单独补充。
          </p>
        </div>
        <button type="button" onClick={onClose} className="life-button shrink-0 text-xs">关闭</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Range + presets */}
        <div className="flex flex-wrap items-end gap-3 border-b border-[color:var(--border)] pb-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">开始日期</label>
            <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="life-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">结束日期</label>
            <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="life-input px-3 py-2 text-sm" />
          </div>
          <button type="button" onClick={applyRange} className="life-button text-xs">添加这段范围</button>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => applyPreset('weekdays')} className="life-button text-xs">本月工作日</button>
            <button type="button" onClick={() => applyPreset('weekends')} className="life-button text-xs">本月周末</button>
            <button type="button" onClick={() => applyPreset('last7')} className="life-button text-xs">最近 7 天</button>
            <button type="button" onClick={() => applyPreset('clear')} className="life-button text-xs">清空</button>
          </div>
        </div>

        {/* Multi-select calendar */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => goToMonth(-1)} className="life-button px-2.5 py-1 text-xs" aria-label="上个月">←</button>
            <p className="text-sm font-medium text-[color:var(--foreground)]">{cursor.year} 年 {cursor.month + 1} 月</p>
            <button type="button" onClick={() => goToMonth(1)} className="life-button px-2.5 py-1 text-xs" aria-label="下个月">→</button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-[color:var(--muted-foreground)]">
            {WEEKDAY_LABELS.map(w => <div key={w} className="pb-1">{w}</div>)}
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />
              const date = ymd(cursor.year, cursor.month, day)
              const isSelected = selected.has(date)
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => toggleDay(date)}
                  className={`flex aspect-square items-center justify-center rounded-[var(--radius)] border text-xs transition-colors ${
                    isSelected
                      ? 'border-[color:var(--primary)] bg-[#EEF8F0] font-medium text-[color:var(--primary)]'
                      : 'border-[color:var(--border)] bg-white/50 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {sortedSelection.length > 0 && (
          <div className="rounded-[var(--radius)] bg-[color:var(--secondary)] px-4 py-3">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              已选 <span className="font-medium text-[color:var(--foreground)]">{sortedSelection.length}</span> 个日期：
              {sortedSelection.slice(0, 8).join('、')}
              {sortedSelection.length > 8 && ` 等 ${sortedSelection.length} 天`}
            </p>
          </div>
        )}

        {/* Shared content */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">城市</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="例如：伦敦" className="life-input w-full px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">国家 / 地区</label>
            <input value={country} onChange={e => setCountry(e.target.value)} placeholder="例如：英国" className="life-input w-full px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">这几天做了什么</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="地点、事项、学习内容和备注..." className="life-input w-full px-3 py-2 text-sm leading-7" />
          </div>
          <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)] sm:col-span-2">
            <input type="checkbox" checked={writeToMap} onChange={e => setWriteToMap(e.target.checked)} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
            为每个日期分别生成足迹到访记录
          </label>
        </div>

        {error && <p className="text-xs text-[#B23B3B]">{error}</p>}

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-[color:var(--muted-foreground)]">
            同一批创建的记录会用 batch_id 关联，之后可以选择只改某一天或整批修改。
          </p>
          <button type="submit" className="life-button life-button-primary text-sm">
            创建 {sortedSelection.length || ''} 条记录
          </button>
        </div>
      </form>
    </section>
  )
}
