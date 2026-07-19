import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { getSpaceByKey, getSpacePosts, getSpaceReplies, addSpaceReply } from '../mockData'
import { isOwnerOf, hasSpaceSession } from '../auth'
import type { SpaceReply } from '../types'

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} ${d
    .toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

export default function SpacePostPage() {
  const { username, spaceKey, postId } = useParams<{ username: string; spaceKey: string; postId: string }>()
  const space = getSpaceByKey(spaceKey ?? '')
  const isOwner = isOwnerOf(username)

  const [nickname, setNickname] = useState('')
  const [replyText, setReplyText] = useState('')
  // Replies live in a module-level mock store, so a local counter is what
  // re-reads them after posting. The value itself is never needed.
  const [, bumpReplies] = useState(0)
  const [notice, setNotice] = useState('')

  const authorized = space
    ? (isOwner && space.owner === username) || hasSpaceSession(space.id)
    : false

  if (!space || space.owner !== username || !space.isActive || !authorized) {
    return <Navigate to={`/${username}/space`} replace />
  }

  const post = getSpacePosts(space.id).find(p => p.id === postId)
  if (!post) {
    return <Navigate to={`/${username}/space/${space.spaceKey}`} replace />
  }

  const replies = getSpaceReplies(post.id)

  function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim()) {
      setNotice('请先写下回复内容')
      return
    }
    if (!space!.allowAnonymousReplies && !nickname.trim() && !isOwner) {
      setNotice('这个空间要求填写昵称后才能回复')
      return
    }

    const reply: SpaceReply = {
      id: `spr-${Date.now()}`,
      spaceId: space!.id,
      postId: post!.id,
      nickname: nickname.trim() || undefined,
      content: replyText.trim(),
      isAuthor: isOwner,
      createdAt: new Date().toISOString(),
    }
    addSpaceReply(reply)
    setReplyText('')
    setNickname('')
    setNotice('')
    bumpReplies(n => n + 1)
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <nav className="mb-8 text-xs text-[color:var(--muted-foreground)]">
          <Link to={`/${username}/space/${space.spaceKey}`} className="transition-colors hover:text-[color:var(--foreground)]">
            ← 返回 {space.name}
          </Link>
        </nav>

        {/* Ch 15.7: title, centred time, then the body as written. */}
        <article>
          <h1 className="text-3xl font-light leading-snug text-[color:var(--foreground)]">{post.title}</h1>
          <p className="mt-4 text-center text-xs text-[color:var(--muted-foreground)]">
            {formatDateTime(post.createdAt)}
          </p>

          <div className="mt-10">
            <MarkdownRenderer content={post.body} />
          </div>
        </article>

        {/* Replies */}
        <section className="mt-14 border-t border-[color:var(--border)] pt-8">
          <h2 className="text-base font-medium text-[color:var(--foreground)]">
            回复{replies.length > 0 && <span className="ml-2 text-sm text-[color:var(--muted-foreground)]">{replies.length}</span>}
          </h2>

          {replies.length > 0 && (
            <div className="mt-5 space-y-5">
              {replies.map(reply => (
                <div key={reply.id} className="border-b border-[color:var(--border)] pb-5 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">
                      {reply.isAuthor
                        ? '空间主人'
                        : space.showReplyNickname && reply.nickname
                          ? reply.nickname
                          : '匿名'}
                    </span>
                    {reply.isAuthor && (
                      <span className="rounded-full bg-[color:var(--secondary)] px-2 py-0.5 text-[10px] text-[color:var(--muted-foreground)]">
                        作者
                      </span>
                    )}
                    <time className="text-xs text-[color:var(--muted-foreground)]">{formatDateTime(reply.createdAt)}</time>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => alert('前端原型：空间主人可以隐藏或删除这条回复。')}
                        className="ml-auto text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                      >
                        隐藏
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">{reply.content}</p>
                </div>
              ))}
            </div>
          )}

          {space.allowReplies ? (
            <form onSubmit={handleReply} className="mt-8">
              {!isOwner && (
                <input
                  value={nickname}
                  onChange={e => { setNickname(e.target.value); setNotice('') }}
                  placeholder={space.allowAnonymousReplies ? '昵称（可不填，不填按匿名处理）' : '昵称'}
                  className="life-input mb-3 w-full px-3 py-2 text-sm"
                />
              )}
              <textarea
                value={replyText}
                onChange={e => { setReplyText(e.target.value); setNotice('') }}
                rows={4}
                placeholder={isOwner ? '以空间主人身份回复...' : '写下你的回复...'}
                className="life-input w-full px-4 py-3 text-sm leading-7"
              />
              {notice && <p className="mt-2 text-xs text-[#B23B3B]">{notice}</p>}
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {isOwner
                    ? '你的回复会显示「空间主人」标识。'
                    : space.allowAnonymousReplies
                      ? '昵称不是必填项，可以匿名回复。'
                      : '这个空间需要填写昵称后才能回复。'}
                </p>
                <button type="submit" className="life-button life-button-primary text-sm">
                  发表回复
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-8 text-sm text-[color:var(--muted-foreground)]">这个空间的回复功能已关闭。</p>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
