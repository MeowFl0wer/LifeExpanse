import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import { encryptedSpaces, getSpaceByPassword, getSpacePosts, SPACE_LIMIT } from '../mockData'
import { useIsOwnerOf, grantSpaceSession } from '../auth'

const MAX_ATTEMPTS = 5
const LOCK_SECONDS = 30

export default function SpaceGatePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const isOwner = useIsOwnerOf(username)

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [remaining, setRemaining] = useState(0)

  // Without a ticking timer nothing re-renders when the lock expires, so the
  // form would stay disabled long after the lockout was actually over.
  useEffect(() => {
    if (lockedUntil === 0) return

    function tick() {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        setLockedUntil(0)
        setError('')
      }
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [lockedUntil])

  const locked = remaining > 0
  const ownedSpaces = encryptedSpaces.filter(s => s.owner === username)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (locked) return
    if (!password.trim()) {
      setError('请输入访问密码')
      return
    }

    setChecking(true)
    setError('')
    await new Promise(r => setTimeout(r, 700))
    setChecking(false)

    const space = getSpaceByPassword(password)

    // Ch 15.3: never distinguish "space does not exist" from "wrong password".
    if (!space || space.owner !== username) {
      const next = attempts + 1
      setAttempts(next)
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCK_SECONDS * 1000)
        setAttempts(0)
      } else {
        setError('验证失败，请检查密码后重试。')
      }
      setPassword('')
      return
    }

    grantSpaceSession(space.id, space.spaceKey, space.sessionTtlMinutes)
    navigate(`/${username}/space/${space.spaceKey}`)
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Visitor view: nothing but a welcome line and the password box. */}
        <div className="mx-auto w-full max-w-md px-6 py-20">
          <div className="text-center">
            <p className="life-kicker mb-3">独立空间</p>
            <h1 className="text-2xl font-light text-[color:var(--foreground)]">
              这里需要一个密码
            </h1>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">
              如果你知道密码，输入后就会进入对应的空间。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10">
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              disabled={checking || locked}
              placeholder="访问密码"
              autoComplete="off"
              className="life-input w-full px-4 py-3 text-center text-sm disabled:opacity-50"
            />

            {locked ? (
              <p className="mt-3 text-center text-xs text-[#B23B3B]">
                验证失败次数过多，请 {remaining} 秒后再试。
              </p>
            ) : error ? (
              <p className="mt-3 text-center text-xs text-[#B23B3B]">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={checking || locked}
              className="life-button life-button-primary mt-4 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checking ? '验证中...' : locked ? `已锁定 ${remaining}s` : '进入'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-6 text-[color:var(--muted-foreground)]">
            密码同时决定进入哪一个空间。
            <br />
            这里不会显示空间名称，也不会提示某个空间是否存在。
          </p>
        </div>

        {/* Owner view: manage own spaces, enter without a password (Ch 15.2). */}
        {isOwner && (
          <div className="life-shell max-w-3xl pb-20">
            <div className="border-t border-[color:var(--border)] pt-10">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-base font-medium text-[color:var(--foreground)]">我的空间</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                    作为空间主人，你可以直接进入，不需要输入密码。
                  </p>
                </div>
                <span className="text-xs text-[color:var(--muted-foreground)]">
                  已使用 {ownedSpaces.length} / {SPACE_LIMIT}
                </span>
              </div>

              <div className="border-t border-[color:var(--border)]">
                {ownedSpaces.map(space => (
                  <div key={space.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[color:var(--foreground)]">{space.name}</p>
                        {!space.isActive && (
                          <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] text-[color:var(--muted-foreground)]">
                            已停用
                          </span>
                        )}
                        {!space.allowReplies && (
                          <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] text-[color:var(--muted-foreground)]">
                            回复已关闭
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                        {space.description} · {getSpacePosts(space.id).length} 条内容 · 会话 {space.sessionTtlMinutes} 分钟
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => alert('前端原型：这里会打开空间设置——名称、说明、封面、访问密码、会话有效期和回复开关。\n\n更换密码后可以选择立即让旧访客会话失效。')}
                        className="life-button text-xs"
                      >
                        设置
                      </button>
                      <Link to={`/${username}/space/${space.spaceKey}`} className="life-button text-xs">
                        进入
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (ownedSpaces.length >= SPACE_LIMIT) {
                    alert(`已达到空间数量上限（${SPACE_LIMIT} 个）。停用的空间仍占用名额，彻底删除后才会释放。`)
                    return
                  }
                  alert('前端原型：这里会新建一个独立加密空间，并要求设置一个全站唯一的访问密码。')
                }}
                className="life-button mt-5 text-sm"
              >
                新建空间
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
