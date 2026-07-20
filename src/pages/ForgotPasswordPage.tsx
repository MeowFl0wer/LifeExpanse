import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { forgotPassword, resetPassword } from '../api/account'

/**
 * Password recovery by emailed code.
 *
 * The first step always advances, and always shows the same message, whether
 * or not the address is registered. Stopping here with "no such account" would
 * turn this page into a way to test whether someone has an account.
 */

type Step = 'request' | 'reset'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('request')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) { setFormError('请输入有效的邮箱地址'); return }

    setLoading(true)
    setFormError('')
    try {
      // The result is the same either way — that is the point.
      const detail = await forgotPassword(email)
      setNotice(detail)
      setStep('reset')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) { setFormError('请输入验证码'); return }
    if (newPassword.length < 8) { setFormError('新密码至少 8 位'); return }
    if (newPassword !== confirm) { setFormError('两次密码不一致'); return }

    setLoading(true)
    setFormError('')
    try {
      await resetPassword(email, code.trim(), newPassword)
      navigate('/login?reset=1')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '重置失败，请稍后重试')
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
            <h1 className="mb-1 text-lg font-medium text-[color:var(--foreground)]">找回密码</h1>
            <p className="mb-6 text-sm text-[color:var(--muted-foreground)]">
              {step === 'request' ? '我们会向你的邮箱发送验证码' : '输入验证码并设置新密码'}
            </p>

            {step === 'request' ? (
              <form onSubmit={e => void handleRequest(e)} className="space-y-4">
                <div>
                  <label htmlFor="fp-email" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    邮箱
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setFormError('') }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    主邮箱或备用邮箱都可以。
                  </p>
                </div>

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
              <form onSubmit={e => void handleReset(e)} className="space-y-4">
                {notice && (
                  <p className="rounded-[var(--radius)] bg-[color:var(--secondary)] px-3 py-2.5 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {notice}
                  </p>
                )}

                <div>
                  <label htmlFor="fp-code" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    邮箱验证码
                  </label>
                  <input
                    id="fp-code"
                    value={code}
                    onChange={e => { setCode(e.target.value); setFormError('') }}
                    placeholder="6 位数字"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    className="life-input w-full px-3 py-2 text-sm tracking-widest"
                  />
                </div>

                <div>
                  <label htmlFor="fp-new" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    新密码
                  </label>
                  <input
                    id="fp-new"
                    type="password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setFormError('') }}
                    placeholder="至少 8 位"
                    autoComplete="new-password"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="fp-confirm" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                    确认新密码
                  </label>
                  <input
                    id="fp-confirm"
                    type="password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setFormError('') }}
                    autoComplete="new-password"
                    className="life-input w-full px-3 py-2 text-sm"
                  />
                </div>

                {formError && <p className="text-xs text-[#B23B3B]">{formError}</p>}

                <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                  重置成功后，所有设备上的登录都会退出。
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="life-button life-button-primary w-full text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? '重置中…' : '重置密码'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('request'); setFormError(''); setCode('') }}
                  className="w-full text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                >
                  ← 换一个邮箱
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-[color:var(--border)] px-8 py-4 text-center">
            <p className="text-xs text-[color:var(--muted-foreground)]">
              想起来了？{' '}
              <Link to="/login" className="text-[color:var(--primary)] hover:underline">
                返回登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
