import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { setCurrentUser } from '../auth'
import { login as apiLogin } from '../api/auth'
import { safeNextPath } from '../lib/redirect'

type LoginState = 'idle' | 'loading' | 'error' | 'success'

export default function LoginPage() {
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState<LoginState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Where to land after signing in, e.g. /login?next=/new/note
  const next = safeNextPath(searchParams.get('next'))

  /*
   * Both the simulated request and the short success pause outlive the submit
   * handler. If the user leaves in the meantime — logo, back button, anything —
   * a pending timer would drag them to `next` from a page they had already
   * left, so everything after an await is gated on still being mounted.
   */
  const mounted = useRef(true)
  const redirectTimer = useRef<number | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (redirectTimer.current !== null) {
        window.clearTimeout(redirectTimer.current)
        redirectTimer.current = null
      }
    }
  }, [])

  function validate(): string | null {
    if (!credential.trim()) return '请输入用户名或邮箱'
    if (!password) return '请输入密码'
    if (password.length < 6) return '密码至少 6 位'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setErrorMsg(err); setState('error'); return }

    setState('loading')
    setErrorMsg('')

    try {
      const account = await apiLogin(credential, password, remember)
      if (!mounted.current) return
      setCurrentUser(account.username, { remember })
      setState('success')
      // Brief pause so the success state is visible before leaving.
      redirectTimer.current = window.setTimeout(() => {
        redirectTimer.current = null
        if (mounted.current) navigate(next)
      }, 600)
    } catch (err) {
      if (!mounted.current) return
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : '登录失败，请重试。')
    }
  }

  const disabled = state === 'loading' || state === 'success'

  return (
    <div className="life-page flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link to="/" className="inline-flex justify-center text-[color:var(--foreground)] no-underline">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Card */}
        <div className="life-surface bg-white/82">
          <div className="px-8 pt-8 pb-6">
            <h1
              className="mb-1 text-lg font-medium text-[color:var(--foreground)]"
            >
              登录
            </h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-6">
              欢迎回来
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="credential"
                    className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5"
                  >
                    用户名或邮箱
                  </label>
                  <input
                    id="credential"
                    type="text"
                    value={credential}
                    onChange={e => setCredential(e.target.value)}
                    disabled={disabled}
                    autoComplete="username"
                    className="life-input w-full px-3 py-2.5 text-sm disabled:opacity-50"
                    placeholder="euan 或 user@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5"
                  >
                    密码
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={disabled}
                      autoComplete="current-password"
                      className="life-input w-full px-3 py-2.5 pr-10 text-sm disabled:opacity-50"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        {showPassword ? (
                          <>
                            <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" />
                            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                            <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </>
                        ) : (
                          <>
                            <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" />
                            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {state === 'error' && errorMsg && (
                  <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-600">
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      disabled={disabled}
                      className="h-3.5 w-3.5 rounded border-[color:var(--border)] accent-[color:var(--primary)]"
                    />
                    <span className="text-xs text-[color:var(--muted-foreground)]">保持登录</span>
                  </label>
                  <button
                    type="button"
                    className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] transition-colors"
                    onClick={() => alert('前端原型：忘记密码功能需要真实后端支持')}
                  >
                    忘记密码？
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={disabled}
                  className="life-button life-button-primary w-full text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                        <path d="M12 7a5 5 0 0 0-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      登录中...
                    </span>
                  ) : state === 'success' ? (
                    '✓ 登录成功'
                  ) : (
                    '登录'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="px-8 py-4 border-t border-[color:var(--border)] text-center">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              还没有账号？{' '}
              <Link to="/register" className="text-[color:var(--primary)] hover:underline">
                立即注册
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[color:var(--muted-foreground)]">
          <Link to="/" className="hover:text-[color:var(--foreground)] transition-colors">
            ← 返回主页
          </Link>
        </p>
      </div>
    </div>
  )
}
