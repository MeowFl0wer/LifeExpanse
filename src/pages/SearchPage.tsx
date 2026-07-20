import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import ContentCard from '../components/ContentCard'
import { trajectoryEntries, footprintCities } from '../mockData'
import { listAllVisible } from '../api/pkm'
import { SITE_OWNER } from '../lib/site'
import { useCurrentUser } from '../auth'
import type { ContentItem, Visibility } from '../types'

type TypeFilter = 'all' | 'thought' | 'diary' | 'pkm' | 'trajectory' | 'place'

const typeFilters: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'thought', label: '随想' },
  { key: 'diary', label: '日记' },
  { key: 'pkm', label: '笔记与文章' },
  { key: 'trajectory', label: '人生轨迹' },
  { key: 'place', label: '城市足迹' },
]

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentUser = useCurrentUser()

  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<Visibility | 'all'>('all')
  const [tagFilter, setTagFilter] = useState('')

  const query = (searchParams.get('q') ?? '').trim().toLowerCase()

  // Ch 16: results must respect permissions — and the rule is applied in the
  // data layer, not here. Filtering `allContent` in this component meant the
  // rule had a second home that could drift, and that server-side content
  // never appeared in search at all.
  const [visibleContent, setVisibleContent] = useState<ContentItem[]>([])
  useEffect(() => {
    let cancelled = false
    // Scoped to the site owner: that is whose content the public pages show,
    // and the server needs an author to scope by. Cross-user search would
    // need a global endpoint the backend does not have yet.
    listAllVisible(SITE_OWNER, currentUser)
      .then(items => { if (!cancelled) setVisibleContent(items) })
      .catch(() => { if (!cancelled) setVisibleContent([]) })
    return () => { cancelled = true }
  }, [currentUser])

  const allTags = useMemo(
    () => Array.from(new Set(visibleContent.flatMap(c => c.tags.map(t => t.name)))).sort(),
    [visibleContent]
  )

  const contentResults = useMemo(() => {
    if (!query) return []
    return visibleContent.filter(item => {
      if (typeFilter !== 'all' && typeFilter !== 'trajectory' && typeFilter !== 'place' && item.type !== typeFilter) return false
      if (typeFilter === 'trajectory' || typeFilter === 'place') return false
      if (visibilityFilter !== 'all' && item.visibility !== visibilityFilter) return false
      if (tagFilter && !item.tags.some(t => t.name === tagFilter)) return false
      return (
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.body.toLowerCase().includes(query)
      )
    })
  }, [query, visibleContent, typeFilter, visibilityFilter, tagFilter])

  const trajectoryResults = useMemo(() => {
    if (!currentUser) return []
    if (!query || (typeFilter !== 'all' && typeFilter !== 'trajectory')) return []
    return trajectoryEntries.filter(
      e =>
        e.city.toLowerCase().includes(query) ||
        e.country.toLowerCase().includes(query) ||
        e.summary.toLowerCase().includes(query)
    )
  }, [query, typeFilter, currentUser])

  const placeResults = useMemo(() => {
    if (!currentUser) return []
    if (!query || (typeFilter !== 'all' && typeFilter !== 'place')) return []
    return footprintCities.filter(
      c => c.city.toLowerCase().includes(query) || c.country.toLowerCase().includes(query)
    )
  }, [query, typeFilter, currentUser])

  const totalCount = contentResults.length + trajectoryResults.length + placeResults.length

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearchParams(keyword.trim() ? { q: keyword.trim() } : {})
  }

  function groupLabel(item: ContentItem): string {
    if (item.type === 'thought') return '随想'
    if (item.type === 'diary') return '日记'
    return item.contentKind === 'article' ? '文章' : '笔记'
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="life-shell max-w-4xl flex-1 py-12">
        <div className="mb-8">
          <p className="life-kicker mb-2">搜索</p>
          <h1 className="text-3xl font-light text-[color:var(--foreground)]">找一段记录</h1>
        </div>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-2">
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索标题、正文、地点..."
              className="life-input flex-1 px-4 py-2.5 text-sm"
              autoFocus
            />
            <button type="submit" className="life-button life-button-primary text-sm">搜索</button>
          </div>
        </form>

        <div className="mb-6 flex flex-wrap gap-2">
          {typeFilters
            .filter(f => currentUser || (f.key !== 'trajectory' && f.key !== 'place'))
            .map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                typeFilter === f.key
                  ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                  : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mb-8 flex flex-wrap gap-3 border-b border-[color:var(--border)] pb-6">
          {currentUser && (
            <select
              value={visibilityFilter}
              onChange={e => setVisibilityFilter(e.target.value as Visibility | 'all')}
              className="life-input px-3 py-1.5 text-xs"
            >
              <option value="all">所有可见性</option>
              <option value="public">公开</option>
              <option value="private">私密</option>
              <option value="draft">草稿</option>
            </select>
          )}
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="life-input px-3 py-1.5 text-xs">
            <option value="">所有标签</option>
            {allTags.map(tag => <option key={tag} value={tag}>#{tag}</option>)}
          </select>
        </div>

        {!query ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[color:var(--muted-foreground)]">输入关键词开始搜索。</p>
            {!currentUser && (
              <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                未登录时只能搜索到公开内容；人生轨迹和城市足迹属于私密板块，需要登录。
              </p>
            )}
          </div>
        ) : totalCount === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[color:var(--muted-foreground)]">没有找到与「{query}」相关的内容。</p>
          </div>
        ) : (
          <div className="space-y-10">
            <p className="text-sm text-[color:var(--muted-foreground)]">共 {totalCount} 条结果</p>

            {contentResults.length > 0 && (
              <section>
                <h2 className="life-kicker mb-3">内容</h2>
                <div className="border-t border-[color:var(--border)]">
                  {contentResults.map(item => (
                    <div key={item.id} className="relative">
                      <span className="absolute right-0 top-6 z-10 text-[10px] text-[color:var(--muted-foreground)]">
                        {groupLabel(item)}
                      </span>
                      <ContentCard item={item} showVisibility={item.author === currentUser} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {trajectoryResults.length > 0 && (
              <section>
                <h2 className="life-kicker mb-3">人生轨迹</h2>
                <div className="border-t border-[color:var(--border)]">
                  {trajectoryResults.map(entry => (
                    <Link
                      key={entry.id}
                      to="/euan/trajectory"
                      className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-[color:var(--border)] py-4 no-underline"
                    >
                      <time className="text-xs text-[color:var(--muted-foreground)]">{entry.date}</time>
                      <div>
                        <p className="text-sm font-medium text-[color:var(--foreground)]">{entry.city}, {entry.country}</p>
                        <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{entry.summary}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {placeResults.length > 0 && (
              <section>
                <h2 className="life-kicker mb-3">城市足迹</h2>
                <div className="border-t border-[color:var(--border)]">
                  {placeResults.map(city => (
                    <Link
                      key={city.id}
                      to="/euan/map"
                      className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] py-4 no-underline"
                    >
                      <div>
                        <p className="text-sm font-medium text-[color:var(--foreground)]">{city.city}</p>
                        <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                          {city.country} · 首次 {city.firstVisit} · 最近 {city.lastVisit}
                        </p>
                      </div>
                      <span className="text-sm text-[color:var(--muted-foreground)]">{city.visitCount} 次</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <p className="mt-12 text-xs leading-6 text-[color:var(--muted-foreground)]">
          私密内容和草稿只有作者本人登录后才会出现在搜索结果中，也不会被搜索引擎索引。
          加密空间的内容和回复不参与全站搜索。
        </p>
      </main>

      <Footer />
    </div>
  )
}
