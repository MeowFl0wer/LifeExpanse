import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import VisibilityBadge from '../components/VisibilityBadge'
import MediaInsertMenu from '../components/MediaInsertMenu'
import MarkdownRenderer from '../components/MarkdownRenderer'
import {
  getContentBySlug, updateContentItem,
  folders as allFolders, series as allSeries, addFolder, addSeries, nextId } from '../mockData'
import { extractHashTags, normaliseMembership } from '../lib/library'
import LibraryPicker from '../components/LibraryPicker'
import AutosaveIndicator from '../components/AutosaveStatus'
import DraftRestoredBanner from '../components/DraftRestoredBanner'
import { useAutosave } from '../hooks/useAutosave'
import { loadDraft, editKey, type Draft } from '../api/drafts'
import type { ContentKind, ThoughtType, Visibility } from '../types'
import { useCurrentUser } from '../auth'

type Tab = 'write' | 'preview'

/** Everything the editor holds, so a draft can restore the form exactly. */
interface EditorDraft {
  title: string
  body: string
  tagInput: string
  visibility: Visibility
  contentKind: ContentKind
  thoughtType: ThoughtType
  allowComments: boolean
  summary: string
  cover: string
  category: string
  seoTitle: string
  seoDescription: string
  favorite: boolean
  archived: boolean
  folderIds: string[]
  seriesIds: string[]
}

interface ContentEditPageProps {
  section: 'thoughts' | 'diary' | 'pkm'
}

export default function ContentEditPage({ section }: ContentEditPageProps) {
  const { username, slug } = useParams<{ username: string; slug: string }>()
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const item = getContentBySlug(slug ?? '')

  const [title, setTitle] = useState(item?.title ?? '')
  const [body, setBody] = useState(item?.body ?? '')
  const [tagInput, setTagInput] = useState(item?.tags.map(t => t.name).join(', ') ?? '')
  const [visibility, setVisibility] = useState<Visibility>(item?.visibility ?? 'public')
  const [contentKind, setContentKind] = useState<ContentKind>(item?.contentKind ?? 'note')
  const [thoughtType, setThoughtType] = useState<ThoughtType>(item?.thoughtType ?? 'original')
  const [allowComments, setAllowComments] = useState(item?.allowComments ?? false)
  const [summary, setSummary] = useState(item?.summary ?? '')
  const [cover, setCover] = useState(item?.cover ?? '')
  const [category, setCategory] = useState(item?.category ?? '')
  const [seoTitle, setSeoTitle] = useState(item?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(item?.seoDescription ?? '')
  const [favorite, setFavorite] = useState(item?.favorite ?? false)
  const [archived, setArchived] = useState(item?.archived ?? false)
  const [folderIds, setFolderIds] = useState<string[]>(item?.folderIds ?? [])
  const [seriesIds, setSeriesIds] = useState<string[]>(item?.seriesIds ?? [])
  const [, bumpLibrary] = useState(0)
  const [tab, setTab] = useState<Tab>('write')
  const [restored, setRestored] = useState<Draft<EditorDraft> | null>(null)
  const [draftChecked, setDraftChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isDirty =
    title !== (item?.title ?? '') ||
    body !== (item?.body ?? '') ||
    tagInput !== (item?.tags.map(t => t.name).join(', ') ?? '') ||
    visibility !== (item?.visibility ?? 'public') ||
    contentKind !== (item?.contentKind ?? 'note') ||
    thoughtType !== (item?.thoughtType ?? 'original') ||
    allowComments !== (item?.allowComments ?? false) ||
    summary !== (item?.summary ?? '') ||
    cover !== (item?.cover ?? '') ||
    category !== (item?.category ?? '') ||
    seoTitle !== (item?.seoTitle ?? '') ||
    seoDescription !== (item?.seoDescription ?? '') ||
    favorite !== (item?.favorite ?? false) ||
    archived !== (item?.archived ?? false) ||
    folderIds.join() !== (item?.folderIds ?? []).join() ||
    seriesIds.join() !== (item?.seriesIds ?? []).join()

  // Warn on page leave when dirty
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Everything the editor holds, so a restored draft can rebuild the form.
  const draftValue: EditorDraft = {
    title, body, tagInput, visibility, contentKind, thoughtType, allowComments,
    summary, cover, category, seoTitle, seoDescription, favorite, archived,
    folderIds, seriesIds,
  }

  const autosave = useAutosave({
    key: item ? editKey(currentUser ?? '', item.id) : null,
    value: draftValue,
    dirty: isDirty,
    baseUpdatedAt: item?.updatedAt,
  })

  // Restore an unsaved draft once, before the user starts typing.
  useEffect(() => {
    if (!item || draftChecked) return
    let cancelled = false
    void loadDraft<EditorDraft>(editKey(currentUser ?? '', item.id)).then(draft => {
      if (cancelled) { return }
      if (draft) {
        const d = draft.data
        setTitle(d.title)
        setBody(d.body)
        setTagInput(d.tagInput)
        setVisibility(d.visibility)
        setContentKind(d.contentKind)
        setThoughtType(d.thoughtType)
        setAllowComments(d.allowComments)
        setSummary(d.summary)
        setCover(d.cover)
        setCategory(d.category)
        setSeoTitle(d.seoTitle)
        setSeoDescription(d.seoDescription)
        setFavorite(d.favorite)
        setArchived(d.archived)
        setFolderIds(d.folderIds)
        setSeriesIds(d.seriesIds)
        setRestored(draft)
      }
      setDraftChecked(true)
    })
    return () => { cancelled = true }
  }, [item?.id, draftChecked])

  function handleCancel() {
    if (isDirty) {
      const confirmed = window.confirm('你有未保存的修改，确定要离开吗？')
      if (!confirmed) return
    }
    navigate(`/${username}/${section}/${slug}`)
  }

  async function handleSave() {
    if (!title.trim()) {
      alert('标题不能为空')
      return
    }
    setSaving(true)
    await new Promise(r => setTimeout(r, 900))

    const tagNames = Array.from(
      new Set([
        ...tagInput.split(/[,，]/).map(t => t.trim()).filter(Boolean),
        ...extractHashTags(body),
      ])
    )
    updateContentItem(item!.id, {
      title: title.trim(),
      body,
      visibility,
      allowComments,
      summary: summary.trim(),
      cover: cover.trim() || undefined,
      category: category.trim() || undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      favorite,
      archived,
      tags: tagNames.map(name => ({ id: nextId('tag'), name })),
      ...(item!.type === 'pkm'
        ? { contentKind, ...normaliseMembership({ folderIds, seriesIds }, allFolders) }
        : {}),
      ...(item!.type === 'thought' ? { thoughtType } : {}),
      updatedAt: new Date().toISOString(),
    })

    autosave.discard()
    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      navigate(`/${username}/${section}/${slug}`)
    }, 500)
  }

  const handleInsertMedia = useCallback((markdown: string) => {
    setBody(prev => prev + '\n\n' + markdown)
  }, [])

  if (!item) {
    return (
      <div className="life-page flex min-h-screen items-center justify-center">
        <p className="text-sm text-[color:var(--muted-foreground)]">内容不存在</p>
      </div>
    )
  }

  if (currentUser !== item.author) {
    return (
      <div className="life-page flex min-h-screen items-center justify-center">
        <p className="text-sm text-[color:var(--muted-foreground)]">你没有权限编辑这条内容</p>
      </div>
    )
  }

  const typeLabel: Record<string, string> = { diary: '日记', pkm: '笔记与文章', thought: '随想' }

  function handleContentKindChange(next: ContentKind) {
    if (contentKind === 'article' && next === 'note') {
      const confirmed = window.confirm('退回笔记状态后，公开链接和评论可能受到影响。确定继续吗？')
      if (!confirmed) return
      setAllowComments(false)
    }
    if (contentKind === 'note' && next === 'article') {
      alert('前端原型：发布为文章会保留同一个内容 ID、正文、版本历史和内部链接，并补充文章专有字段。')
    }
    setContentKind(next)
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      {/* Edit mode header */}
      <header
        className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-white/84 backdrop-blur-xl"
      >
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between h-14 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to={`/${username}/${section}/${slug}`}
                className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors shrink-0"
                onClick={e => {
                  if (isDirty) {
                    e.preventDefault()
                    const confirmed = window.confirm('你有未保存的修改，确定要离开吗？')
                    if (confirmed) navigate(`/${username}/${section}/${slug}`)
                  }
                }}
              >
                ← 只读页
              </Link>
              <span className="text-xs text-[color:var(--border)]">/</span>
              <span className="text-xs text-[color:var(--muted-foreground)] truncate">
                正在编辑：{typeLabel[item.type] ?? section}
              </span>
              {isDirty && (
                <span className="shrink-0 rounded-full border border-amber-300 px-2 py-0.5 text-[10px] text-amber-600">
                  未保存
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="life-button text-xs disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
                className="life-button life-button-primary text-xs font-medium disabled:opacity-60"
              >
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin" width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
                      <path d="M9.5 5.5a4 4 0 0 0-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    保存中...
                  </span>
                ) : saved ? '✓ 已保存' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        <div className="space-y-5">
          {restored && (
            <DraftRestoredBanner
              savedAt={restored.savedAt}
              stale={Boolean(
                restored.baseUpdatedAt && item.updatedAt && restored.baseUpdatedAt !== item.updatedAt
              )}
              onDiscard={() => {
                // Back to what is actually stored.
                setTitle(item.title)
                setBody(item.body)
                setTagInput(item.tags.map(t => t.name).join(', '))
                setVisibility(item.visibility)
                setContentKind(item.contentKind ?? 'note')
                setThoughtType(item.thoughtType ?? 'original')
                setAllowComments(item.allowComments ?? false)
                setSummary(item.summary ?? '')
                setCover(item.cover ?? '')
                setCategory(item.category ?? '')
                setSeoTitle(item.seoTitle ?? '')
                setSeoDescription(item.seoDescription ?? '')
                setFavorite(item.favorite ?? false)
                setArchived(item.archived ?? false)
                setFolderIds(item.folderIds ?? [])
                setSeriesIds(item.seriesIds ?? [])
                autosave.discard()
                setRestored(null)
              }}
            />
          )}
          {/* Title */}
          <div>
            <label htmlFor="edit-title" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
              标题
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="标题"
              className="life-input w-full px-4 py-3 text-xl font-medium"
            />
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-4 py-3 border-b border-[color:var(--border)]">
            {item.type === 'thought' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[color:var(--muted-foreground)]">类型</span>
                <div className="flex gap-1">
                  {(['original', 'excerpt'] as ThoughtType[]).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setThoughtType(v)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        thoughtType === v
                          ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                          : 'border-[color:var(--border)] text-[color:var(--muted-foreground)]'
                      }`}
                    >
                      {v === 'original' ? '原创' : '摘录'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.type === 'pkm' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[color:var(--muted-foreground)]">形态</span>
                <div className="flex gap-1">
                  {(['note', 'article'] as ContentKind[]).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleContentKindChange(v)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        contentKind === v
                          ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                          : 'border-[color:var(--border)] text-[color:var(--muted-foreground)]'
                      }`}
                    >
                      {v === 'article' ? 'Article' : 'Note'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Visibility */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--muted-foreground)]">可见性</span>
              <div className="flex gap-1">
                {(['public', 'private', 'draft'] as Visibility[]).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={`transition-opacity ${visibility === v ? '' : 'opacity-40 hover:opacity-70'}`}
                  >
                    <VisibilityBadge visibility={v} />
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs text-[color:var(--muted-foreground)] shrink-0">标签</span>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="技术, 旅行, 随想（用逗号分隔）"
                className="life-input min-w-0 flex-1 px-2 py-1 text-xs"
              />
            </div>

            {item.type === 'pkm' && contentKind === 'article' && (
              <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={e => setAllowComments(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[color:var(--primary)]"
                />
                允许注册用户评论
              </label>
            )}
          </div>

          {item.type === 'pkm' && (
            <div className="space-y-4 border-b border-[color:var(--border)] pb-4">
              <div>
                <label htmlFor="edit-summary" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                  摘要
                </label>
                <textarea
                  id="edit-summary"
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  rows={2}
                  placeholder="列表和分享卡片上显示的简介；留空会截取正文开头"
                  className="life-input w-full px-3 py-2 text-sm leading-6"
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs text-[color:var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={favorite}
                    onChange={e => setFavorite(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[color:var(--primary)]"
                  />
                  收藏
                </label>
                <label className="flex items-center gap-2 text-xs text-[color:var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={e => setArchived(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[color:var(--primary)]"
                  />
                  归档（不再出现在默认列表中）
                </label>
              </div>

              {contentKind === 'article' && (
                <div className="grid gap-3 rounded-[var(--radius)] bg-[color:var(--secondary)] p-4 sm:grid-cols-2">
                  <p className="text-xs font-medium text-[color:var(--foreground)] sm:col-span-2">
                    文章专有设置
                  </p>
                  <div>
                    <label htmlFor="edit-category" className="mb-1.5 block text-xs text-[color:var(--muted-foreground)]">
                      分类
                    </label>
                    <input
                      id="edit-category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      placeholder="例如：产品与工程"
                      className="life-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-cover" className="mb-1.5 block text-xs text-[color:var(--muted-foreground)]">
                      封面图地址
                    </label>
                    <input
                      id="edit-cover"
                      value={cover}
                      onChange={e => setCover(e.target.value)}
                      placeholder="/brand/cover.png"
                      className="life-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-seo-title" className="mb-1.5 block text-xs text-[color:var(--muted-foreground)]">
                      SEO 标题
                    </label>
                    <input
                      id="edit-seo-title"
                      value={seoTitle}
                      onChange={e => setSeoTitle(e.target.value)}
                      placeholder="留空则使用文章标题"
                      className="life-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-seo-desc" className="mb-1.5 block text-xs text-[color:var(--muted-foreground)]">
                      SEO 描述
                    </label>
                    <input
                      id="edit-seo-desc"
                      value={seoDescription}
                      onChange={e => setSeoDescription(e.target.value)}
                      placeholder="留空则使用摘要"
                      className="life-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <LibraryPicker
                folders={allFolders.filter(f => f.owner === item.author)}
                series={allSeries.filter(s => s.owner === item.author)}
                folderIds={folderIds}
                seriesIds={seriesIds}
                onChange={next => { setFolderIds(next.folderIds); setSeriesIds(next.seriesIds) }}
                onCreateFolder={name => {
                  const id = `fd-${Date.now()}`
                  addFolder({ id, owner: item.author, name, createdAt: new Date().toISOString() })
                  bumpLibrary(n => n + 1)
                  return id
                }}
                onCreateSeries={name => {
                  const id = `sr-${Date.now()}`
                  addSeries({ id, owner: item.author, name, createdAt: new Date().toISOString() })
                  bumpLibrary(n => n + 1)
                  return id
                }}
              />
            </div>
          )}

          {/* Editor toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Write / Preview tabs */}
            <div className="flex overflow-hidden rounded-full border border-[color:var(--border)] bg-white/70">
              <button
                type="button"
                onClick={() => setTab('write')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  tab === 'write'
                    ? 'bg-[color:var(--secondary)] text-[color:var(--foreground)] font-medium'
                    : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
                }`}
              >
                编写
              </button>
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={`px-3 py-1.5 text-xs border-l border-[color:var(--border)] transition-colors ${
                  tab === 'preview'
                    ? 'bg-[color:var(--secondary)] text-[color:var(--foreground)] font-medium'
                    : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
                }`}
              >
                预览
              </button>
            </div>

            {tab === 'write' && <MediaInsertMenu onInsert={handleInsertMedia} />}

            <div className="ml-auto text-xs text-[color:var(--muted-foreground)]">
              Markdown 格式
            </div>
          </div>

          {/* Body editor / preview */}
          {tab === 'write' ? (
            <div>
              <label htmlFor="edit-body" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                正文
              </label>
              <textarea
                id="edit-body"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="开始书写..."
                rows={24}
                className="life-input w-full resize-y px-4 py-3 text-sm leading-7"
                style={{ minHeight: '55vh' }}
              />
            </div>
          ) : (
            <div className="life-surface min-h-96 p-6">
              {body ? (
                <MarkdownRenderer content={body} />
              ) : (
                <p className="text-sm text-[color:var(--muted-foreground)] italic">预览区为空</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
