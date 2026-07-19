import { useRef, useState } from 'react'
import { parseCsv } from '../lib/csv'
import type { FlightRecord } from '../types'

interface FlightCsvImportProps {
  existing: FlightRecord[]
  knownAirports: string[]
  onClose: () => void
  onImport: (rows: FlightRecord[]) => void
}

interface ParsedRow {
  raw: string[]
  record: FlightRecord | null
  status: 'new' | 'duplicate' | 'error'
  message?: string
}

const TEMPLATE = `日期,航空公司,航班号,出发机场,到达机场,里程,时长分钟,状态
2024-12-01,CA,CA981,PEK,NRT,2096,215,正常`

const STATUS_MAP: Record<string, FlightRecord['status']> = {
  正常: 'normal', normal: 'normal',
  延误: 'delayed', delayed: 'delayed',
  取消: 'cancelled', 退票: 'cancelled', cancelled: 'cancelled',
}

export default function FlightCsvImport({ existing, knownAirports, onClose, onImport }: FlightCsvImportProps) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function parse(text: string): ParsedRow[] {
    const allRows = parseCsv(text)
    if (allRows.length === 0) return []

    // Drop a header row if the first cell clearly isn't a date.
    const body = /^\d{4}-\d{2}-\d{2}$/.test(allRows[0]?.[0] ?? '') ? allRows : allRows.slice(1)

    const seenInFile = new Set<string>()

    return body.map(cells => {
      const [date, airline, flightNo, from, to, distance, duration, status] = cells

      if (!date || !flightNo || !from || !to) {
        return { raw: cells, record: null, status: 'error', message: '缺少必填字段（日期 / 航班号 / 出发 / 到达）' }
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { raw: cells, record: null, status: 'error', message: '日期格式应为 YYYY-MM-DD' }
      }

      // Ch 14.2: normalise before comparing so formatting noise doesn't create duplicates.
      const normFlightNo = flightNo.toUpperCase().replace(/\s+/g, '')
      const normFrom = from.toUpperCase()
      const normTo = to.toUpperCase()

      if (!knownAirports.includes(normFrom) || !knownAirports.includes(normTo)) {
        // Ch 14.3: never silently write a wrong coordinate.
        return {
          raw: cells,
          record: null,
          status: 'error',
          message: `机场代码无法匹配（${!knownAirports.includes(normFrom) ? normFrom : normTo}），需要人工确认`,
        }
      }

      const key = `${date}|${normFlightNo}`
      const isDuplicate = existing.some(f => `${f.date}|${f.flightNo}` === key) || seenInFile.has(key)
      seenInFile.add(key)

      const record: FlightRecord = {
        id: `fl-csv-${key}`,
        date,
        airline: airline || normFlightNo.slice(0, 2),
        flightNo: normFlightNo,
        from: normFrom,
        to: normTo,
        distance: Number(distance) || 0,
        durationMinutes: Number(duration) || 0,
        status: STATUS_MAP[status ?? ''] ?? 'normal',
      }

      return {
        raw: cells,
        record,
        status: isDuplicate ? 'duplicate' : 'new',
        message: isDuplicate ? '日期 + 航班号已存在，导入时跳过' : undefined,
      }
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setRows(parse(String(reader.result ?? '')))
    reader.readAsText(file)
  }

  function loadSample() {
    setFileName('示例数据')
    setRows(parse(TEMPLATE))
  }

  const newRows = rows?.filter(r => r.status === 'new') ?? []
  const dupRows = rows?.filter(r => r.status === 'duplicate') ?? []
  const errRows = rows?.filter(r => r.status === 'error') ?? []

  function handleConfirm() {
    onImport(newRows.map(r => r.record!).filter(Boolean))
  }

  return (
    <section className="life-surface mb-10 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-[color:var(--foreground)]">导入飞行记录</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
            导入前会预览每一行的结果。重复行会被跳过，无法匹配机场的行需要人工确认，不会静默写入错误坐标。
          </p>
        </div>
        <button type="button" onClick={onClose} className="life-button shrink-0 text-xs">关闭</button>
      </div>

      <div className="mb-5 rounded-[var(--radius)] bg-[color:var(--secondary)] px-4 py-3">
        <p className="mb-1.5 text-xs font-medium text-[color:var(--foreground)]">CSV 字段顺序</p>
        <pre className="overflow-x-auto text-xs leading-6 text-[color:var(--muted-foreground)]">{TEMPLATE}</pre>
      </div>

      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        <button type="button" onClick={() => fileRef.current?.click()} className="life-button text-sm">
          选择 CSV 文件
        </button>
        <button type="button" onClick={loadSample} className="life-button text-sm">
          载入示例数据
        </button>
      </div>

      {rows && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[color:var(--muted-foreground)]">{fileName} · 共 {rows.length} 行</span>
            <span className="rounded-full border border-[#D5EBD9] bg-[#EEF8F0] px-2.5 py-0.5 text-[#3F744D]">
              新增 {newRows.length}
            </span>
            <span className="rounded-full border border-[color:var(--border)] bg-white/70 px-2.5 py-0.5 text-[color:var(--muted-foreground)]">
              重复 {dupRows.length}
            </span>
            <span className="rounded-full border border-[#F3D3D3] bg-[#FDEEEE] px-2.5 py-0.5 text-[#B23B3B]">
              错误 {errRows.length}
            </span>
          </div>

          <div className="max-h-72 overflow-auto border-t border-[color:var(--border)]">
            {rows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border)] py-2.5 text-xs">
                <span
                  className={`w-12 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] ${
                    row.status === 'new'
                      ? 'bg-[#EEF8F0] text-[#3F744D]'
                      : row.status === 'duplicate'
                        ? 'bg-[color:var(--secondary)] text-[color:var(--muted-foreground)]'
                        : 'bg-[#FDEEEE] text-[#B23B3B]'
                  }`}
                >
                  {row.status === 'new' ? '新增' : row.status === 'duplicate' ? '跳过' : '错误'}
                </span>
                <span className="text-[color:var(--foreground)]">
                  {row.record
                    ? `${row.record.date} · ${row.record.flightNo} · ${row.record.from} → ${row.record.to}`
                    : row.raw.join(', ')}
                </span>
                {row.message && (
                  <span className="text-[color:var(--muted-foreground)]">{row.message}</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              只有标记为「新增」的行会被写入。
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={newRows.length === 0}
              className="life-button life-button-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              导入 {newRows.length} 条记录
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
