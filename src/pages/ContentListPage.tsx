import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import ContentCard from '../components/ContentCard'
import VisibilityBadge from '../components/VisibilityBadge'
import { allContent } from '../mockData'
import type { ContentItem, ThoughtType, Visibility } from '../types'
import { isOwnerOf } from '../auth'

type ContentSection = 'thoughts' | 'diary' | 'pkm'
type PkmView = 'all' | 'notes' | 'articles' | 'drafts' | 'folders' | 'tags' | 'series'
type ThoughtFilter = 'all' | ThoughtType

const sectionConfig: Record<ContentSection, { label: string; empty: string }> = {
  thoughts: { label: '随想', empty: '暂无随想' },
  diary: { label: '日记', empty: '暂无日记' },
  pkm: { label: '笔记与文章', empty: '暂无笔记与文章' },
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

const ALL_TAGS = Array.from(
  new Set(allContent.flatMap(c => c.tags.map(t => t.name)))
)

function matchesSection(item: ContentItem, section: ContentSection) {
  if (section === 'thoughts') return item.type === 'thought'
  if (section === 'pkm') return item.type === 'pkm'
  return item.type === 'diary'
}

function uniqueValues(values: (string | undefined)[]) {
  return Array.from(new Set(values.filter(Boolean) as string[]))
}

export default function ContentListPage() {
  const { username, section } = useParams<{ username: string; section: string }>()
  const sec = (section as ContentSection) || 'pkm'
  const config = sectionConfig[sec] ?? sectionConfig.pkm

  const [filterVisibility, setFilterVisibility] = useState<Visibility | 'all'>('all')
  const [filterTag, setFilterTag] = useState('')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [pkmView, setPkmView] = useState<PkmView>('all')
  const [thoughtFilter, setThoughtFilter] = useState<ThoughtFilter>('all')
  const [quickThoughtType, setQuickThoughtType] = useState<ThoughtType>('original')
  const [quickText, setQuickText] = useState('')
  const [quickSourceTitle, setQuickSourceTitle] = useState('')
  const [quickSourceAuthor, setQuickSourceAuthor] = useState('')

  const isOwner = isOwnerOf(username)

  let items = allContent.filter(c => {
    if (!matchesSection(c, sec)) return false
    if (c.author !== username) return false
    if (!isOwner && c.visibility !== 'public') return false
    return true
  })

  if (sec === 'pkm') {
    if (pkmView === 'notes') items = items.filter(c => c.contentKind === 'note')
    if (pkmView === 'articles') items = items.filter(c => c.contentKind === 'article')
    if (pkmView === 'drafts') items = items.filter(c => c.visibility === 'draft')
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

  const folders = useMemo(() => uniqueValues(items.map(item => item.folder)), [items])
  const series = useMemo(() => uniqueValues(items.map(item => item.series)), [items])
  const tags = useMemo(() => uniqueValues(items.flatMap(item => item.tags.map(tag => tag.name))), [items])

  function handleQuickThoughtSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quickText.trim()) {
      alert('请先写下一段随想')
      return
    }
    const typeLabel = quickThoughtType === 'original' ? '原创' : '摘录'
    alert(`前端原型：将创建一条${typeLabel}随想。\n\n已保存内容会进入只读展示，点击编辑后才能修改。`)
    setQuickText('')
    setQuickSourceTitle('')
    setQuickSourceAuthor('')
    setQuickThoughtType('original')
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
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-xs text-[color:var(--muted-foreground)]">
                快速输入默认创建原创；摘录可补充作者、作品、链接、页码或时间点。
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
                onClick={() => setPkmView(view.key)}
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
              {(['all', 'public', 'private', 'draft'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setFilterVisibility(v)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    filterVisibility === v
                      ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                      : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                  }`}
                >
                  {v === 'all' ? '全部' : <VisibilityBadge visibility={v} />}
                </button>
              ))}
            </div>
          )}

          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            className="life-input px-3 py-1.5 text-xs"
          >
            <option value="">所有标签</option>
            {ALL_TAGS.map(tag => (
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

        {sec === 'pkm' && pkmView === 'folders' && (
          <div className="mb-6 flex flex-wrap gap-2">
            {folders.map(folder => (
              <span key={folder} className="rounded-full bg-[color:var(--secondary)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                {folder}
              </span>
            ))}
          </div>
        )}

        {sec === 'pkm' && pkmView === 'tags' && (
          <div className="mb-6 flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="rounded-full bg-[color:var(--secondary)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {sec === 'pkm' && pkmView === 'series' && (
          <div className="mb-6 flex flex-wrap gap-2">
            {series.length ? series.map(name => (
              <span key={name} className="rounded-full bg-[color:var(--secondary)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                {name}
              </span>
            )) : (
              <span className="text-xs text-[color:var(--muted-foreground)]">暂无系列</span>
            )}
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
            <p className="text-sm text-[color:var(--muted-foreground)]">{config.empty}</p>
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
