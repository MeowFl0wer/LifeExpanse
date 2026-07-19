import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

const RESERVED = new Set(['login', 'logout', 'register', 'signup', 'app', 'dashboard', 'admin', 'api', 'settings', 'account', 'assets', 'static', 'uploads', 'health', 'search', 'about', 'terms', 'privacy'])
const TAKEN = new Set(['euan', 'admin', 'alice', 'bob', 'test'])

function usernameStatus(raw: string): { status: 'empty' | 'invalid' | 'reserved' | 'taken' | 'available'; message: string } {
  const username = raw.toLowerCase()
  if (!username) return { status: 'empty', message: '' }
  if (!/^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/.test(username)) {
    if (username.length < 3) return { status: 'invalid', message: '用户名至少 3 位' }
    if (username.length > 30) return { status: 'invalid', message: '用户名不能超过 30 位' }
    return { status: 'invalid', message: '只允许小写字母、数字、短横线和下划线，不能以短横线或下划线开头或结尾' }
  }
  if (RESERVED.has(username)) return { status: 'reserved', message: '该用户名为系统保留字' }
  if (TAKEN.has(username)) return { status: 'taken', message: '该用户名已被占用' }
  return { status: 'available', message: '用户名可用' }
}

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const navigate = useNavigate()

  const unStatus = usernameStatus(username)
  const normalizedUsername = username.toLowerCase()
  const previewPath = normalizedUsername
    ? `life.555978.xyz/${normalizedUsername}`
    : 'life.555978.xyz/username'

  function validateAll(): string | null {
    if (!username) return '请填写用户名'
    if (unStatus.status !== 'available') return unStatus.message
    if (!email.includes('@')) return '请输入有效的邮箱地址'
    if (password.length < 8) return '密码至少 8 位'
    if (password !== confirmPassword) return '两次密码不一致'
    if (!agreed) return '请同意用户协议和隐私政策'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const err = validateAll()
    if (err) { setFormError(err); return }

    setLoading(true)
    setFormError('')
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    // Simulate success
    alert(`注册成功！前端原型模拟：账号 @${normalizedUsername} 已创建。\n\n实际注册需要真实后端支持。`)
    navigate('/login')
  }

  const statusColors = {
    empty: '',
    invalid: 'text-red-500',
    reserved: 'text-amber-600',
    taken: 'text-red-500',
    available: 'text-[color:var(--primary)]',
  }

  return (
    <div className="life-page flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Link to="/" className="inline-flex justify-center text-[color:var(--foreground)] no-underline">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="life-surface bg-white/82">
          <div className="px-8 pt-8 pb-6">
            <h1
              className="mb-1 text-lg font-medium text-[color:var(--foreground)]"
            >
              注册账号
            </h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-6">
              开始记录你的人生空间
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                    用户名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => {
                      setUsername(e.target.value.toLowerCase())
                      setFormError('')
                    }}
                    disabled={loading}
                    className="life-input w-full px-3 py-2.5 text-sm disabled:opacity-50"
                    placeholder="euan"
                    autoComplete="username"
                  />
                  {username && (
                    <p className={`mt-1 text-xs ${statusColors[unStatus.status]}`}>
                      {unStatus.status === 'available' ? '✓ ' : '✕ '}
                      {unStatus.message}
                    </p>
                  )}

                  {/* Path preview */}
                  <div
                    className="mt-2 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-2"
                  >
                    <p className="text-xs text-[color:var(--muted-foreground)]">主页地址预览</p>
                    <p
                      className="text-xs font-medium text-[color:var(--foreground)] mt-0.5"
                    >
                      {previewPath}
                    </p>
                  </div>
                </div>

                {/* Display name */}
                <div>
                  <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                    显示名称
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    disabled={loading}
                    className="life-input w-full px-3 py-2.5 text-sm disabled:opacity-50"
                    placeholder="Euan（可使用中文和大小写）"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                    邮箱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setFormError('') }}
                    disabled={loading}
                    className="life-input w-full px-3 py-2.5 text-sm disabled:opacity-50"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                    密码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setFormError('') }}
                    disabled={loading}
                    className="life-input w-full px-3 py-2.5 text-sm disabled:opacity-50"
                    placeholder="至少 8 位"
                    autoComplete="new-password"
                  />
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                    确认密码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setFormError('') }}
                    disabled={loading}
                    className="life-input w-full px-3 py-2.5 text-sm disabled:opacity-50"
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">两次密码不一致</p>
                  )}
                </div>

                {/* Agreement */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    disabled={loading}
                    className="mt-0.5 w-3.5 h-3.5 accent-[color:var(--primary)] shrink-0"
                  />
                  <span className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
                    我已阅读并同意{' '}
                    <button type="button" className="text-[color:var(--primary)] hover:underline">
                      用户协议
                    </button>
                    {' '}和{' '}
                    <button type="button" className="text-[color:var(--primary)] hover:underline">
                      隐私政策
                    </button>
                  </span>
                </label>

                {/* Form error */}
                {submitted && formError && (
                  <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="life-button life-button-primary w-full text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                        <path d="M12 7a5 5 0 0 0-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      注册中...
                    </span>
                  ) : (
                    '创建账号'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="px-8 py-4 border-t border-[color:var(--border)] text-center">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              已有账号？{' '}
              <Link to="/login" className="text-[color:var(--primary)] hover:underline">
                登录
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
