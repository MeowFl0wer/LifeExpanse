import { useEffect, useState } from 'react'
import {
  changeEmail, changePassword, currentBackupEmail, removeBackupEmail,
  requestBackupEmailCode, requestNewEmailCode, requestStepUpCode, setBackupEmail,
  totpDisable, totpEnable, totpSetup, totpStatus,
  type TotpSetup, type TotpStatus,
} from '../api/account'
import { maskEmail } from '../lib/mask'

/**
 * The security half of the settings page.
 *
 * The recurring shape: a sensitive change needs the current password **plus**
 * a second proof — an emailed code, or a code from the authenticator when the
 * address is no longer reachable. The forms enforce that one of the two is
 * filled in, and the server enforces it again.
 */

function Field({
  id, label, hint, ...rest
}: {
  id: string
  label: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
        {label}
      </label>
      <input id={id} className="life-input w-full px-3 py-2 text-sm" {...rest} />
      {hint && <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{hint}</p>}
    </div>
  )
}

function Feedback({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="text-xs text-[#B23B3B]">{error}</p>
  if (ok) return <p className="text-xs text-[color:var(--primary)]">{ok}</p>
  return null
}

/** Shared by every sensitive form: an email code or an authenticator code. */
function SecondProof({
  idPrefix, emailCode, totpCode, onEmailCode, onTotpCode, onSendCode, sending, sent, totpEnabled,
}: {
  /** This block appears more than once on the page, so ids must not collide. */
  idPrefix: string
  emailCode: string
  totpCode: string
  onEmailCode: (v: string) => void
  onTotpCode: (v: string) => void
  onSendCode: () => void
  sending: boolean
  sent: boolean
  totpEnabled: boolean
}) {
  return (
    <div className="space-y-3 rounded-[var(--radius)] bg-[color:var(--secondary)] p-4">
      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
        此操作需要二次验证。
        {totpEnabled ? '可使用邮箱验证码或两步验证码。' : '请使用邮箱验证码。'}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor={`${idPrefix}-email-code`} className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
            邮箱验证码
          </label>
          <input
            id={`${idPrefix}-email-code`}
            value={emailCode}
            onChange={e => onEmailCode(e.target.value)}
            placeholder="6 位数字"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="life-input w-full px-3 py-2 text-sm tracking-widest"
          />
        </div>
        <button
          type="button"
          onClick={onSendCode}
          disabled={sending}
          className="life-button shrink-0 px-3 py-2 text-xs disabled:opacity-60"
        >
          {sending ? '发送中…' : sent ? '重新发送' : '发送到主邮箱'}
        </button>
      </div>

      {totpEnabled && (
        <div>
          <label htmlFor={`${idPrefix}-totp-code`} className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
            或：两步验证码
          </label>
          <input
            id={`${idPrefix}-totp-code`}
            value={totpCode}
            onChange={e => onTotpCode(e.target.value)}
            placeholder="验证器 6 位数字，或恢复码"
            className="life-input w-full px-3 py-2 text-sm tracking-widest"
          />
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            当邮箱无法接收验证码时使用。
          </p>
        </div>
      )}
    </div>
  )
}

export default function SecuritySettings() {
  const [status, setStatus] = useState<TotpStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    totpStatus()
      .then(s => { if (!cancelled) setStatus(s) })
      .catch(() => { if (!cancelled) setStatus({ enabled: false, recoveryCodesLeft: 0 }) })
    return () => { cancelled = true }
  }, [])

  const totpEnabled = status?.enabled ?? false

  return (
    <div className="space-y-10">
      <PasswordSection totpEnabled={totpEnabled} />
      <EmailSection totpEnabled={totpEnabled} />
      <BackupEmailSection totpEnabled={totpEnabled} />
      <TwoFactorSection status={status} onChange={setStatus} />
    </div>
  )
}

/* ---------------- password ---------------- */

function PasswordSection({ totpEnabled }: { totpEnabled: boolean }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function sendCode() {
    setSending(true)
    setError('')
    try {
      await requestStepUpCode('change_password')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) { setError('新密码至少 8 位'); return }
    if (next !== confirm) { setError('两次密码不一致'); return }
    if (!emailCode && !totpCode) { setError('需要邮箱验证码或两步验证码'); return }

    setBusy(true)
    setError('')
    setOk('')
    try {
      const detail = await changePassword({
        currentPassword: current,
        newPassword: next,
        emailCode: emailCode || undefined,
        totpCode: totpCode || undefined,
      })
      setOk(detail)
      setCurrent(''); setNext(''); setConfirm(''); setEmailCode(''); setTotpCode(''); setSent(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="text-base font-medium text-[color:var(--foreground)]">修改密码</h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        修改密码需同时验证当前密码与邮箱验证码。仅凭当前密码不足以完成修改，
        以防设备在未锁定状态下被他人操作。
      </p>

      <form onSubmit={e => void submit(e)} className="mt-4 space-y-4 sm:max-w-md">
        <Field
          id="pw-current" label="当前密码" type="password" autoComplete="current-password"
          value={current} onChange={e => { setCurrent(e.target.value); setError('') }}
        />
        <Field
          id="pw-new" label="新密码" type="password" autoComplete="new-password" placeholder="至少 8 位"
          value={next} onChange={e => { setNext(e.target.value); setError('') }}
        />
        <Field
          id="pw-confirm" label="确认新密码" type="password" autoComplete="new-password"
          value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }}
        />

        <SecondProof
          idPrefix="pw"
          emailCode={emailCode} totpCode={totpCode}
          onEmailCode={v => { setEmailCode(v); setError('') }}
          onTotpCode={v => { setTotpCode(v); setError('') }}
          onSendCode={() => void sendCode()}
          sending={sending} sent={sent} totpEnabled={totpEnabled}
        />

        <Feedback error={error} ok={ok} />

        <button
          type="submit"
          disabled={busy}
          className="life-button life-button-primary text-sm disabled:opacity-60"
        >
          {busy ? '修改中…' : '修改密码'}
        </button>
      </form>
    </section>
  )
}

/* ---------------- email ---------------- */

function EmailSection({ totpEnabled }: { totpEnabled: boolean }) {
  const [current, setCurrent] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newEmailCode, setNewEmailCode] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [sendingOwner, setSendingOwner] = useState(false)
  const [sentOwner, setSentOwner] = useState(false)
  const [sendingNew, setSendingNew] = useState(false)
  const [newNotice, setNewNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function sendOwnerCode() {
    setSendingOwner(true)
    setError('')
    try {
      await requestStepUpCode('change_email')
      setSentOwner(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setSendingOwner(false)
    }
  }

  async function sendNewCode() {
    if (!newEmail.includes('@')) { setError('请输入有效的新邮箱'); return }
    setSendingNew(true)
    setError('')
    try {
      setNewNotice(await requestNewEmailCode(newEmail))
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setSendingNew(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmailCode) { setError('请输入新邮箱收到的验证码'); return }
    if (!emailCode && !totpCode) { setError('需要邮箱验证码或两步验证码'); return }

    setBusy(true)
    setError('')
    setOk('')
    try {
      const detail = await changeEmail({
        currentPassword: current,
        newEmail,
        newEmailCode,
        emailCode: emailCode || undefined,
        totpCode: totpCode || undefined,
      })
      setOk(detail)
      setCurrent(''); setNewEmail(''); setNewEmailCode(''); setEmailCode(''); setTotpCode('')
      setSentOwner(false); setNewNotice('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border-t border-[color:var(--border)] pt-8">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">更换主邮箱</h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        新旧邮箱均需完成验证。更换成功后，系统会向原邮箱发送变更通知，
        以便在账号被他人操作时及时察觉。
      </p>

      <form onSubmit={e => void submit(e)} className="mt-4 space-y-4 sm:max-w-md">
        <Field
          id="em-current" label="当前密码" type="password" autoComplete="current-password"
          value={current} onChange={e => { setCurrent(e.target.value); setError('') }}
        />

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label htmlFor="em-new" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
              新邮箱
            </label>
            <input
              id="em-new" type="email" autoComplete="email"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setError('') }}
              className="life-input w-full px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void sendNewCode()}
            disabled={sendingNew}
            className="life-button shrink-0 px-3 py-2 text-xs disabled:opacity-60"
          >
            {sendingNew ? '发送中…' : '发送验证码'}
          </button>
        </div>
        {newNotice && (
          <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">{newNotice}</p>
        )}

        <Field
          id="em-newcode" label="新邮箱验证码" placeholder="6 位数字" inputMode="numeric"
          value={newEmailCode} onChange={e => { setNewEmailCode(e.target.value); setError('') }}
        />

        <SecondProof
          idPrefix="em"
          emailCode={emailCode} totpCode={totpCode}
          onEmailCode={v => { setEmailCode(v); setError('') }}
          onTotpCode={v => { setTotpCode(v); setError('') }}
          onSendCode={() => void sendOwnerCode()}
          sending={sendingOwner} sent={sentOwner} totpEnabled={totpEnabled}
        />

        <Feedback error={error} ok={ok} />

        <button
          type="submit"
          disabled={busy}
          className="life-button life-button-primary text-sm disabled:opacity-60"
        >
          {busy ? '更换中…' : '更换邮箱'}
        </button>
      </form>
    </section>
  )
}

/* ---------------- backup email ---------------- */

function BackupEmailSection({ totpEnabled }: { totpEnabled: boolean }) {
  const [bound, setBound] = useState<string | null>(null)
  const [current, setCurrent] = useState('')
  const [address, setAddress] = useState('')
  const [addressCode, setAddressCode] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [sendingOwner, setSendingOwner] = useState(false)
  const [sentOwner, setSentOwner] = useState(false)
  const [sendingNew, setSendingNew] = useState(false)
  const [newNotice, setNewNotice] = useState('')
  const [removing, setRemoving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    let cancelled = false
    currentBackupEmail()
      .then(v => { if (!cancelled) setBound(v) })
      .catch(() => { if (!cancelled) setBound('') })
    return () => { cancelled = true }
  }, [])

  function reset() {
    setCurrent(''); setAddress(''); setAddressCode('')
    setEmailCode(''); setTotpCode(''); setSentOwner(false); setNewNotice('')
  }

  async function sendOwnerCode() {
    setSendingOwner(true)
    setError('')
    try {
      await requestStepUpCode('change_email')
      setSentOwner(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setSendingOwner(false)
    }
  }

  async function sendAddressCode() {
    if (!address.includes('@')) { setError('请输入有效的备用邮箱'); return }
    setSendingNew(true)
    setError('')
    try {
      setNewNotice(await requestBackupEmailCode(address))
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setSendingNew(false)
    }
  }

  async function submitBind(e: React.FormEvent) {
    e.preventDefault()
    if (!addressCode) { setError('请输入备用邮箱收到的验证码'); return }
    if (!emailCode && !totpCode) { setError('需要邮箱验证码或两步验证码'); return }

    setBusy(true)
    setError('')
    setOk('')
    try {
      const detail = await setBackupEmail({
        currentPassword: current,
        backupEmail: address,
        backupEmailCode: addressCode,
        emailCode: emailCode || undefined,
        totpCode: totpCode || undefined,
      })
      setOk(detail)
      setBound(address.trim().toLowerCase())
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定失败')
    } finally {
      setBusy(false)
    }
  }

  async function submitRemove(e: React.FormEvent) {
    e.preventDefault()
    if (!emailCode && !totpCode) { setError('需要邮箱验证码或两步验证码'); return }

    setBusy(true)
    setError('')
    setOk('')
    try {
      const detail = await removeBackupEmail(current, emailCode || undefined, totpCode || undefined)
      setOk(detail)
      setBound('')
      setRemoving(false)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : '解绑失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border-t border-[color:var(--border)] pt-8">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">备用邮箱</h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        备用邮箱可用于登录与找回密码。由于它同样是账号的访问凭据，
        绑定与解绑均需验证当前密码及邮箱验证码。
      </p>

      {bound === null ? (
        <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">加载中…</p>
      ) : bound ? (
        <div className="mt-4">
          <p className="text-sm text-[color:var(--foreground)]">
            已绑定
            <span className="ml-2 text-[color:var(--muted-foreground)]">{maskEmail(bound)}</span>
          </p>

          {removing ? (
            <form onSubmit={e => void submitRemove(e)} className="mt-4 space-y-4 sm:max-w-md">
              <Field
                id="bk-remove-pass" label="当前密码" type="password" autoComplete="current-password"
                value={current} onChange={e => { setCurrent(e.target.value); setError('') }}
              />
              <SecondProof
                idPrefix="bk-remove"
                emailCode={emailCode} totpCode={totpCode}
                onEmailCode={v => { setEmailCode(v); setError('') }}
                onTotpCode={v => { setTotpCode(v); setError('') }}
                onSendCode={() => void sendOwnerCode()}
                sending={sendingOwner} sent={sentOwner} totpEnabled={totpEnabled}
              />
              <Feedback error={error} />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="life-button text-sm text-[#B23B3B] disabled:opacity-60">
                  {busy ? '解绑中…' : '确认解绑'}
                </button>
                <button type="button" onClick={() => { setRemoving(false); reset(); setError('') }} className="life-button text-sm">
                  取消
                </button>
              </div>
            </form>
          ) : (
            <>
              <Feedback ok={ok} />
              <button type="button" onClick={() => setRemoving(true)} className="life-button mt-3 text-sm">
                解绑备用邮箱
              </button>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={e => void submitBind(e)} className="mt-4 space-y-4 sm:max-w-md">
          <Field
            id="bk-pass" label="当前密码" type="password" autoComplete="current-password"
            value={current} onChange={e => { setCurrent(e.target.value); setError('') }}
          />

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1">
              <label htmlFor="bk-address" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                备用邮箱
              </label>
              <input
                id="bk-address" type="email" autoComplete="email"
                value={address}
                onChange={e => { setAddress(e.target.value); setError('') }}
                className="life-input w-full px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void sendAddressCode()}
              disabled={sendingNew}
              className="life-button shrink-0 px-3 py-2 text-xs disabled:opacity-60"
            >
              {sendingNew ? '发送中…' : '发送验证码'}
            </button>
          </div>
          {newNotice && (
            <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">{newNotice}</p>
          )}

          <Field
            id="bk-address-code" label="备用邮箱验证码" placeholder="6 位数字" inputMode="numeric"
            value={addressCode} onChange={e => { setAddressCode(e.target.value); setError('') }}
          />

          <SecondProof
            idPrefix="bk"
            emailCode={emailCode} totpCode={totpCode}
            onEmailCode={v => { setEmailCode(v); setError('') }}
            onTotpCode={v => { setTotpCode(v); setError('') }}
            onSendCode={() => void sendOwnerCode()}
            sending={sendingOwner} sent={sentOwner} totpEnabled={totpEnabled}
          />

          <Feedback error={error} ok={ok} />

          <button
            type="submit"
            disabled={busy}
            className="life-button life-button-primary text-sm disabled:opacity-60"
          >
            {busy ? '绑定中…' : '绑定备用邮箱'}
          </button>
        </form>
      )}
    </section>
  )
}

/* ---------------- two-factor ---------------- */

function TwoFactorSection({
  status, onChange,
}: { status: TotpStatus | null; onChange: (s: TotpStatus) => void }) {
  const [setup, setSetup] = useState<TotpSetup | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [disabling, setDisabling] = useState(false)
  const [password, setPassword] = useState('')
  const [disableCode, setDisableCode] = useState('')

  async function beginSetup() {
    setBusy(true)
    setError('')
    try {
      setSetup(await totpSetup())
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法开始设置')
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setCodes(await totpEnable(code))
      onChange({ enabled: true, recoveryCodesLeft: 10 })
      setSetup(null)
      setCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '开启失败')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await totpDisable(password, undefined, disableCode)
      onChange({ enabled: false, recoveryCodesLeft: 0 })
      setDisabling(false)
      setPassword(''); setDisableCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '关闭失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border-t border-[color:var(--border)] pt-8">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">两步验证</h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        为账号增加一层独立于密码的验证。开启后，登录时除密码外还需提供
        身份验证器（如 Google Authenticator、1Password）生成的一次性动态口令。
        即使密码泄露，他人也无法登录。
      </p>

      {/* Shown once, right after enabling. Nothing can display them again. */}
      {codes && (
        <div className="life-surface mt-4 p-5">
          <p className="text-sm font-medium text-[color:var(--foreground)]">恢复码</p>
          <p className="mt-1 text-xs leading-6 text-[#B23B3B]">
            请立即保存至安全位置。恢复码仅显示一次，关闭后无法再次查看。
            当身份验证器不可用时（设备丢失或更换），恢复码是登录本账号的唯一方式。
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs text-[color:var(--foreground)]">
            {codes.map(c => <li key={c}>{c}</li>)}
          </ul>
          <button
            type="button"
            onClick={() => setCodes(null)}
            className="life-button mt-4 text-xs"
          >
            我已保存
          </button>
        </div>
      )}

      <div className="mt-4">
        {status === null ? (
          <p className="text-sm text-[color:var(--muted-foreground)]">加载中…</p>
        ) : status.enabled ? (
          <>
            <p className="text-sm text-[color:var(--foreground)]">
              已开启
              <span className="ml-2 text-xs text-[color:var(--muted-foreground)]">
                剩余恢复码 {status.recoveryCodesLeft} 个
              </span>
            </p>

            {disabling ? (
              <form onSubmit={e => void confirmDisable(e)} className="mt-4 space-y-3 sm:max-w-md">
                <Field
                  id="tf-pass" label="当前密码" type="password" autoComplete="current-password"
                  value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                />
                <Field
                  id="tf-code" label="两步验证码" placeholder="验证器 6 位数字，或恢复码"
                  value={disableCode} onChange={e => { setDisableCode(e.target.value); setError('') }}
                />
                <Feedback error={error} />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="life-button text-sm text-[#B23B3B] disabled:opacity-60">
                    {busy ? '关闭中…' : '确认关闭'}
                  </button>
                  <button type="button" onClick={() => { setDisabling(false); setError('') }} className="life-button text-sm">
                    取消
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setDisabling(true)} className="life-button mt-3 text-sm">
                关闭两步验证
              </button>
            )}
          </>
        ) : setup ? (
          <form onSubmit={e => void confirmEnable(e)} className="space-y-4 sm:max-w-md">
            <div className="life-surface p-5">
              <p className="text-sm text-[color:var(--foreground)]">在 Authenticator 里添加这个密钥：</p>
              <p className="mt-2 break-all font-mono text-sm text-[color:var(--foreground)]">{setup.secret}</p>
              <p className="mt-3 break-all text-xs text-[color:var(--muted-foreground)]">{setup.otpauthUri}</p>
            </div>
            <Field
              id="tf-verify" label="输入验证器显示的 6 位数字" placeholder="000000" inputMode="numeric"
              hint="验证通过后两步验证才会开启。若密钥添加有误而此时已启用，你将无法再登录本账号。"
              value={code} onChange={e => { setCode(e.target.value); setError('') }}
            />
            <Feedback error={error} />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="life-button life-button-primary text-sm disabled:opacity-60">
                {busy ? '验证中…' : '开启两步验证'}
              </button>
              <button type="button" onClick={() => { setSetup(null); setError('') }} className="life-button text-sm">
                取消
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm text-[color:var(--muted-foreground)]">未开启</p>
            <Feedback error={error} />
            <button
              type="button"
              onClick={() => void beginSetup()}
              disabled={busy}
              className="life-button life-button-primary mt-3 text-sm disabled:opacity-60"
            >
              {busy ? '准备中…' : '开启两步验证'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
