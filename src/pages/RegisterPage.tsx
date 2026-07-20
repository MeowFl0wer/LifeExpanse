import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { requestRegisterCode, register } from '../api/account'
import { RESERVED_USERNAMES } from '../lib/reserved'

/**
 * Registration in two steps: prove the address, then create the account.
 *
 * Nothing here reports whether an address is already registered — the server
 * answers identically either way, and the form must not undo that by guessing
 * locally. A taken address simply fails at the code step, exactly like a wrong
 * code would. Usernames are the opposite: they are public URLs, so the server
 * does say when one is taken.
 */

type Step = 'details' | 'verify'

function usernameProblem(raw: string): string | null {
  const username = raw.trim()
  if (!username) return '请填写用户名'
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,29}$/.test(username)) {
    if (username.length < 3) return '用户名至少 3 位'
    if (username.length > 30) return '用户名不能超过 30 位'
    return '用户名需以字母开头，只能包含字母、数字、下划线和连字符'
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) return '该用户名已被系统保留，请换一个'
  return null
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('details')

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [agreed, setAgreed] = useState(false)

  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const unProblem = usernameProblem(username)
  const previewPath = username.trim()
    ? `life.555978.xyz/${username.trim().toLowerCase()}`
    : 'life.555978.xyz/username'

  function validateDetails(): string | null {
    if (unProblem) return unProblem
    if (!email.includes('@')) return '请输入有效的邮箱地址'
    if (password.length < 8) return '密码至少 8 位'
    if (password !== confirmPassword) return '两次密码不一致'
    if (!agreed) return '请同意用户协议和隐私政策'
    return null
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    const err = validateDetails()
    if (err) { setFormError(err); return }

    setLoading(true)
    setFormError('')
    try {
      const detail = await requestRegisterCode(email)
      setNotice(detail)
      setStep('verify')
    } catch (err2) {
      setFormError(err2 instanceof Error ? err2.message : '发送验证码失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) { setFormError('请输入验证码'); return }

    setLoading(true)
    setFormError('')
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        code: code.trim(),
        displayName: displayName.trim(),
        inviteCode: inviteCode.trim() || undefined,
      })
      navigate('/login?registered=1')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
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
          <div className="px-8 pb-6 pt-8">
            <h1 className="mb-1 text-lg font-medium text-[color:var(--foreground)]">注册账号</h1>
            <p className="mb-6 text-sm text-[color:var(--muted-foreground)]">
              {step === 'details' ? '开始记录你的人生空间' : '请查收邮箱里的验证码'}
            </p>

            {step === 'details' ? (
              <form onSubmit={e => void handleSendCode(e)} className="space-y-4">
                <div>
                  <label htmlFor="reg-username" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    用户名
                  </label>
                  <input
                    id="reg-username"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setFormError('') }}
                    placeholder="euan"
                    autoComplete="username"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    你的主页地址：{previewPath}
                  </p>
                  {username && unProblem && (
                    <p className="mt-1 text-xs text-[#B23B3B]">{unProblem}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-display" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    显示名称 <span className="font-normal text-[color:var(--muted-foreground)]">（可选）</span>
                  </label>
                  <input
                    id="reg-display"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Euan"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="reg-email" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    邮箱
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setFormError('') }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    用于登录、找回账号和安全通知，一个邮箱只能注册一个账号。
                  </p>
                </div>

                <div>
                  <label htmlFor="reg-password" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    密码
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setFormError('') }}
                    placeholder="至少 8 位"
                    autoComplete="new-password"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="reg-confirm" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    确认密码
                  </label>
                  <input
                    id="reg-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setFormError('') }}
                    autoComplete="new-password"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="reg-invite" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    邀请码 <span className="font-normal text-[color:var(--muted-foreground)]">（仅邀请注册时需要）</span>
                  </label>
                  <input
                    id="reg-invite"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <label className="flex items-start gap-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => { setAgreed(e.target.checked); setFormError('') }}
                    className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-[color:var(--primary)]"
                  />
                  我已阅读并同意用户协议与隐私政策
                </label>

                {formError && <p className="text-xs text-[#B23B3B]">{formError}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="life-button life-button-primary w-full text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? '发送中…' : '发送验证码'}
                </button>
              </form>
            ) : (
              <form onSubmit={e => void handleRegister(e)} className="space-y-4">
                {notice && (
                  <p className="rounded-[var(--radius)] bg-[color:var(--secondary)] px-3 py-2.5 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {notice}
                  </p>
                )}

                <div>
                  <label htmlFor="reg-code" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    邮箱验证码
                  </label>
                  <input
                    id="reg-code"
                    value={code}
                    onChange={e => { setCode(e.target.value); setFormError('') }}
                    placeholder="6 位数字"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    className="life-input w-full px-3 py-2 text-sm tracking-widest"
                  />
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    发送到 {email}，10 分钟内有效。
                  </p>
                </div>

                {formError && <p className="text-xs text-[#B23B3B]">{formError}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="life-button life-button-primary w-full text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? '创建中…' : '创建账号'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('details'); setFormError(''); setCode('') }}
                  className="w-full text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                >
                  ← 返回修改信息
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-[color:var(--border)] px-8 py-4 text-center">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              已有账号？{' '}
              <Link to="/login" className="text-[color:var(--primary)] hover:underline">
                登录
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[color:var(--muted-foreground)]">
          <Link to="/" className="transition-colors hover:text-[color:var(--foreground)]">
            ← 返回主页
          </Link>
        </p>
      </div>
    </div>
  )
}
