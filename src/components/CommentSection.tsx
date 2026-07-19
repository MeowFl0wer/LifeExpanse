import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getComments, addComment } from '../mockData'
import { getCurrentUser } from '../auth'
import type { ArticleComment } from '../types'

interface CommentSectionProps {
  contentId: string
  /** Article author — can hide or delete comments on their own article. */
  contentAuthor: string
  allowComments: boolean
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} ${d
    .toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

export default function CommentSection({ contentId, contentAuthor, allowComments }: CommentSectionProps) {
  const currentUser = getCurrentUser()
  const [body, setBody] = useState('')
  // Comments live in a module-level mock store, so a local counter is what
  // re-reads them after posting. The value itself is never needed.
  const [, bumpComments] = useState(0)
  const [notice, setNotice] = useState('')

  const comments = getComments(contentId)
  const isContentAuthor = currentUser === contentAuthor

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser) return
    if (!body.trim()) {
      setNotice('请先写下评论内容')
      return
    }
    const comment: ArticleComment = {
      id: `cm-${Date.now()}`,
      contentId,
      author: currentUser,
      authorDisplayName: currentUser === 'euan' ? 'Euan' : currentUser,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    }
    addComment(comment)
    setBody('')
    setNotice('')
    bumpComments(n => n + 1)
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
                  <button
                    type="button"
                    onClick={() =>
                      alert(
                        c.author === currentUser
                          ? '前端原型：你可以删除自己的评论。'
                          : '前端原型：文章作者可以隐藏或删除自己文章下的评论。'
                      )
                    }
                    className="ml-auto text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                  >
                    {c.author === currentUser ? '删除' : '隐藏'}
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Ch 11: only registered, logged-in users may comment. */}
      {currentUser ? (
        <form onSubmit={handleSubmit} className="mt-8">
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
            <button type="submit" className="life-button life-button-primary text-sm">发表评论</button>
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
