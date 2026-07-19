import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import ContentCard from '../components/ContentCard'
import { visibilityConfig } from '../components/VisibilityBadge'
import { allContent, addContentItem, makeUniqueSlug } from '../mockData'
import type { ContentItem, ThoughtType, Visibility } from '../types'
import { useIsOwnerOf } from '../auth'

type ContentSection = 'thoughts' | 'diary' | 'pkm'
type PkmView = 'all' | 'notes' | 'articles' | 'drafts' | 'folders' | 'tags' | 'series'
type ThoughtFilter = 'all' | ThoughtType

const sectionConfig: Record<ContentSection, { label: string }> = {
  thoughts: { label: '随想' },
  diary: { label: '日记' },
  pkm: { label: '笔记与文章' },
}

const pkmViews: { key: PkmView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'notes', label: 'Notes' },
  { key: 'articles', label: 'Articles' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'folders', label: 'Folders' },
  { key: 'tags', label: 'Tags' },
  { key: 'series', label: 'Series' },
]

const sourceTypeLabels = {
  book: '书籍',
  article: '文章',
  video: '视频',
  podcast: '播客',
  speech: '演讲',
  webpage: '网页',
  other: '其他',
}

function matchesSection(item: ContentItem, section: ContentSection) {
  if (section === 'thoughts') return item.type === 'thought'
  if (section === 'pkm') return item.type === 'pkm'
  return item.type === 'diary'
}

/** Distinct values with how many items carry each, for the facet chips. */
function facetCounts(values: (string | undefined)[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-CN')
  )
}

interface ContentListPageProps {
  section: ContentSection
}

export default function ContentListPage({ section }: ContentListPageProps) {
  const { username } = useParams<{ username: string }>()
  const sec = section
  const config = sectionConfig[sec]

  const [filterVisibility, setFilterVisibility] = useState<Visibility | 'all'>('all')
  const [filterTag, setFilterTag] = useState('')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [pkmView, setPkmView] = useState<PkmView>('all')
  const [thoughtFilter, setThoughtFilter] = useState<ThoughtFilter>('all')
  const [quickThoughtType, setQuickThoughtType] = useState<ThoughtType>('original')
  const [quickText, setQuickText] = useState('')
  const [quickSourceTitle, setQuickSourceTitle] = useState('')
  const [quickSourceAuthor, setQuickSourceAuthor] = useState('')
  const [createdTick, setCreatedTick] = useState(0)
  const [folderFilter, setFolderFilter] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('')

  const isOwner = useIsOwnerOf(username)

  // Everything this viewer is allowed to see in this section. Facet lists are
  // derived from this, not from the filtered result, so choosing one folder
  // doesn't make every other folder disappear from the list.
  const baseItems = allContent.filter(c => {
    if (!matchesSection(c, sec)) return false
    if (c.author !== username) return false
    if (!isOwner && c.visibility !== 'public') return false
    return true
  })

  let items = baseItems

  if (sec === 'pkm') {
    if (pkmView === 'notes') items = items.filter(c => c.contentKind === 'note')
    if (pkmView === 'articles') items = items.filter(c => c.contentKind === 'article')
    if (pkmView === 'drafts') items = items.filter(c => c.visibility === 'draft')
    if (folderFilter) items = items.filter(c => c.folder === folderFilter)
    if (seriesFilter) items = items.filter(c => c.series === seriesFilter)
  }

  if (sec === 'thoughts' && thoughtFilter !== 'all') {
    items = items.filter(c => c.thoughtType === thoughtFilter)
  }

  if (filterVisibility !== 'all') {
    items = items.filter(c => c.visibility === filterVisibility)
  }
  if (filterTag) {
    items = items.filter(c => c.tags.some(t => t.name === filterTag))
  }
  if (filterKeyword) {
    const kw = filterKeyword.toLowerCase()
    items = items.filter(c =>
      c.title.toLowerCase().includes(kw) || c.summary.toLowerCase().includes(kw)
    )
  }

  // Recomputed rather than snapshotted at module load, so a tag introduced by
  // content created during this session shows up in the filter.
  const allTags = useMemo(
    () => Array.from(new Set(allContent.flatMap(c => c.tags.map(t => t.name)))).sort(),
    [createdTick]
  )

  const hasFilters =
    filterVisibility !== 'all' ||
    filterTag !== '' ||
    filterKeyword !== '' ||
    folderFilter !== '' ||
    seriesFilter !== '' ||
    (sec === 'pkm' && pkmView !== 'all') ||
    (sec === 'thoughts' && thoughtFilter !== 'all')

  const folderFacets = facetCounts(baseItems.map(item => item.folder))
  const seriesFacets = facetCounts(baseItems.map(item => item.series))
  const tagFacets = facetCounts(baseItems.flatMap(item => item.tags.map(tag => tag.name)))

  function handleQuickThoughtSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = quickText.trim()
    if (!text) {
      alert('请先写下一段随想')
      return
    }

    const now = new Date().toISOString()
    addContentItem({
      id: `c-${Date.now()}`,
      slug: makeUniqueSlug(`thought-${Date.now()}`),
      type: 'thought',
      thoughtType: quickThoughtType,
      title: text,
      body: quickThoughtType === 'excerpt'
        ? `> ${text}${quickSourceAuthor.trim() ? `\n\n作者或说话者：${quickSourceAuthor.trim()}` : ''}${quickSourceTitle.trim() ? `\n\n作品：${quickSourceTitle.trim()}` : ''}`
        : text,
      summary: text.slice(0, 60),
      // Quick capture defaults to private; visibility is changed explicitly later.
      visibility: 'private',
      tags: [],
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      author: username ?? 'euan',
      ...(quickThoughtType === 'excerpt'
        ? {
            sourceAuthor: quickSourceAuthor.trim() || undefined,
            sourceTitle: quickSourceTitle.trim() || undefined,
          }
        : {}),
    })

    setQuickText('')
    setQuickSourceTitle('')
    setQuickSourceAuthor('')
    setQuickThoughtType('original')
    setCreatedTick(t => t + 1)
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="life-shell flex-1 py-12">
        <div className="mb-10 border-b border-[color:var(--border)] pb-8">
          <div className="mb-2 flex items-baseline gap-3">
            <h1 className="text-3xl font-light text-[color:var(--foreground)]">
              {config.label}
            </h1>
            <span className="text-sm text-[color:var(--muted-foreground)]">
              @{username}
            </span>
          </div>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            {items.length} 条{config.label}
          </p>
        </div>

        {sec === 'thoughts' && isOwner && (
          <form onSubmit={handleQuickThoughtSubmit} className="mb-10 border-b border-[color:var(--border)] pb-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(['original', 'excerpt'] as ThoughtType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setQuickThoughtType(type)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    quickThoughtType === type
                      ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                      : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)]'
                  }`}
                >
                  {type === 'original' ? '原创' : '摘录'}
                </button>
              ))}
            </div>
            <textarea
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              rows={3}
              placeholder={quickThoughtType === 'original' ? '快速记一条原创随想...' : '摘录一句想长期留下的话...'}
              className="life-input w-full px-4 py-3 text-sm leading-7"
            />
            {quickThoughtType === 'excerpt' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  value={quickSourceAuthor}
                  onChange={e => setQuickSourceAuthor(e.target.value)}
                  placeholder="作者或说话者"
                  className="life-input px-3 py-2 text-sm"
                />
                <input
                  value={quickSourceTitle}
                  onChange={e => setQuickSourceTitle(e.target.value)}
                  placeholder="作品名称 / 来源"
                  className="life-input px-3 py-2 text-sm"
                />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                快速输入默认创建原创，保存后为私密。
                {quickThoughtType === 'excerpt' && (
                  <>
                    {' '}摘录在这里只填作者和作品；
                    <Link to="/new/thought" className="text-[color:var(--primary)] hover:underline">
                      完整创建页
                    </Link>
                    {' '}可补充来源类型、链接、页码或时间点。
                  </>
                )}
              </p>
              <button type="submit" className="life-button life-button-primary text-sm">
                保存随想
              </button>
            </div>
          </form>
        )}

        {sec === 'pkm' && (
          <div className="mb-7 flex flex-wrap gap-2">
            {pkmViews.map(view => (
              <button
                key={view.key}
                type="button"
                onClick={() => {
                  setPkmView(view.key)
                  // A folder/series filter left over from another view would
                  // silently hide results here.
                  setFolderFilter('')
                  setSeriesFilter('')
                  if (view.key !== 'tags') setFilterTag('')
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  pkmView === view.key
                    ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                    : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}

        {sec === 'thoughts' && (
          <div className="mb-7 flex flex-wrap gap-2">
            {(['all', 'original', 'excerpt'] as ThoughtFilter[]).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setThoughtFilter(type)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  thoughtFilter === type
                    ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                    : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                }`}
              >
                {type === 'all' ? '全部' : type === 'original' ? '原创' : '摘录'}
              </button>
            ))}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          {isOwner && (
            <div className="flex items-center gap-2">
              {(['all', 'public', 'private', 'draft'] as const).map(v => {
                const active = filterVisibility === v
                const activeClasses =
                  v === 'all'
                    ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                    : visibilityConfig[v].classes
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFilterVisibility(v)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? activeClasses
                        : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                    }`}
                  >
                    {v === 'all' ? '全部' : visibilityConfig[v].label}
                  </button>
                )
              })}
            </div>
          )}

          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            className="life-input px-3 py-1.5 text-xs"
          >
            <option value="">所有标签</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>#{tag}</option>
            ))}
          </select>

          <div className="relative">
            <input
              type="text"
              value={filterKeyword}
              onChange={e => setFilterKeyword(e.target.value)}
              placeholder="关键词搜索..."
              className="life-input w-44 py-1.5 pl-8 pr-3 text-xs sm:w-60"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="7.5" y1="7.5" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {sec === 'pkm' && (pkmView === 'folders' || pkmView === 'tags' || pkmView === 'series') && (
          <div className="mb-6">
            {(() => {
              const facets =
                pkmView === 'folders' ? folderFacets : pkmView === 'tags' ? tagFacets : seriesFacets
              const selected =
                pkmView === 'folders' ? folderFilter : pkmView === 'tags' ? filterTag : seriesFilter
              const select = (name: string) => {
                if (pkmView === 'folders') setFolderFilter(name)
                else if (pkmView === 'tags') setFilterTag(name)
                else setSeriesFilter(name)
              }
              const emptyLabel =
                pkmView === 'folders' ? '暂无文件夹' : pkmView === 'tags' ? '暂无标签' : '暂无系列'

              if (facets.length === 0) {
                return <p className="text-xs text-[color:var(--muted-foreground)]">{emptyLabel}</p>
              }

              return (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => select('')}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        selected === ''
                          ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                          : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                      }`}
                    >
                      全部
                    </button>
                    {facets.map(facet => {
                      const active = selected === facet.name
                      return (
                        <button
                          key={facet.name}
                          type="button"
                          onClick={() => select(active ? '' : facet.name)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            active
                              ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                              : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                          }`}
                        >
                          {pkmView === 'tags' ? `#${facet.name}` : facet.name}
                          <span className="ml-1.5 opacity-60">{facet.count}</span>
                        </button>
                      )
                    })}
                  </div>
                  {selected && (
                    <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                      正在按
                      {pkmView === 'folders' ? '文件夹' : pkmView === 'tags' ? '标签' : '系列'}
                      「{pkmView === 'tags' ? `#${selected}` : selected}」筛选，共 {items.length} 条。
                      <button
                        type="button"
                        onClick={() => select('')}
                        className="ml-2 text-[color:var(--primary)] hover:underline"
                      >
                        清除
                      </button>
                    </p>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {sec === 'thoughts' && items.some(item => item.thoughtType === 'excerpt') && (
          <div className="mb-6 flex flex-wrap gap-2">
            {items.filter(item => item.thoughtType === 'excerpt').map(item => (
              <span key={item.id} className="rounded-full bg-[color:var(--secondary)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                {item.sourceType ? sourceTypeLabels[item.sourceType] : '摘录'}
                {item.sourceTitle ? ` · ${item.sourceTitle}` : ''}
              </span>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {hasFilters
                ? `没有符合条件的${config.label}`
                : isOwner
                  ? `还没有${config.label}`
                  : `作者没有公开任何${config.label}哦～`}
            </p>
          </div>
        ) : (
          <div className="border-t border-[color:var(--border)]">
            {items.map(item => (
              <ContentCard key={item.id} item={item} showVisibility={isOwner} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
