import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import VisibilityBadge from '../components/VisibilityBadge'
import MediaInsertMenu from '../components/MediaInsertMenu'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { useCurrentUser } from '../auth'
import {
  addContentItem, addTrajectoryEntry, recordFootprintVisit, makeUniqueSlug,
  folders as allFolders, series as allSeries, addFolder, addSeries,
} from '../mockData'
import { slugify } from '../lib/slug'
import { extractHashTags, normaliseMembership } from '../lib/library'
import LibraryPicker from '../components/LibraryPicker'
import type { ContentItem, ContentKind, ContentType, ThoughtType, ThoughtSourceType, Visibility } from '../types'

type CreateType = 'thought' | 'diary' | 'note' | 'article' | 'trajectory'
type Tab = 'write' | 'preview'

const typeConfig: Record<CreateType, { label: string; section: string; titlePlaceholder: string; bodyPlaceholder: string; requiresTitle: boolean }> = {
  thought: { label: '随想', section: 'thoughts', titlePlaceholder: '标题（可不填）', bodyPlaceholder: '写下一句想长期留下的话...', requiresTitle: false },
  diary: { label: '日记', section: 'diary', titlePlaceholder: '今天的标题', bodyPlaceholder: '今天发生了什么...', requiresTitle: true },
  note: { label: '笔记', section: 'pkm', titlePlaceholder: '笔记标题', bodyPlaceholder: '开始记录...', requiresTitle: true },
  article: { label: '文章', section: 'pkm', titlePlaceholder: '文章标题', bodyPlaceholder: '开始写作...', requiresTitle: true },
  trajectory: { label: '人生轨迹', section: 'trajectory', titlePlaceholder: '这一天的标题（可不填）', bodyPlaceholder: '做了什么、学了什么、有什么心得...', requiresTitle: false },
}

const sourceTypeOptions: { value: ThoughtSourceType; label: string }[] = [
  { value: 'book', label: '书籍' },
  { value: 'article', label: '文章' },
  { value: 'video', label: '视频' },
  { value: 'podcast', label: '播客' },
  { value: 'speech', label: '演讲' },
  { value: 'webpage', label: '网页' },
  { value: 'other', label: '其他' },
]

export default function ContentCreatePage() {
  const { type } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const currentUser = useCurrentUser()

  const createType = (type as CreateType) in typeConfig ? (type as CreateType) : 'note'
  const config = typeConfig[createType]

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [contentKind, setContentKind] = useState<ContentKind>(createType === 'article' ? 'article' : 'note')
  const [thoughtType, setThoughtType] = useState<ThoughtType>('original')
  const [tab, setTab] = useState<Tab>('write')
  const [saving, setSaving] = useState(false)

  // Thought excerpt fields (Ch 8.1)
  const [sourceAuthor, setSourceAuthor] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceType, setSourceType] = useState<ThoughtSourceType>('book')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceLocator, setSourceLocator] = useState('')

  // Trajectory fields (Ch 12.1)
  const [trajDate, setTrajDate] = useState('')
  const [trajCity, setTrajCity] = useState('')
  const [trajCountry, setTrajCountry] = useState('')
  const [trajWriteToMap, setTrajWriteToMap] = useState(true)

  // Library placement (notes and articles only)
  const [folderIds, setFolderIds] = useState<string[]>([])
  const [seriesIds, setSeriesIds] = useState<string[]>([])
  const [, bumpLibrary] = useState(0)

  function createFolder(name: string): string {
    const id = `fd-${Date.now()}`
    addFolder({ id, owner: currentUser ?? 'euan', name, createdAt: new Date().toISOString() })
    bumpLibrary(n => n + 1)
    return id
  }

  function createSeries(name: string): string {
    const id = `sr-${Date.now()}`
    addSeries({ id, owner: currentUser ?? 'euan', name, createdAt: new Date().toISOString() })
    bumpLibrary(n => n + 1)
    return id
  }

  // #tags typed into the body are captured alongside the comma-separated field.
  const inlineTags = extractHashTags(body)

  const isDirty = Boolean(title || body || tagInput || trajCity || sourceTitle)

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

  const handleInsertMedia = useCallback((markdown: string) => {
    setBody(prev => prev + '\n\n' + markdown)
  }, [])

  if (!currentUser) {
    return (
      <div className="life-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[color:var(--muted-foreground)]">请先登录后再创建内容。</p>
          <Link to="/login" className="life-button mt-4 text-sm">去登录</Link>
        </div>
      </div>
    )
  }

  function handleCancel() {
    if (isDirty && !window.confirm('你有未保存的内容，确定要离开吗？')) return
    navigate('/app')
  }

  async function handleSave() {
    if (config.requiresTitle && !title.trim()) {
      alert('标题不能为空')
      return
    }
    if (!body.trim()) {
      alert('内容不能为空')
      return
    }
    if (createType === 'trajectory' && (!trajDate || !trajCity.trim())) {
      alert('人生轨迹需要填写日期和城市')
      return
    }

    setSaving(true)
    await new Promise(r => setTimeout(r, 600))

    const now = new Date().toISOString()
    const tagNames = Array.from(
      new Set([
        ...tagInput.split(/[,，]/).map(t => t.trim()).filter(Boolean),
        ...extractHashTags(body),
      ])
    )
    const tags = tagNames.map((name, i) => ({ id: `tag-${Date.now()}-${i}`, name }))

    if (createType === 'trajectory') {
      addTrajectoryEntry({
        id: `tr-${Date.now()}`,
        date: trajDate,
        city: trajCity.trim(),
        country: trajCountry.trim() || '—',
        summary: title.trim() || body.trim().slice(0, 40),
        tags,
      })

      let mapNote = ''
      if (trajWriteToMap) {
        const result = recordFootprintVisit(trajCity.trim(), trajCountry.trim(), trajDate)
        mapNote = result.ambiguous
          ? '\n\n存在多个同名城市，未填写国家时不会自动合并；已新建一条待确认记录。'
          : result.onMap
            ? result.merged
              ? '\n\n当天城市已并入已有足迹记录，到访次数 +1。'
              : '\n\n当天城市已写入足迹地图。'
            : '\n\n该城市暂无坐标，已加入足迹列表并标记为待确认，不会出现在地图上。'
      }

      setSaving(false)
      alert(`已创建 1 条人生轨迹记录。${mapNote}`)
      navigate(`/${currentUser}/trajectory`)
      return
    }

    const type: ContentType = createType === 'thought' ? 'thought' : createType === 'diary' ? 'diary' : 'pkm'
    const slug = makeUniqueSlug(slugify(title || body.slice(0, 30), `entry-${Date.now()}`))
    const item: ContentItem = {
      id: `c-${Date.now()}`,
      slug,
      type,
      title: title.trim() || body.trim().slice(0, 30),
      body: body.trim(),
      summary: body.trim().slice(0, 60),
      visibility,
      tags,
      createdAt: now,
      updatedAt: now,
      publishedAt: visibility === 'draft' ? '' : now,
      author: currentUser!,
      ...(type === 'pkm'
        ? {
            contentKind,
            allowComments: contentKind === 'article',
            ...normaliseMembership({ folderIds, seriesIds }, allFolders),
          }
        : {}),
      ...(type === 'thought'
        ? {
            thoughtType,
            ...(thoughtType === 'excerpt'
              ? {
                  sourceAuthor: sourceAuthor.trim() || undefined,
                  sourceTitle: sourceTitle.trim() || undefined,
                  sourceType,
                  sourceUrl: sourceUrl.trim() || undefined,
                  sourceLocator: sourceLocator.trim() || undefined,
                }
              : {}),
          }
        : {}),
    }

    addContentItem(item)
    setSaving(false)
    navigate(`/${currentUser}/${config.section}/${slug}`)
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-white/84 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-xs text-[color:var(--muted-foreground)]">创建模式</span>
              <span className="text-xs text-[color:var(--border)]">/</span>
              <span className="truncate text-xs text-[color:var(--muted-foreground)]">新建{config.label}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={handleCancel} disabled={saving} className="life-button text-xs disabled:opacity-50">
                取消
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="life-button life-button-primary text-xs font-medium disabled:opacity-60">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <div className="space-y-5">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={config.titlePlaceholder}
            className="w-full border-0 border-b border-[color:var(--border)] bg-transparent px-0 py-2 text-3xl font-light text-[color:var(--foreground)] transition-colors placeholder:text-[color:var(--border)] focus:border-[color:var(--primary)] focus:outline-none"
          />

          {/* Trajectory-specific fields */}
          {createType === 'trajectory' && (
            <div className="grid gap-3 border-b border-[color:var(--border)] pb-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">日期</label>
                <input type="date" value={trajDate} onChange={e => setTrajDate(e.target.value)} className="life-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">城市</label>
                <input value={trajCity} onChange={e => setTrajCity(e.target.value)} placeholder="例如：东京" className="life-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">国家 / 地区</label>
                <input value={trajCountry} onChange={e => setTrajCountry(e.target.value)} placeholder="例如：日本" className="life-input w-full px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)] sm:col-span-3">
                <input type="checkbox" checked={trajWriteToMap} onChange={e => setTrajWriteToMap(e.target.checked)} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                同时把当天城市写入足迹地图
              </label>
              <p className="text-xs text-[color:var(--muted-foreground)] sm:col-span-3">
                需要一次记录多个日期？保存后可在人生轨迹页使用「批量记录」。
              </p>
            </div>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-4 border-b border-[color:var(--border)] py-3">
            {createType === 'thought' && (
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

            {(createType === 'note' || createType === 'article') && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[color:var(--muted-foreground)]">形态</span>
                <div className="flex gap-1">
                  {(['note', 'article'] as ContentKind[]).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setContentKind(v)}
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

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-xs text-[color:var(--muted-foreground)]">标签</span>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="技术, 旅行（逗号分隔，正文里的 #标签 也会自动收录）"
                className="life-input min-w-0 flex-1 px-2 py-1 text-xs"
              />
            </div>
          </div>

          {/* Excerpt source fields */}
          {createType === 'thought' && thoughtType === 'excerpt' && (
            <div className="grid gap-3 border-b border-[color:var(--border)] pb-4 sm:grid-cols-2">
              <input value={sourceAuthor} onChange={e => setSourceAuthor(e.target.value)} placeholder="原作者或说话者" className="life-input px-3 py-2 text-sm" />
              <input value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} placeholder="来源作品名称" className="life-input px-3 py-2 text-sm" />
              <select value={sourceType} onChange={e => setSourceType(e.target.value as ThoughtSourceType)} className="life-input px-3 py-2 text-sm">
                {sourceTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input value={sourceLocator} onChange={e => setSourceLocator(e.target.value)} placeholder="页码 / 章节 / 时间点" className="life-input px-3 py-2 text-sm" />
              <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="来源链接（https://）" className="life-input px-3 py-2 text-sm sm:col-span-2" />
            </div>
          )}

          {(createType === 'note' || createType === 'article') && (
            <div className="border-b border-[color:var(--border)] pb-4">
              <LibraryPicker
                folders={allFolders.filter(f => f.owner === currentUser)}
                series={allSeries.filter(s => s.owner === currentUser)}
                folderIds={folderIds}
                seriesIds={seriesIds}
                onChange={next => { setFolderIds(next.folderIds); setSeriesIds(next.seriesIds) }}
                onCreateFolder={createFolder}
                onCreateSeries={createSeries}
              />
            </div>
          )}

          {inlineTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[color:var(--muted-foreground)]">正文中的标签</span>
              {inlineTags.map(name => (
                <span key={name} className="rounded-full border border-[#CDE4EE] bg-[#EEF7FB] px-2 py-0.5 text-[11px] text-[#2D7182]">
                  #{name}
                </span>
              ))}
              <span className="text-xs text-[color:var(--muted-foreground)]">保存时会一并记录</span>
            </div>
          )}

          {/* Editor toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-full border border-[color:var(--border)] bg-white/70">
              <button
                type="button"
                onClick={() => setTab('write')}
                className={`px-3 py-1.5 text-xs transition-colors ${tab === 'write' ? 'bg-[color:var(--secondary)] font-medium text-[color:var(--foreground)]' : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'}`}
              >
                编写
              </button>
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={`border-l border-[color:var(--border)] px-3 py-1.5 text-xs transition-colors ${tab === 'preview' ? 'bg-[color:var(--secondary)] font-medium text-[color:var(--foreground)]' : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'}`}
              >
                预览
              </button>
            </div>
            {tab === 'write' && <MediaInsertMenu onInsert={handleInsertMedia} />}
            <div className="ml-auto text-xs text-[color:var(--muted-foreground)]">Markdown 格式</div>
          </div>

          {tab === 'write' ? (
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={config.bodyPlaceholder}
              rows={createType === 'thought' ? 6 : 24}
              className="w-full resize-none border-0 bg-transparent px-0 py-2 text-sm leading-relaxed text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none"
              style={{ minHeight: createType === 'thought' ? '10rem' : '60vh' }}
            />
          ) : (
            <div className="life-surface min-h-96 p-6">
              {body ? <MarkdownRenderer content={body} /> : <p className="text-sm italic text-[color:var(--muted-foreground)]">预览区为空</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
