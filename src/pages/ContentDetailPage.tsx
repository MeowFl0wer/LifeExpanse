import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import TagList from '../components/TagList'
import VisibilityBadge from '../components/VisibilityBadge'
import MarkdownRenderer from '../components/MarkdownRenderer'
import CommentSection from '../components/CommentSection'
import ArticleToc from '../components/ArticleToc'
import { extractHeadings } from '../lib/toc'
import { publishAsArticle, revertToNote, getLinkGraph, getPkmBySlug, deletePkm, type LinkGraph } from '../api/pkm'
import { folders as allFolders, series as allSeries } from '../mockData'
import type { ContentItem } from '../types'
import { locationTrail } from '../lib/library'
import { safeLinkUrl } from '../lib/safeUrl'
import { useCurrentUser } from '../auth'

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// External link card component (read-only)
function ExternalLinkCard({ url, title, platform }: { url: string; title: string; platform: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--secondary)] p-4 no-underline transition-colors hover:border-[color:var(--accent)]"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[color:var(--muted-foreground)] mb-0.5">{platform} · 外部链接</p>
        <p className="text-sm font-medium text-[color:var(--foreground)] group-hover:text-[color:var(--primary)] truncate transition-colors">
          {title}
        </p>
        <p
          className="text-xs text-[color:var(--muted-foreground)] truncate mt-0.5"
        >
          {url}
        </p>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[color:var(--muted-foreground)] shrink-0">
        <path d="M6 2H2v10h10V8M8 2h4v4M5 9l5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}

interface ContentDetailPageProps {
  section: 'thoughts' | 'diary' | 'pkm'
}

/** A route section maps to exactly one content type. */
const SECTION_TYPE: Record<ContentDetailPageProps['section'], ContentItem['type']> = {
  thoughts: 'thought',
  pkm: 'pkm',
  diary: 'diary',
}

export default function ContentDetailPage({ section }: ContentDetailPageProps) {
  const { username, slug } = useParams<{ username: string; slug: string }>()
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  // Every section goes through the data layer so the author/type/visibility
  // rules are applied in one place. Reading the store directly for thoughts
  // and diary meant a backend-saved entry 404'd here.
  const [pkmItem, setPkmItem] = useState<ContentItem | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    getPkmBySlug({
      author: username ?? '',
      slug: slug ?? '',
      viewer: currentUser,
      type: SECTION_TYPE[section],
    })
      .then(found => { if (!cancelled) setPkmItem(found) })
      .catch(() => { if (!cancelled) setPkmItem(null) })
    return () => { cancelled = true }
  }, [section, username, slug, currentUser])

  const item = pkmItem ?? undefined
  const loadingPkm = pkmItem === undefined
  const [localContentKind, setLocalContentKind] = useState(item?.contentKind)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [links, setLinks] = useState<LinkGraph | null>(null)
  const [busy, setBusy] = useState(false)

  // Link graph comes from the data layer so it honours the viewer's permissions.
  useEffect(() => {
    let cancelled = false
    if (!item || item.type !== 'pkm') { setLinks(null); return }
    getLinkGraph(item, currentUser)
      .then(graph => { if (!cancelled) setLinks(graph) })
      .catch(() => { if (!cancelled) setLinks(null) })
    return () => { cancelled = true }
  }, [item?.id, item?.body, currentUser])

  const isOwner = item !== undefined && currentUser === item.author

  // Private and draft content must be unreachable by anyone but its author —
  // including by guessing the slug. Returning the same 404 as a missing item
  // avoids leaking the fact that the content exists at all.
  if (loadingPkm) {
    return (
      <div className="life-page flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[color:var(--muted-foreground)]">加载中…</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!item || (item.visibility !== 'public' && !isOwner)) {
    return (
      <div className="life-page flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-4xl text-[color:var(--muted-foreground)]">404</p>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-6">找不到这条内容</p>
            <Link to={`/${username}/${section}`} className="text-sm text-[color:var(--primary)] hover:underline">
              ← 返回列表
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const contentKind = localContentKind ?? item.contentKind
  const trail = locationTrail(item, allFolders, allSeries)
  // 需求 10.3: PKM content reads as a document with an outline beside it.
  // Notes get one too — a long note benefits from it exactly as an article
  // does. The decision is made on whether the body actually has headings, not
  // on the form: without that check a heading-less note would reserve the
  // sidebar column and leave an empty gutter.
  const showToc = item.type === 'pkm' && extractHeadings(item.body).length > 0
  const typeLabel: Record<string, string> = { diary: '日记', pkm: '笔记与文章', thought: '随想' }
  const thoughtTypeLabel = item.thoughtType === 'excerpt' ? '摘录' : '原创'

  async function handlePublishAsArticle() {
    setBusy(true)
    try {
      const updated = await publishAsArticle(item!.id, currentUser!)
      setLocalContentKind(updated.contentKind)
    } catch {
      alert('发布失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  async function handleReturnToNote() {
    if (!window.confirm('退回笔记状态后，公开链接和评论可能受到影响。确定继续吗？')) return
    setBusy(true)
    try {
      const updated = await revertToNote(item!.id, currentUser!)
      setLocalContentKind(updated.contentKind)
    } catch {
      alert('操作失败，请重试。')
    } finally {
      setBusy(false)
    }
  }


  function handleDelete() {
    // Second step: an explicit OS-level confirm on top of the inline one, since
    // this removes content rather than just changing it.
    const sure = window.confirm(
      `确定要删除「${item!.title}」吗？\n\n` +
      '内容会移入回收站，保留 30 天，期间可以随时恢复。'
    )
    if (!sure) {
      setConfirmingDelete(false)
      return
    }
    void deletePkm(item!.id, currentUser!)
      .then(() => navigate(`/${username}/${section}`, { replace: true }))
      .catch(() => alert('删除失败，请重试。'))
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main
        className={`mx-auto w-full flex-1 px-6 py-10 ${
          showToc ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)] mb-8" aria-label="面包屑">
          <Link to={`/${username}`} className="hover:text-[color:var(--foreground)] transition-colors">
            {username}
          </Link>
          <span>/</span>
          <Link to={`/${username}/${section}`} className="hover:text-[color:var(--foreground)] transition-colors">
            {typeLabel[item.type] ?? section}
          </Link>
          <span>/</span>
          <span className="text-[color:var(--foreground)] truncate max-w-32">{item.title}</span>
        </nav>

        {/* Article header */}
        <header className="mb-8 pb-6 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <VisibilityBadge visibility={item.visibility} />
            {item.type === 'thought' && (
              <span className="rounded-full bg-[color:var(--secondary)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                {thoughtTypeLabel}
              </span>
            )}
            {item.type === 'pkm' && contentKind && (
              <span className="rounded-full bg-[color:var(--secondary)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                {contentKind === 'article' ? 'Article' : 'Note'}
              </span>
            )}
            {isOwner && (
              <span
                className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] text-[color:var(--muted-foreground)]"
              >
                你的内容
              </span>
            )}
          </div>

          <h1 className="mb-4 text-3xl font-light leading-snug text-[color:var(--foreground)]">
            {item.title}
          </h1>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-sm text-[color:var(--muted-foreground)]">
              <time
                dateTime={item.publishedAt || item.createdAt}
                className="text-xs"
              >
                {formatDate(item.publishedAt || item.createdAt)}
              </time>
              {item.updatedAt && item.updatedAt !== item.createdAt && (
                <span
                  className="text-xs"
                >
                  更新于 {formatDate(item.updatedAt)}
                </span>
              )}
            </div>

            {/* Only owner sees edit button */}
            {isOwner && (
              <div className="flex flex-wrap items-center gap-2">
                {item.type === 'pkm' && contentKind === 'note' && (
                  <button type="button" onClick={handlePublishAsArticle} disabled={busy} className="life-button text-xs disabled:opacity-50">
                    {busy ? '处理中…' : '发布为文章'}
                  </button>
                )}
                {item.type === 'pkm' && contentKind === 'article' && (
                  <button type="button" onClick={handleReturnToNote} disabled={busy} className="life-button text-xs disabled:opacity-50">
                    {busy ? '处理中…' : '退回笔记'}
                  </button>
                )}
                <button
                  onClick={() => navigate(`/${username}/${section}/${slug}/edit`)}
                  className="life-button text-xs"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8 2l2 2-6 6H2V8l6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  编辑
                </button>

                {/* Deletion takes two deliberate steps rather than one click. */}
                {confirmingDelete ? (
                  <span className="flex flex-wrap items-center gap-2 rounded-full bg-[#FDEEEE] px-3 py-1">
                    <span className="text-xs text-[#B23B3B]">确定删除这条内容？</span>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                    >
                      取消
                    </button>
                    <button type="button" onClick={handleDelete} className="text-xs font-medium text-[#B23B3B] hover:underline">
                      确认删除
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="life-button text-xs hover:border-[#B23B3B] hover:text-[#B23B3B]"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 3.5h7M5 3.5V2.5h2v1M3.5 3.5l.5 6h4l.5-6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    删除
                  </button>
                )}
              </div>
            )}
          </div>

          <TagList tags={item.tags} className="mt-4" />

          {item.type === 'thought' && item.thoughtType === 'excerpt' && (
            <div className="mt-5 space-y-1 border-t border-[color:var(--border)] pt-4 text-sm text-[color:var(--muted-foreground)]">
              {item.sourceAuthor && <p>作者或说话者：{item.sourceAuthor}</p>}
              {item.sourceTitle && <p>作品名称：{item.sourceTitle}</p>}
              {item.sourceLocator && <p>位置：{item.sourceLocator}</p>}
              {item.sourceUrl && (
                <p>
                  来源链接：{' '}
                  {/* Same rule as body links: a stored `javascript:` would be a
                      working attack the moment a reader clicked it. Refused
                      addresses stay visible as text. */}
                  {safeLinkUrl(item.sourceUrl) ? (
                    <a
                      href={safeLinkUrl(item.sourceUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[color:var(--primary)] hover:underline"
                    >
                      {item.sourceUrl}
                    </a>
                  ) : (
                    <span className="break-all">{item.sourceUrl}</span>
                  )}
                </p>
              )}
            </div>
          )}

          {item.type === 'pkm' && contentKind === 'article' && (
            <div className="mt-5 border-t border-[color:var(--border)] pt-4 text-sm text-[color:var(--muted-foreground)]">
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {item.category && <span>分类：{item.category}</span>}
                {trail.folders.length > 0 && (
                  <span>文件夹：{trail.folders.map(f => f.name).join('、')}</span>
                )}
                {trail.series.length > 0 && (
                  <span>系列：{trail.series.map(s => s.name).join('、')}</span>
                )}
                <span>评论：{item.allowComments ? '已开启' : '未开启'}</span>
              </div>
              <p className="mt-2 text-xs">只有注册并登录的用户可以发表评论；普通 Note 默认不开启评论。</p>
            </div>
          )}
        </header>

        <div className={showToc ? 'gap-10 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]' : ''}>
        {showToc && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <ArticleToc body={item.body} />
            </div>
          </aside>
        )}

        {/* Article body — strictly read-only */}
        <article>
          <MarkdownRenderer
            content={item.body}
            className="mb-8"
            resolveLink={target => {
              const found = links?.outgoing.find(
                i => i.slug.toLowerCase() === target.toLowerCase()
                  || i.title.toLowerCase() === target.toLowerCase()
              )
              return found
                ? { href: `/${username}/pkm/${found.slug}`, label: found.title }
                : { label: target }
            }}
          />

          {/* Demo: video embed for demo-note */}
          {slug === 'demo-note' && (
            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-medium text-[color:var(--muted-foreground)]">
                外部资源示例
              </h3>

              {/* Simulated small video */}
              <div
                className="overflow-hidden rounded-[var(--radius)] border border-[color:var(--border)]"
                style={{ background: '#000' }}
              >
                <div className="relative aspect-video flex items-center justify-center">
                  <div className="text-center text-white opacity-60">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-2">
                      <circle cx="24" cy="24" r="22" stroke="white" strokeWidth="1.5" opacity="0.4" />
                      <path d="M19 16l14 8-14 8V16z" fill="white" opacity="0.8" />
                    </svg>
                    <p className="text-xs">本地视频示例（前端原型）</p>
                  </div>
                </div>
              </div>

              {/* YouTube card */}
              <ExternalLinkCard
                url="https://www.youtube.com/watch?v=FZ0cG47msEk"
                title="React Conf 2021 — What is Concurrent React?"
                platform="YouTube"
              />

              {/* Bilibili card */}
              <ExternalLinkCard
                url="https://www.bilibili.com/video/BV1xK411H7CC"
                title="React 18 并发特性深度解析"
                platform="哔哩哔哩"
              />

              {/* Google Drive card */}
              <ExternalLinkCard
                url="https://drive.google.com/file/d/example123/view"
                title="React Patterns.pdf（示例资源）"
                platform="Google Drive"
              />
            </div>
          )}

        {links && (links.backlinks.length > 0 || links.unresolved.length > 0) && (
          <section className="mt-12 border-t border-[color:var(--border)] pt-6">
            {links.backlinks.length > 0 && (
              <>
                <h2 className="text-sm font-medium text-[color:var(--foreground)]">
                  链接到这里的笔记
                  <span className="ml-2 text-xs font-normal text-[color:var(--muted-foreground)]">
                    {links.backlinks.length}
                  </span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {links.backlinks.map(b => (
                    <li key={b.id}>
                      <Link
                        to={`/${username}/pkm/${b.slug}`}
                        className="text-sm text-[color:var(--primary)] hover:underline"
                      >
                        {b.title}
                      </Link>
                      {b.summary && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[color:var(--muted-foreground)]">
                          {b.summary}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {isOwner && links.unresolved.length > 0 && (
              <p className="mt-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
                正文里有 {links.unresolved.length} 个还没有对应笔记的链接：
                {links.unresolved.map(t => `[[${t}]]`).join('、')}
              </p>
            )}
          </section>
        )}
        </article>
        </div>

        {/* Ch 11: comments belong to the article form of PKM content only. */}
        {item.type === 'pkm' && contentKind === 'article' && (
          <CommentSection
            contentId={item.id}
            contentAuthor={item.author}
            allowComments={item.allowComments ?? false}
          />
        )}

        {/* Navigation */}
        <div className="mt-12 pt-6 border-t border-[color:var(--border)]">
          <Link
            to={`/${username}/${section}`}
            className="text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] transition-colors"
          >
            ← 返回{typeLabel[item.type] ?? '列表'}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
