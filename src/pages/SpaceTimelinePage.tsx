import { Link, Navigate, useParams, useNavigate } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import { getSpaceByKey, getSpacePosts } from '../mockData'
import { isOwnerOf, hasSpaceSession, revokeSpaceSession } from '../auth'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function SpaceTimelinePage() {
  const { username, spaceKey } = useParams<{ username: string; spaceKey: string }>()
  const navigate = useNavigate()
  const space = getSpaceByKey(spaceKey ?? '')
  const isOwner = isOwnerOf(username)

  // A URL alone must never grant access: the session is re-checked against
  // this space's id, and an owner is only an owner of their own space.
  const authorized = space
    ? (isOwner && space.owner === username) || hasSpaceSession(space.id)
    : false

  if (!space || space.owner !== username || !space.isActive || !authorized) {
    return <Navigate to={`/${username}/space`} replace />
  }

  const posts = getSpacePosts(space.id)

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <header className="mb-10 border-b border-[color:var(--border)] pb-8">
          <p className="life-kicker mb-2">独立空间</p>
          <h1 className="text-3xl font-light text-[color:var(--foreground)]">{space.name}</h1>
          {space.description && (
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">{space.description}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-foreground)]">
              {space.showPostCount && <span>{posts.length} 条内容</span>}
              {isOwner && <span>你是这个空间的主人</span>}
              {!space.allowReplies && <span>回复已关闭</span>}
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => alert('前端原型：这里会在当前空间发布新内容——标题、时间、Markdown 正文、图片和附件。')}
                  className="life-button text-xs"
                >
                  发布内容
                </button>
              )}
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    revokeSpaceSession(space.id)
                    navigate(`/${username}/space`, { replace: true })
                  }}
                  className="life-button text-xs"
                >
                  退出空间
                </button>
              )}
            </div>
          </div>
        </header>

        {posts.length === 0 ? (
          <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">这个空间还没有内容。</p>
        ) : (
          <div className="border-t border-[color:var(--border)]">
            {posts.map(post => (
              <article key={post.id} className="group border-b border-[color:var(--border)] py-6">
                <time className="text-xs text-[color:var(--muted-foreground)]">{formatDate(post.createdAt)}</time>
                <Link
                  to={`/${username}/space/${space.spaceKey}/${post.id}`}
                  className="mt-1.5 block no-underline"
                >
                  <h2 className="text-lg font-medium leading-snug text-[color:var(--foreground)] transition-colors group-hover:text-[color:var(--primary)]">
                    {post.title}
                  </h2>
                </Link>
                <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--muted-foreground)]">{post.summary}</p>
              </article>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-[color:var(--muted-foreground)]">
          这个空间的内容和回复只属于当前空间，不会出现在公开主页或搜索结果中。
        </p>
      </main>

      <Footer />
    </div>
  )
}
