import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import ContentCard from '../components/ContentCard'
import LibraryCover from '../components/LibraryCover'
import LibraryItemForm, { type LibraryItemDraft } from '../components/LibraryItemForm'
import TagFilterStrip from '../components/TagFilterStrip'
import { visibilityConfig } from '../components/VisibilityBadge'
import {
  itemsInFolder, foldersInSeries, looseItemsInSeries, allItemsInSeries, matchesLibraryKeyword,
} from '../lib/library'
import {
  removeFolder, removeSeries, listPkm, listFolders, listSeries,
  createPkm, createFolder, createSeriesEntry, saveFolder, saveSeries,
} from '../api/pkm'
import { loginUrlFor } from '../lib/redirect'
import { SITE_OWNER } from '../lib/site'
import { useAutosave } from '../hooks/useAutosave'
import { loadDraft, createKey } from '../api/drafts'
import AutosaveIndicator from '../components/AutosaveStatus'
import type { ContentItem, Folder, Series, ThoughtType, Visibility } from '../types'
import { useIsOwnerOf, useCurrentUser } from '../auth'

type ContentSection = 'thoughts' | 'diary' | 'pkm'
type PkmView = 'all' | 'notes' | 'articles' | 'drafts' | 'folders' | 'series'
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
  { key: 'series', label: 'Series' },
]

const sourceTypeLabels = {
  book: '书籍', article: '文章', video: '视频', podcast: '播客',
  speech: '演讲', webpage: '网页', other: '其他',
}

/** A route section maps to exactly one content type. */
const SECTION_TYPE: Record<ContentSection, ContentItem['type']> = {
  thoughts: 'thought',
  pkm: 'pkm',
  diary: 'diary',
}

function tagFacets(items: readonly ContentItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags) counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1)
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
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const isOwner = useIsOwnerOf(username)
  const sec = section
  const config = sectionConfig[sec]

  const [filterVisibility, setFilterVisibility] = useState<Visibility | 'all'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterKeyword, setFilterKeyword] = useState('')
  const [pkmView, setPkmView] = useState<PkmView>('all')
  const [thoughtFilter, setThoughtFilter] = useState<ThoughtFilter>('all')
  const [quickThoughtType, setQuickThoughtType] = useState<ThoughtType>('original')
  const [quickText, setQuickText] = useState('')
  const [quickSourceTitle, setQuickSourceTitle] = useState('')
  const [quickSourceAuthor, setQuickSourceAuthor] = useState('')
  const [quickDraftChecked, setQuickDraftChecked] = useState(false)
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [showSeriesForm, setShowSeriesForm] = useState(false)
  const [editingFolder, setEditingFolder] = useState(false)
  const [editingSeries, setEditingSeries] = useState(false)
  // Library and content live in a module-level mock store; this re-reads it.
  const [storeTick, setStoreTick] = useState(0)
  const bumpStore = (fn: (n: number) => number) => setStoreTick(fn)

  function setDrill(next: { folder?: string; series?: string }) {
    const params = new URLSearchParams()
    if (next.folder) params.set('folder', next.folder)
    if (next.series) params.set('series', next.series)
    setSearchParams(params)
    setEditingFolder(false)
  }

  // Every section is served by the data layer, which owns the permission
  // rules. Reading the store directly for thoughts and diary meant that with a
  // backend configured they were written to the server and then read from
  // memory — so a new entry saved fine and then did not appear.
  const [items_, setItems_] = useState<ContentItem[] | null>(null)
  const [pkmFolders, setPkmFolders] = useState<Folder[]>([])
  const [pkmSeries, setPkmSeries] = useState<Series[]>([])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    void Promise.all([
      // Archived content stays out of the default lists; the Drafts view and
      // an explicit filter are the only ways to reach it.
      listPkm({ author: username, viewer: currentUser, type: SECTION_TYPE[sec] }),
      // Folders and series only exist for notes and articles.
      sec === 'pkm' ? listFolders(username, currentUser) : Promise.resolve([]),
      sec === 'pkm' ? listSeries(username, currentUser) : Promise.resolve([]),
    ]).then(([items, fs, ss]) => {
      if (cancelled) return
      setItems_(items)
      setPkmFolders(fs)
      setPkmSeries(ss)
    })
    return () => { cancelled = true }
  }, [sec, username, currentUser, storeTick])

  const baseItems = items_ ?? []

  // A folder or series is itself metadata: its name and description would leak
  // the shape of a private library. A guest only sees ones that actually hold
  // something public.
  // The quick capture box is easy to abandon by navigating away, so it keeps
  // its own draft too.
  interface QuickDraft {
    quickText: string
    quickThoughtType: ThoughtType
    quickSourceAuthor: string
    quickSourceTitle: string
  }
  const quickAutosave = useAutosave<QuickDraft>({
    key: sec === 'thoughts' && isOwner ? createKey(currentUser ?? '', 'quick-thought') : null,
    value: { quickText, quickThoughtType, quickSourceAuthor, quickSourceTitle },
    dirty: quickText.trim().length > 0,
  })

  useEffect(() => {
    if (sec !== 'thoughts' || !isOwner || quickDraftChecked) return
    let cancelled = false
    void loadDraft<QuickDraft>(createKey(currentUser ?? '', 'quick-thought')).then(draft => {
      if (cancelled) return
      if (draft?.data.quickText) {
        setQuickText(draft.data.quickText)
        setQuickThoughtType(draft.data.quickThoughtType)
        setQuickSourceAuthor(draft.data.quickSourceAuthor)
        setQuickSourceTitle(draft.data.quickSourceTitle)
      }
      setQuickDraftChecked(true)
    })
    return () => { cancelled = true }
  }, [sec, isOwner, quickDraftChecked])

  // Supplied by the data layer, which already applied the visibility rules.
  const ownFolders = pkmFolders
  const ownSeries = pkmSeries

  // Drill-in lives in the URL so back/forward work. Resolving against the
  // filtered lists — not the raw store — means a hand-typed ?folder=<id> for a
  // private folder finds nothing, rather than rendering its name and
  // description in the detail header.
  const openFolder = ownFolders.find(f => f.id === searchParams.get('folder'))
  const openSeries = ownSeries.find(s => s.id === searchParams.get('series'))

  // A drill-in URL must restore its view too, otherwise ?folder=… loads on the
  // All tab and never opens.
  const activeView: PkmView = searchParams.get('folder')
    ? 'folders'
    : searchParams.get('series')
      ? 'series'
      : pkmView

  function applyCommonFilters(list: ContentItem[]): ContentItem[] {
    let out = list
    if (filterVisibility !== 'all') out = out.filter(c => c.visibility === filterVisibility)
    // Multi-select is a union: any selected tag matches.
    if (selectedTags.length > 0) {
      out = out.filter(c => c.tags.some(t => selectedTags.includes(t.name)))
    }
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase()
      out = out.filter(c =>
        c.title.toLowerCase().includes(kw) || c.summary.toLowerCase().includes(kw)
      )
    }
    return out
  }

  let items = baseItems
  if (sec === 'pkm') {
    if (activeView === 'notes') items = items.filter(c => c.contentKind === 'note')
    if (activeView === 'articles') items = items.filter(c => c.contentKind === 'article')
    if (activeView === 'drafts') items = items.filter(c => c.visibility === 'draft')
  }
  if (sec === 'thoughts' && thoughtFilter !== 'all') {
    items = items.filter(c => c.thoughtType === thoughtFilter)
  }
  items = applyCommonFilters(items)

  const facets = tagFacets(baseItems)
  const hasFilters =
    filterVisibility !== 'all' || selectedTags.length > 0 || filterKeyword !== '' ||
    (sec === 'pkm' && activeView !== 'all' && activeView !== 'folders' && activeView !== 'series') ||
    (sec === 'thoughts' && thoughtFilter !== 'all')

  const browsingLibrary = sec === 'pkm' && (activeView === 'folders' || activeView === 'series')

  /** New content: a guest is sent through login and returned here afterwards. */
  function handleNew() {
    const target = sec === 'pkm' ? '/new/note' : sec === 'diary' ? '/new/diary' : '/new/thought'
    navigate(currentUser ? target : loginUrlFor(target))
  }

  function handleImport() {
    const target = '/new/note?import=1'
    navigate(currentUser ? target : loginUrlFor(target))
  }

  async function handleQuickThoughtSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = quickText.trim()
    if (!text) {
      alert('请先写下一段随想')
      return
    }

    // Through the data layer like every other write. Writing to the store here
    // meant a quick thought vanished on reload once a backend was configured.
    try {
      await createPkm(currentUser ?? username ?? SITE_OWNER, {
        type: 'thought',
        title: text,
        body: quickThoughtType === 'excerpt'
          ? `> ${text}${quickSourceAuthor.trim() ? `\n\n作者或说话者：${quickSourceAuthor.trim()}` : ''}${quickSourceTitle.trim() ? `\n\n作品：${quickSourceTitle.trim()}` : ''}`
          : text,
        summary: text.slice(0, 60),
        visibility: 'private',
        tagNames: [],
        folderIds: [],
        seriesIds: [],
        thoughtType: quickThoughtType,
        ...(quickThoughtType === 'excerpt'
          ? {
              sourceAuthor: quickSourceAuthor.trim() || undefined,
              sourceTitle: quickSourceTitle.trim() || undefined,
            }
          : {}),
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败，请重试。')
      return
    }

    quickAutosave.discard()
    setQuickText('')
    setQuickSourceTitle('')
    setQuickSourceAuthor('')
    setQuickThoughtType('original')
    bumpStore(n => n + 1)
  }

  async function handleCreateFolder(draft: LibraryItemDraft) {
    await createFolder(currentUser!, {
      name: draft.name,
      description: draft.description,
      cover: draft.cover,
      seriesIds: draft.seriesIds,
    })
    setShowFolderForm(false)
    bumpStore(n => n + 1)
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!window.confirm(
      `删除文件夹「${name}」？\n\n里面的内容不会被删除，只会变成未归类。`
    )) return
    const { detached } = await removeFolder(id, currentUser!)
    setDrill({})
    bumpStore(n => n + 1)
    alert(detached > 0 ? `已删除文件夹，${detached} 条内容已变为未归类。` : '已删除文件夹。')
  }

  async function handleDeleteSeries(id: string, name: string) {
    if (!window.confirm(
      `删除系列「${name}」？\n\n里面的文件夹和内容都不会被删除，只会脱离这个系列。`
    )) return
    const { detachedFolders, detachedItems } = await removeSeries(id, currentUser!)
    setDrill({})
    bumpStore(n => n + 1)
    alert(`已删除系列。${detachedFolders} 个文件夹、${detachedItems} 条内容已脱离该系列。`)
  }

  async function handleCreateSeries(draft: LibraryItemDraft) {
    await createSeriesEntry(currentUser!, {
      name: draft.name,
      description: draft.description,
      cover: draft.cover,
    })
    setShowSeriesForm(false)
    bumpStore(n => n + 1)
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="life-shell flex-1 py-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--border)] pb-8">
          <div>
            <div className="mb-2 flex items-baseline gap-3">
              <h1 className="text-3xl font-light text-[color:var(--foreground)]">{config.label}</h1>
              <span className="text-sm text-[color:var(--muted-foreground)]">@{username}</span>
            </div>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {browsingLibrary
                ? `${ownFolders.length} 个文件夹 · ${ownSeries.length} 个系列`
                : `${items.length} 条${config.label}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {sec === 'pkm' && (
              <button type="button" onClick={handleImport} className="life-button text-sm">
                导入 Markdown
              </button>
            )}
            <button type="button" onClick={handleNew} className="life-button life-button-primary text-sm">
              + 新建
            </button>
          </div>
        </div>

        {/* Quick capture (thoughts, owner only) */}
        {sec === 'thoughts' && isOwner && (
          <form onSubmit={e => void handleQuickThoughtSubmit(e)} className="mb-10 border-b border-[color:var(--border)] pb-8">
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
                    <Link to="/new/thought" className="text-[color:var(--primary)] hover:underline">完整创建页</Link>
                    {' '}可补充来源类型、链接、页码或时间点。
                  </>
                )}
              </p>
              <span className="flex items-center gap-3">
                <AutosaveIndicator status={quickAutosave.status} savedAt={quickAutosave.savedAt} />
                <button type="submit" className="life-button life-button-primary text-sm">保存随想</button>
              </span>
            </div>
          </form>
        )}

        {/* View tabs */}
        {sec === 'pkm' && (
          <div className="mb-5 flex flex-wrap gap-2">
            {pkmViews.map(view => (
              <button
                key={view.key}
                type="button"
                onClick={() => { setPkmView(view.key); setDrill({}) }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  activeView === view.key
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
          <div className="mb-5 flex flex-wrap gap-2">
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

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {isOwner && (
            <div className="flex items-center gap-2">
              {(['all', 'public', 'private', 'draft'] as const).map(v => {
                const active = filterVisibility === v
                const activeClasses = v === 'all'
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

          <TagFilterStrip tags={facets} selected={selectedTags} onChange={setSelectedTags} />

          <div className="relative">
            <input
              type="text"
              value={filterKeyword}
              onChange={e => setFilterKeyword(e.target.value)}
              placeholder={browsingLibrary && !openFolder && !openSeries
                ? (activeView === 'folders' ? '搜索文件夹...' : '搜索系列...')
                : '关键词搜索...'}
              className="life-input w-44 py-1.5 pl-8 pr-3 text-xs sm:w-60"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="7.5" y1="7.5" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {browsingLibrary ? (
          <LibraryBrowser
            view={activeView === 'folders' ? 'folders' : 'series'}
            isOwner={isOwner}
            folders={ownFolders}
            seriesList={ownSeries}
            keyword={filterKeyword}
            baseItems={baseItems}
            applyFilters={applyCommonFilters}
            openFolder={openFolder}
            openSeries={openSeries}
            onOpenFolder={id => setDrill({ folder: id })}
            onOpenSeries={id => setDrill({ series: id })}
            onBack={() => setDrill({})}
            showFolderForm={showFolderForm}
            showSeriesForm={showSeriesForm}
            editingFolder={editingFolder}
            editingSeries={editingSeries}
            onEditSeries={setEditingSeries}
            onDeleteFolder={handleDeleteFolder}
            onDeleteSeries={handleDeleteSeries}
            onSaveSeries={async (id, draft) => {
              await saveSeries(id, currentUser!, {
                name: draft.name,
                description: draft.description,
                cover: draft.cover,
              })
              setEditingSeries(false)
              bumpStore(n => n + 1)
            }}
            onShowFolderForm={setShowFolderForm}
            onShowSeriesForm={setShowSeriesForm}
            onEditFolder={setEditingFolder}
            onCreateFolder={handleCreateFolder}
            onCreateSeries={handleCreateSeries}
            onSaveFolder={async (id, draft) => {
              await saveFolder(id, currentUser!, {
                name: draft.name,
                description: draft.description,
                cover: draft.cover,
                seriesIds: draft.seriesIds,
              })
              setEditingFolder(false)
              bumpStore(n => n + 1)
            }}
          />
        ) : (
          <>
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
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

/* ---------------- Library browser ---------------- */

interface LibraryBrowserProps {
  view: 'folders' | 'series'
  isOwner: boolean
  folders: Folder[]
  seriesList: Series[]
  baseItems: ContentItem[]
  applyFilters: (list: ContentItem[]) => ContentItem[]
  openFolder?: Folder
  openSeries?: Series
  onOpenFolder: (id: string) => void
  onOpenSeries: (id: string) => void
  onBack: () => void
  showFolderForm: boolean
  showSeriesForm: boolean
  editingFolder: boolean
  editingSeries: boolean
  onEditSeries: (v: boolean) => void
  onDeleteFolder: (id: string, name: string) => void
  onDeleteSeries: (id: string, name: string) => void
  onSaveSeries: (id: string, draft: LibraryItemDraft) => void | Promise<void>
  onShowFolderForm: (v: boolean) => void
  onShowSeriesForm: (v: boolean) => void
  onEditFolder: (v: boolean) => void
  onCreateFolder: (draft: LibraryItemDraft) => void | Promise<void>
  onCreateSeries: (draft: LibraryItemDraft) => void | Promise<void>
  onSaveFolder: (id: string, draft: LibraryItemDraft) => void | Promise<void>
  /** Shared with the content search box; filters the folder and series indexes by name. */
  keyword: string
}

function LibraryBrowser({
  view, isOwner, folders, seriesList, baseItems, applyFilters, keyword,
  openFolder, openSeries, onOpenFolder, onOpenSeries, onBack,
  showFolderForm, showSeriesForm, editingFolder, editingSeries,
  onShowFolderForm, onShowSeriesForm, onEditFolder, onEditSeries,
  onCreateFolder, onCreateSeries, onSaveFolder, onSaveSeries,
  onDeleteFolder, onDeleteSeries,
}: LibraryBrowserProps) {
  // Only the displayed lists are narrowed. `folders` itself stays whole because
  // the hierarchy helpers below need every folder to work out what belongs to
  // which series — filtering it would silently drop content from the counts.
  const matchedFolders = folders.filter(f => matchesLibraryKeyword(f, keyword))
  const matchedSeries = seriesList.filter(s => matchesLibraryKeyword(s, keyword))

  /* ----- inside a folder ----- */
  if (openFolder) {
    const notes = applyFilters(itemsInFolder(baseItems, openFolder.id))
    const parentSeries = seriesList.filter(s => (openFolder.seriesIds ?? []).includes(s.id))

    return (
      <section>
        <button type="button" onClick={onBack} className="mb-5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]">
          ← 返回文件夹
        </button>

        {editingFolder ? (
          <LibraryItemForm
            kind="folder"
            seriesOptions={seriesList}
            initial={{
              name: openFolder.name,
              description: openFolder.description ?? '',
              cover: openFolder.cover,
              seriesIds: openFolder.seriesIds ?? [],
            }}
            submitLabel="保存文件夹"
            onCancel={() => onEditFolder(false)}
            onSubmit={draft => onSaveFolder(openFolder.id, draft)}
          />
        ) : (
          <div className="mb-8 flex flex-wrap items-start gap-5 border-b border-[color:var(--border)] pb-6">
            <LibraryCover name={openFolder.name} kind="folder" cover={openFolder.cover} className="h-20 w-20 shrink-0" />
            <div className="min-w-48 flex-1">
              <h2 className="text-xl font-medium text-[color:var(--foreground)]">{openFolder.name}</h2>
              {openFolder.description && (
                <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">{openFolder.description}</p>
              )}
              <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                {notes.length} 条内容
                {parentSeries.length > 0 && (
                  <> · 属于系列「{parentSeries.map(s => s.name).join('、')}」</>
                )}
              </p>
            </div>
            {isOwner && (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => onEditFolder(true)} className="life-button text-xs">
                  设置
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFolder(openFolder.id, openFolder.name)}
                  className="life-button text-xs hover:border-[#B23B3B] hover:text-[#B23B3B]"
                >
                  删除
                </button>
              </div>
            )}
          </div>
        )}

        {notes.length === 0 ? (
          <p className="py-12 text-center text-sm text-[color:var(--muted-foreground)]">这个文件夹还没有内容。</p>
        ) : (
          <div className="border-t border-[color:var(--border)]">
            {notes.map(item => <ContentCard key={item.id} item={item} showVisibility={isOwner} />)}
          </div>
        )}
      </section>
    )
  }

  /* ----- inside a series ----- */
  if (openSeries) {
    const childFolders = foldersInSeries(folders, openSeries.id)
    const loose = applyFilters(looseItemsInSeries(baseItems, folders, openSeries.id))
    const total = allItemsInSeries(baseItems, folders, openSeries.id).length

    return (
      <section>
        <button type="button" onClick={onBack} className="mb-5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]">
          ← 返回系列
        </button>

        {editingSeries ? (
          <LibraryItemForm
            kind="series"
            initial={{
              name: openSeries.name,
              description: openSeries.description ?? '',
              cover: openSeries.cover,
            }}
            submitLabel="保存系列"
            onCancel={() => onEditSeries(false)}
            onSubmit={draft => onSaveSeries(openSeries.id, draft)}
          />
        ) : (
          <div className="mb-8 flex flex-wrap items-start gap-5 border-b border-[color:var(--border)] pb-6">
            <LibraryCover name={openSeries.name} kind="series" cover={openSeries.cover} className="h-20 w-20 shrink-0" />
            <div className="min-w-48 flex-1">
              <h2 className="text-xl font-medium text-[color:var(--foreground)]">{openSeries.name}</h2>
              {openSeries.description && (
                <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">{openSeries.description}</p>
              )}
              <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                {childFolders.length} 个文件夹 · 共 {total} 条内容
              </p>
            </div>
            {isOwner && (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => onEditSeries(true)} className="life-button text-xs">
                  设置
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSeries(openSeries.id, openSeries.name)}
                  className="life-button text-xs hover:border-[#B23B3B] hover:text-[#B23B3B]"
                >
                  删除
                </button>
              </div>
            )}
          </div>
        )}

        {childFolders.length > 0 && (
          <div className="mb-10">
            <p className="life-kicker mb-3">文件夹</p>
            <FolderGrid
              folders={childFolders.filter(f => matchesLibraryKeyword(f, keyword))}
              baseItems={baseItems}
              onOpen={onOpenFolder}
            />
          </div>
        )}

        <div>
          <p className="life-kicker mb-3">直接归入本系列的内容</p>
          {loose.length === 0 ? (
            <p className="py-8 text-center text-sm leading-6 text-[color:var(--muted-foreground)]">
              没有直接归入本系列的内容。
              <br />
              文件夹里的笔记请从上面的文件夹进入。
            </p>
          ) : (
            <div className="border-t border-[color:var(--border)]">
              {loose.map(item => <ContentCard key={item.id} item={item} showVisibility={isOwner} />)}
            </div>
          )}
        </div>
      </section>
    )
  }

  /* ----- folder index ----- */
  if (view === 'folders') {
    return (
      <section>
        {isOwner && (
          showFolderForm ? (
            <LibraryItemForm
              kind="folder"
              seriesOptions={seriesList}
              submitLabel="新建文件夹"
              onCancel={() => onShowFolderForm(false)}
              onSubmit={onCreateFolder}
            />
          ) : (
            <button type="button" onClick={() => onShowFolderForm(true)} className="life-button mb-6 text-sm">
              + 新建文件夹
            </button>
          )
        )}

        {folders.length === 0 ? (
          <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">
            {isOwner ? '还没有文件夹。' : '作者没有公开任何文件夹哦～'}
          </p>
        ) : matchedFolders.length === 0 ? (
          <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">
            没有名称或简介匹配「{keyword.trim()}」的文件夹。
          </p>
        ) : (
          <FolderGrid folders={matchedFolders} baseItems={baseItems} onOpen={onOpenFolder} />
        )}
      </section>
    )
  }

  /* ----- series index ----- */
  return (
    <section>
      {isOwner && (
        showSeriesForm ? (
          <LibraryItemForm
            kind="series"
            submitLabel="新建系列"
            onCancel={() => onShowSeriesForm(false)}
            onSubmit={onCreateSeries}
          />
        ) : (
          <button type="button" onClick={() => onShowSeriesForm(true)} className="life-button mb-6 text-sm">
            + 新建系列
          </button>
        )
      )}

      {seriesList.length === 0 ? (
        <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">
          {isOwner ? '还没有系列。' : '作者没有公开任何系列哦～'}
        </p>
      ) : matchedSeries.length === 0 ? (
        <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">
          没有名称或简介匹配「{keyword.trim()}」的系列。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matchedSeries.map(s => {
            const count = allItemsInSeries(baseItems, folders, s.id).length
            const folderCount = foldersInSeries(folders, s.id).length
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenSeries(s.id)}
                className="life-surface flex gap-4 p-4 text-left transition-colors hover:border-[color:var(--accent)]"
              >
                <LibraryCover name={s.name} kind="series" cover={s.cover} className="h-16 w-16 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--foreground)]">{s.name}</p>
                  {s.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{s.description}</p>
                  )}
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {folderCount} 个文件夹 · {count} 条内容
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function FolderGrid({
  folders, baseItems, onOpen,
}: {
  folders: Folder[]
  baseItems: ContentItem[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {folders.map(folder => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onOpen(folder.id)}
          className="life-surface flex gap-4 p-4 text-left transition-colors hover:border-[color:var(--accent)]"
        >
          <LibraryCover name={folder.name} kind="folder" cover={folder.cover} className="h-16 w-16 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[color:var(--foreground)]">{folder.name}</p>
            {folder.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{folder.description}</p>
            )}
            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
              {itemsInFolder(baseItems, folder.id).length} 条内容
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
