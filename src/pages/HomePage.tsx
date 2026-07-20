import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '../auth'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import ContentCard from '../components/ContentCard'
import TagList from '../components/TagList'
import {
  euanProfile,
  trajectoryEntries,
  footprintCities,
  flightRecords,
} from '../mockData'
import { listPkm } from '../api/pkm'
import type { ContentItem } from '../types'

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-[color:var(--border)] pb-3">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{title}</h2>
      <Link
        to={to}
        className="text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary)]"
      >
        查看全部
      </Link>
    </div>
  )
}

function QuietStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="text-xl font-medium leading-none text-[color:var(--foreground)]">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">{label}</div>
    </div>
  )
}

const heroOptions: Record<string, string> = {
  '1': '/brand/hero-lifeexpanse-ref-1.jpg',
  '2': '/brand/hero-lifeexpanse-ref-2.jpg',
  '3': '/brand/hero-lifeexpanse-ref-3.jpg',
}

export default function HomePage() {
  const [searchParams] = useSearchParams()
  const currentUser = useCurrentUser()
  const heroKey = searchParams.get('hero') ?? '2'
  const heroSrc = heroOptions[heroKey] ?? heroOptions['2']
  // Through the data layer, with `viewer: null` so this shows exactly what a
  // visitor sees — the page does not decide that for itself.
  const [publicDiary, setPublicDiary] = useState<ContentItem[]>([])
  const [publicPkm, setPublicPkm] = useState<ContentItem[]>([])
  const [publicThoughts, setPublicThoughts] = useState<ContentItem[]>([])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      listPkm({ author: 'euan', viewer: null, type: 'diary' }),
      listPkm({ author: 'euan', viewer: null, type: 'pkm' }),
      listPkm({ author: 'euan', viewer: null, type: 'thought' }),
    ]).then(([diary, pkm, thoughts]) => {
      if (cancelled) return
      setPublicDiary(diary)
      setPublicPkm(pkm)
      setPublicThoughts(thoughts)
    })
    return () => { cancelled = true }
  }, [])

  const publicTotal = publicDiary.length + publicPkm.length + publicThoughts.length
  const totalDistance = flightRecords.reduce((s, f) => s + f.distance, 0).toLocaleString()

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="life-hero relative overflow-hidden">
          <picture className="absolute inset-0 z-0">
            <img
              src={heroSrc}
              alt=""
              className="life-hero-image w-full object-cover object-center"
              aria-hidden="true"
            />
          </picture>
          <div className="life-hero-scrim absolute inset-0 z-0" />

          <div className="life-shell relative z-10 grid min-h-[680px] items-center gap-10 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
            <div className="max-w-2xl">
              <img
                src="/brand/lifeexpanse-logo.png"
                alt="LifeExpanse"
                className="mb-10 h-auto w-80 max-w-full"
              />
              <p className="life-kicker mb-4">个人纪录与分享</p>
              <h1 className="max-w-2xl text-4xl font-light leading-tight text-[color:var(--foreground)] sm:text-5xl lg:text-6xl">
                记录你的
                <span className="life-hero-emphasis font-medium">人生轨迹</span>
              </h1>
              <p className="mt-6 max-w-xl text-base font-light leading-8 text-[color:var(--foreground)]">
                毕竟我们只有一生这么长，要用力给人间留下些印象
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/euan/pkm" className="life-button life-button-primary text-sm">
                  看笔记与文章
                </Link>
                <Link to={currentUser ? '/app' : '/login'} className="life-button text-sm">
                  进入工作台
                </Link>
              </div>
            </div>

            <div className="justify-self-start lg:justify-self-end">
              <div className="flex items-center gap-4 rounded-[var(--radius)] border border-white/70 bg-white/72 p-4 backdrop-blur-md">
                <img
                  src={euanProfile.avatar}
                  alt={euanProfile.displayName}
                  className="h-16 w-16 rounded-full border border-[color:var(--border)] object-cover"
                />
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-medium text-[color:var(--foreground)]">{euanProfile.displayName}</p>
                    <p className="text-sm text-[color:var(--muted-foreground)]">@{euanProfile.username}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-6">
                    <QuietStat value={publicTotal} label="内容" />
                    <QuietStat value={footprintCities.length} label="城市" />
                    <QuietStat value={flightRecords.length} label="航段" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="life-shell py-8 lg:py-12">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-12">
              <section>
                <SectionHeader title="最近日记" to="/euan/diary" />
                {publicDiary.map(item => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </section>

              <section>
                <SectionHeader title="最近笔记与文章" to="/euan/pkm" />
                {publicPkm.map(item => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </section>
            </div>

            <aside className="space-y-10">
              <section>
                <SectionHeader title="最近随想" to="/euan/thoughts" />
                <div className="space-y-5">
                  {publicThoughts.length === 0 && (
                    <p className="text-sm text-[color:var(--muted-foreground)]">作者没有公开任何随想哦～</p>
                  )}
                  {publicThoughts.slice(0, 3).map(q => (
                    <blockquote
                      key={q.id}
                      className="border-l-2 border-[color:var(--accent)] py-1 pl-4"
                    >
                      <p className="text-sm leading-7 text-[color:var(--foreground)]">{q.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                        <span className="rounded-full bg-[color:var(--secondary)] px-2 py-0.5">
                          {q.thoughtType === 'excerpt' ? '摘录' : '原创'}
                        </span>
                        {q.sourceTitle && <span>{q.sourceTitle}</span>}
                      </div>
                      {q.personalNote && (
                        <footer className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                          {q.personalNote}
                        </footer>
                      )}
                      <TagList tags={q.tags} className="mt-3" small />
                    </blockquote>
                  ))}
                </div>
              </section>

              {currentUser ? (
                <>
                  <section>
                    <SectionHeader title="人生轨迹" to="/euan/trajectory" />
                    <div className="space-y-3">
                      {trajectoryEntries.slice(0, 4).map(entry => (
                        <div key={entry.id} className="grid grid-cols-[5.4rem_1fr] gap-3 border-b border-[color:var(--border)] pb-3 last:border-0">
                          <time className="text-xs text-[color:var(--muted-foreground)]">{entry.date}</time>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-[color:var(--foreground)]">
                              {entry.city}, {entry.country}
                            </span>
                            <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">{entry.summary}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <SectionHeader title="城市足迹" to="/euan/map" />
                    <div className="flex flex-wrap gap-2">
                      {footprintCities.map(fp => (
                        <span
                          key={fp.id}
                          className="rounded-full border border-[color:var(--border)] bg-white/70 px-3 py-1 text-xs text-[color:var(--muted-foreground)]"
                        >
                          {fp.city}
                          <span className="ml-1 opacity-60">{fp.visitCount}x</span>
                        </span>
                      ))}
                    </div>
                  </section>

                  <section>
                    <SectionHeader title="飞行记录" to="/euan/flights" />
                    <div className="text-sm text-[color:var(--muted-foreground)]">
                      <div className="flex justify-between gap-4">
                        <span>总里程</span>
                        <span className="font-medium text-[color:var(--foreground)]">{totalDistance} km</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {flightRecords.slice(0, 3).map(f => (
                          <div key={f.id} className="flex items-center gap-2 text-xs">
                            <span className="w-14 shrink-0 font-medium text-[color:var(--foreground)]">{f.flightNo}</span>
                            <span>{f.from}</span>
                            <span className="h-px w-5 bg-[color:var(--accent)]" />
                            <span>{f.to}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                /* Private by default: a guest sees only that these modules
                   exist and how much is in them, never the entries. */
                <section>
                  <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-[color:var(--border)] pb-3">
                    <h2 className="text-base font-medium text-[color:var(--foreground)]">私密板块</h2>
                    <Link to="/login" className="text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary)]">
                      登录查看
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: '人生轨迹', to: '/euan/trajectory', count: `${trajectoryEntries.length} 条记录` },
                      { label: '城市足迹', to: '/euan/map', count: `${footprintCities.length} 座城市` },
                      { label: '飞行记录', to: '/euan/flights', count: `${flightRecords.length} 段航班` },
                    ].map(m => (
                      <Link
                        key={m.to}
                        to={m.to}
                        className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] pb-3 no-underline last:border-0"
                      >
                        <span className="text-sm text-[color:var(--foreground)]">{m.label}</span>
                        <span className="text-xs text-[color:var(--muted-foreground)]">{m.count}</span>
                      </Link>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    隐私内容请登录后查看。
                  </p>
                </section>
              )}
            </aside>
          </div>
        </section>

        <section className="life-meadow-band mt-8 overflow-hidden">
          <div className="life-shell flex min-h-[340px] items-end pb-14 pt-32">
            <p className="max-w-xl rounded-[var(--radius)] border border-white/55 bg-white/76 px-4 py-3 text-sm leading-7 text-[color:var(--foreground)] shadow-[0_18px_50px_rgba(19,31,33,0.14)] backdrop-blur-md">
              人生人山人海人来人往，自己自尊自爱自由自在。
            </p>
          </div>
          <Footer variant="expanse" />
        </section>
      </main>
    </div>
  )
}
