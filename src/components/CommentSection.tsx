import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listComments, addComment, removeComment } from '../api/comments'
import { useCurrentUser } from '../auth'
import type { ArticleComment } from '../types'

interface CommentSectionProps {
  contentId: string
  /** Article author — can remove comments on their own article. */
  contentAuthor: string
  allowComments: boolean
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} ${d
    .toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

export default function CommentSection({ contentId, contentAuthor, allowComments }: CommentSectionProps) {
  const currentUser = useCurrentUser()
  const [comments, setComments] = useState<ArticleComment[]>([])
  const [body, setBody] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Comments come from the data layer, so with a backend configured they are
  // the server's and survive a reload on another device.
  useEffect(() => {
    let cancelled = false
    listComments(contentId)
      .then(rows => { if (!cancelled) setComments(rows) })
      .catch(() => { if (!cancelled) setComments([]) })
    return () => { cancelled = true }
  }, [contentId])

  const isContentAuthor = currentUser === contentAuthor

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser || busy) return
    if (!body.trim()) {
      setNotice('请先写下评论内容')
      return
    }
    setBusy(true)
    try {
      const created = await addComment(contentId, currentUser, body)
      setComments(prev => [...prev, created])
      setBody('')
      setNotice('')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '发表失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!currentUser || busy) return
    setBusy(true)
    try {
      await removeComment(contentId, id, currentUser)
      setComments(prev => prev.filter(c => c.id !== id))
      setConfirmingId(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '删除失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  if (!allowComments) {
    return (
      <section className="mt-14 border-t border-[color:var(--border)] pt-8">
        <p className="text-sm text-[color:var(--muted-foreground)]">这篇内容没有开启评论。</p>
      </section>
    )
  }

  return (
    <section className="mt-14 border-t border-[color:var(--border)] pt-8">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">
        评论
        {comments.length > 0 && (
          <span className="ml-2 text-sm text-[color:var(--muted-foreground)]">{comments.length}</span>
        )}
      </h2>

      {comments.length > 0 && (
        <div className="mt-5 space-y-5">
          {comments.map(c => (
            <div key={c.id} className="border-b border-[color:var(--border)] pb-5 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[color:var(--foreground)]">{c.authorDisplayName}</span>
                {c.author === contentAuthor && (
                  <span className="rounded-full bg-[color:var(--secondary)] px-2 py-0.5 text-[10px] text-[color:var(--muted-foreground)]">
                    作者
                  </span>
                )}
                <time className="text-xs text-[color:var(--muted-foreground)]">{formatDateTime(c.createdAt)}</time>

                {(c.author === currentUser || isContentAuthor) && (
                  confirmingId === c.id ? (
                    <span className="ml-auto flex items-center gap-2 text-xs">
                      <span className="text-[color:var(--muted-foreground)]">确定删除？</span>
                      <button
                        type="button"
                        onClick={() => void handleDelete(c.id)}
                        disabled={busy}
                        className="text-[#B23B3B] hover:underline disabled:opacity-60"
                      >
                        删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="text-[color:var(--muted-foreground)] hover:underline"
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(c.id)}
                      className="ml-auto text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                    >
                      删除
                    </button>
                  )
                )}
              </div>
              <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ch 11: only registered, logged-in users may comment. */}
      {currentUser ? (
        <form onSubmit={e => void handleSubmit(e)} className="mt-8">
          <textarea
            value={body}
            onChange={e => { setBody(e.target.value); setNotice('') }}
            rows={4}
            placeholder="写下你的评论..."
            className="life-input w-full px-4 py-3 text-sm leading-7"
          />
          {notice && <p className="mt-2 text-xs text-[#B23B3B]">{notice}</p>}
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs text-[color:var(--muted-foreground)]">以 @{currentUser} 的身份发表。</p>
            <button
              type="submit"
              disabled={busy}
              className="life-button life-button-primary text-sm disabled:opacity-60"
            >
              {busy ? '发表中…' : '发表评论'}
            </button>
          </div>
        </form>
      ) : (
        <div className="life-surface mt-8 p-5 text-center">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            只有注册并登录的用户可以发表评论。
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Link to="/login" className="life-button life-button-primary text-sm">登录</Link>
            <Link to="/register" className="life-button text-sm">注册</Link>
          </div>
        </div>
      )}
    </section>
  )
}
