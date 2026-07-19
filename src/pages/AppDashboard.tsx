import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import ContentCard from '../components/ContentCard'
import { thoughtContent, recentDiary, recentNotes, recentBlog, flightRecords, footprintCities, generateHeatmapData, trashedItems } from '../mockData'

const heatmapData = generateHeatmapData()

const modules = [
  { label: '随想', to: '/euan/thoughts', count: thoughtContent.length, note: '短句和摘录' },
  { label: '日记', to: '/euan/diary', count: 83, note: '按日期记录' },
  { label: '笔记与文章', to: '/euan/pkm', count: recentNotes.length + recentBlog.length, note: '笔记和公开文章' },
  { label: '人生轨迹', to: '/euan/trajectory', count: 310, note: '时间和地点' },
  { label: '城市足迹', to: '/euan/map', count: 23, note: '到访城市' },
  { label: '飞行记录', to: '/euan/flights', count: flightRecords.length, note: '航班和里程' },
  { label: '加密空间', to: '/euan/space', count: 2, note: '私密内容' },
]

const recentContent = [...thoughtContent, ...recentDiary, ...recentNotes, ...recentBlog]
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 5)

function HeatmapGrid() {
  type HeatmapDay = (typeof heatmapData)[number]
  const weeks: HeatmapDay[][] = []
  for (let i = 0; i < heatmapData.length; i += 7) {
    weeks.push(heatmapData.slice(i, i + 7))
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day, di) => (
            <div
              key={di}
              className="heatmap-cell shrink-0"
              data-level={day.level}
              title={`${day.date}: ${day.level > 0 ? `${day.level} 条记录` : '无记录'}`}
            />
          ))}
        </div>
      ))}
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

export default function AppDashboard() {
  const todayHasDiary = false
  const monthDays = 14
  const draftCount = 3
  const totalDistance = flightRecords.reduce((s, f) => s + f.distance, 0).toLocaleString()

  return (
    <div className="life-page flex min-h-screen flex-col">
      <AppHeader />

      <main className="life-shell flex-1 py-9">
        <div className="mb-10 flex flex-col justify-between gap-5 border-b border-[color:var(--border)] pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="life-kicker mb-2">工作台</p>
            <h1 className="text-3xl font-light text-[color:var(--foreground)]">
              你好，<span className="font-medium">Euan</span>
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              {todayHasDiary ? '今天已写日记' : '今天还没有写日记，可以从一小段开始。'}
            </p>
          </div>
          <Link to="/euan" className="life-button text-sm">
            查看公开主页
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-12">
            <section>
              <SectionTitle title="内容入口" desc="常用模块和最近数量。" />
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {modules.map(mod => (
                  <Link
                    key={mod.to}
                    to={mod.to}
                    className="group flex items-center justify-between gap-4 border-b border-[color:var(--border)] py-4 no-underline transition-colors hover:border-[color:var(--accent)]"
                  >
                    <div>
                      <div className="text-base font-medium text-[color:var(--foreground)] transition-colors group-hover:text-[color:var(--primary)]">
                        {mod.label}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">{mod.note}</div>
                    </div>
                    <div className="text-sm text-[color:var(--muted-foreground)]">{mod.count}</div>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle title="最近更新" />
              <div className="border-t border-[color:var(--border)]">
                {recentContent.map(item => (
                  <ContentCard key={item.id} item={item} showVisibility compact />
                ))}
              </div>
            </section>

            <section>
              <SectionTitle title="记录日历" desc="按日期查看最近一年的记录密度。" />
              <div className="life-surface p-4">
                <HeatmapGrid />
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="text-xs text-[color:var(--muted-foreground)]">少</span>
                  {[0, 1, 2, 3, 4].map(l => (
                    <div key={l} className="heatmap-cell shrink-0" data-level={l} />
                  ))}
                  <span className="text-xs text-[color:var(--muted-foreground)]">多</span>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-10">
            <section>
              <SectionTitle title="本月" />
              <div className="space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-[color:var(--border)] pb-3">
                  <span className="text-[color:var(--muted-foreground)]">记录天数</span>
                  <span className="font-medium text-[color:var(--foreground)]">{monthDays} 天</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-[color:var(--border)] pb-3">
                  <span className="text-[color:var(--muted-foreground)]">草稿数量</span>
                  <span className="font-medium text-[color:var(--foreground)]">{draftCount}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted-foreground)]">今日日记</span>
                  <span className={todayHasDiary ? 'font-medium text-[color:var(--primary)]' : 'text-[color:var(--muted-foreground)]'}>
                    {todayHasDiary ? '已写' : '未写'}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle title="最近城市" />
              <div className="space-y-3">
                {footprintCities.slice(0, 4).map(fp => (
                  <div key={fp.id} className="flex justify-between gap-4 text-sm">
                    <span className="text-[color:var(--foreground)]">{fp.city}</span>
                    <span className="text-xs text-[color:var(--muted-foreground)]">{fp.lastVisit}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle title="飞行" />
              <div className="space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-[color:var(--border)] pb-3">
                  <span className="text-[color:var(--muted-foreground)]">总航段</span>
                  <span className="font-medium text-[color:var(--foreground)]">{flightRecords.length}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted-foreground)]">总里程</span>
                  <span className="font-medium text-[color:var(--foreground)]">{totalDistance} km</span>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle title="回收站" />
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-[color:var(--muted-foreground)]">待清理</span>
                <Link to="/trash" className="font-medium text-[color:var(--primary)] hover:underline">
                  {trashedItems.length} 条
                </Link>
              </div>
            </section>

            <section className="life-surface p-4">
              <SectionTitle title="备份" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted-foreground)]">最近备份</span>
                  <span className="text-[color:var(--foreground)]">2024-11-19</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" />
                  <span className="text-xs text-[color:var(--muted-foreground)]">运行平稳</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
