import { ApiError } from './client'
import { request, usingBackend } from './http'

/**
 * Account flows: registration, recovery, and two-factor authentication.
 *
 * Same dispatch rule as the rest of `src/api/` — with no backend configured
 * these run against a small in-memory stand-in so the prototype and the test
 * suite work without a server. The stand-in mirrors the server's behaviour but
 * is **not** the authority: every rule here is enforced again server side.
 */

export interface TotpSetup {
  secret: string
  otpauthUri: string
}

export interface TotpStatus {
  enabled: boolean
  recoveryCodesLeft: number
}

/* ---------------- mock state (no backend) ---------------- */

const mockTaken = new Set(['euan@example.com'])
const mockCodes = new Map<string, string>()
const MOCK_CODE = '123456'

/** The neutral answer. Identical whether or not the address is in use. */
const NEUTRAL_REGISTER = '如果该邮箱可以使用，我们已发送验证码'
const NEUTRAL_RECOVER = '如果该邮箱存在，我们已发送验证码'

/* ---------------- registration ---------------- */

export async function requestRegisterCode(email: string): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/register/code', {
      method: 'POST',
      body: { email },
    })
    return res.detail
  }
  // Note what is *not* here: no branch that behaves differently for a taken
  // address. Telling them apart is the leak.
  if (!mockTaken.has(email.trim().toLowerCase())) {
    mockCodes.set(`register:${email.trim().toLowerCase()}`, MOCK_CODE)
  }
  return NEUTRAL_REGISTER
}

export interface RegisterInput {
  username: string
  email: string
  password: string
  code: string
  displayName?: string
  inviteCode?: string
}

export async function register(input: RegisterInput): Promise<{ username: string }> {
  if (usingBackend()) {
    const user = await request<{ username: string }>('/auth/register', {
      method: 'POST',
      body: {
        username: input.username,
        email: input.email,
        password: input.password,
        code: input.code,
        display_name: input.displayName ?? '',
        invite_code: input.inviteCode ?? null,
      },
    })
    return { username: user.username }
  }

  const address = input.email.trim().toLowerCase()
  const key = `register:${address}`
  // A taken address fails as a *code* error, so it is indistinguishable from
  // simply getting the code wrong.
  if (mockCodes.get(key) !== input.code) {
    throw new ApiError('验证码不正确或已过期', 400)
  }
  mockCodes.delete(key)
  mockTaken.add(address)
  return { username: input.username.toLowerCase() }
}

/* ---------------- password recovery ---------------- */

export async function forgotPassword(email: string): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/password/forgot', {
      method: 'POST',
      body: { email },
    })
    return res.detail
  }
  if (mockTaken.has(email.trim().toLowerCase())) {
    mockCodes.set(`reset:${email.trim().toLowerCase()}`, MOCK_CODE)
  }
  return NEUTRAL_RECOVER
}

export async function resetPassword(
  email: string, code: string, newPassword: string
): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/password/reset', {
      method: 'POST',
      body: { email, code, new_password: newPassword },
    })
    return res.detail
  }
  const key = `reset:${email.trim().toLowerCase()}`
  if (mockCodes.get(key) !== code) throw new ApiError('验证码不正确或已过期', 400)
  mockCodes.delete(key)
  return '密码已重置，请重新登录'
}

/* ---------------- step-up protected changes ---------------- */

export async function requestStepUpCode(
  purpose: 'change_password' | 'change_email' | 'disable_2fa'
): Promise<void> {
  if (usingBackend()) {
    await request<void>(`/auth/step-up/code?purpose=${purpose}`, { method: 'POST' })
    return
  }
  mockCodes.set(`stepup:${purpose}`, MOCK_CODE)
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
  emailCode?: string
  totpCode?: string
}

export async function changePassword(input: ChangePasswordInput): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/password/change', {
      method: 'POST',
      body: {
        current_password: input.currentPassword,
        new_password: input.newPassword,
        email_code: input.emailCode ?? null,
        totp_code: input.totpCode ?? null,
      },
    })
    return res.detail
  }
  // Mirrors the server: the current password alone is never enough.
  if (!input.emailCode && !input.totpCode) {
    throw new ApiError('需要邮箱验证码或两步验证码', 400)
  }
  if (input.emailCode && mockCodes.get('stepup:change_password') !== input.emailCode) {
    throw new ApiError('验证码不正确或已过期', 400)
  }
  mockCodes.delete('stepup:change_password')
  return '密码已修改'
}

export async function requestNewEmailCode(email: string): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/email/change/code', {
      method: 'POST',
      body: { email },
    })
    return res.detail
  }
  if (!mockTaken.has(email.trim().toLowerCase())) {
    mockCodes.set(`newemail:${email.trim().toLowerCase()}`, MOCK_CODE)
  }
  return NEUTRAL_REGISTER
}

export interface ChangeEmailInput {
  currentPassword: string
  newEmail: string
  newEmailCode: string
  emailCode?: string
  totpCode?: string
}

export async function changeEmail(input: ChangeEmailInput): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/email/change', {
      method: 'POST',
      body: {
        current_password: input.currentPassword,
        new_email: input.newEmail,
        new_email_code: input.newEmailCode,
        email_code: input.emailCode ?? null,
        totp_code: input.totpCode ?? null,
      },
    })
    return res.detail
  }
  if (!input.emailCode && !input.totpCode) {
    throw new ApiError('需要邮箱验证码或两步验证码', 400)
  }
  const key = `newemail:${input.newEmail.trim().toLowerCase()}`
  if (mockCodes.get(key) !== input.newEmailCode) {
    throw new ApiError('新邮箱验证码不正确或已过期', 400)
  }
  mockCodes.delete(key)
  return '邮箱已更新'
}

/* ---------------- two-factor authentication ---------------- */

let mockTotpEnabled = false
let mockRecoveryLeft = 0

export async function totpStatus(): Promise<TotpStatus> {
  if (usingBackend()) {
    const res = await request<{ enabled: boolean; recovery_codes_left: number }>('/auth/2fa/status')
    return { enabled: res.enabled, recoveryCodesLeft: res.recovery_codes_left }
  }
  return { enabled: mockTotpEnabled, recoveryCodesLeft: mockRecoveryLeft }
}

export async function totpSetup(): Promise<TotpSetup> {
  if (usingBackend()) {
    const res = await request<{ secret: string; otpauth_uri: string }>('/auth/2fa/setup', {
      method: 'POST',
    })
    return { secret: res.secret, otpauthUri: res.otpauth_uri }
  }
  const secret = 'JBSWY3DPEHPK3PXP'
  return {
    secret,
    otpauthUri: `otpauth://totp/euan?secret=${secret}&issuer=LifeExpanse`,
  }
}

export async function totpEnable(code: string): Promise<string[]> {
  if (usingBackend()) {
    const res = await request<{ codes: string[] }>('/auth/2fa/enable', {
      method: 'POST',
      body: { code },
    })
    return res.codes
  }
  if (code.trim().length !== 6) throw new ApiError('验证码不正确，请确认手机时间是否准确', 400)
  mockTotpEnabled = true
  mockRecoveryLeft = 10
  return Array.from({ length: 10 }, (_, i) => `ABCDE-${String(i).padStart(5, '0')}`)
}

export async function totpRegenerateRecoveryCodes(): Promise<string[]> {
  if (usingBackend()) {
    const res = await request<{ codes: string[] }>('/auth/2fa/recovery-codes', { method: 'POST' })
    return res.codes
  }
  mockRecoveryLeft = 10
  return Array.from({ length: 10 }, (_, i) => `FGHIJ-${String(i).padStart(5, '0')}`)
}

export async function totpDisable(
  currentPassword: string, emailCode?: string, totpCode?: string
): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/2fa/disable', {
      method: 'POST',
      body: {
        current_password: currentPassword,
        email_code: emailCode ?? null,
        totp_code: totpCode ?? null,
      },
    })
    return res.detail
  }
  if (!emailCode && !totpCode) throw new ApiError('需要邮箱验证码或两步验证码', 400)
  mockTotpEnabled = false
  mockRecoveryLeft = 0
  return '两步验证已关闭'
}

/** Test seam: resets the in-memory stand-in between tests. */
export function __resetAccountMock(): void {
  mockTaken.clear()
  mockTaken.add('euan@example.com')
  mockCodes.clear()
  mockTotpEnabled = false
  mockRecoveryLeft = 0
  mockBackup = ''
}

/* ---------------- backup email ---------------- */

let mockBackup = ''

export async function requestBackupEmailCode(email: string): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/email/backup/code', {
      method: 'POST',
      body: { email },
    })
    return res.detail
  }
  if (!mockTaken.has(email.trim().toLowerCase())) {
    mockCodes.set(`backup:${email.trim().toLowerCase()}`, MOCK_CODE)
  }
  return NEUTRAL_REGISTER
}

export interface SetBackupEmailInput {
  currentPassword: string
  backupEmail: string
  backupEmailCode: string
  emailCode?: string
  totpCode?: string
}

export async function setBackupEmail(input: SetBackupEmailInput): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/email/backup', {
      method: 'POST',
      body: {
        current_password: input.currentPassword,
        backup_email: input.backupEmail,
        backup_email_code: input.backupEmailCode,
        email_code: input.emailCode ?? null,
        totp_code: input.totpCode ?? null,
      },
    })
    return res.detail
  }
  if (!input.emailCode && !input.totpCode) {
    throw new ApiError('需要邮箱验证码或两步验证码', 400)
  }
  const key = `backup:${input.backupEmail.trim().toLowerCase()}`
  if (mockCodes.get(key) !== input.backupEmailCode) {
    throw new ApiError('备用邮箱验证码不正确或已过期', 400)
  }
  mockCodes.delete(key)
  mockBackup = input.backupEmail.trim().toLowerCase()
  return '备用邮箱已绑定'
}

export async function removeBackupEmail(
  currentPassword: string, emailCode?: string, totpCode?: string
): Promise<string> {
  if (usingBackend()) {
    const res = await request<{ detail: string }>('/auth/email/backup', {
      method: 'DELETE',
      body: {
        current_password: currentPassword,
        email_code: emailCode ?? null,
        totp_code: totpCode ?? null,
      },
    })
    return res.detail
  }
  if (!emailCode && !totpCode) throw new ApiError('需要邮箱验证码或两步验证码', 400)
  mockBackup = ''
  return '备用邮箱已解绑'
}

/** The address currently bound, or '' — read by the settings panel. */
export async function currentBackupEmail(): Promise<string> {
  if (usingBackend()) {
    const me = await request<{ backup_email: string | null }>('/auth/me')
    return me.backup_email ?? ''
  }
  return mockBackup
}

/* ---------------- profile ---------------- */

let mockDisplayName = 'Euan'

/**
 * Changes the display name and bio.
 *
 * There is no username parameter, and that is the point: `/{username}` is the
 * address of everything a person has published. Changing it would break every
 * link anyone saved, and freeing the old one would let somebody else inherit
 * that audience.
 */
export async function updateProfile(displayName: string, bio: string): Promise<void> {
  if (usingBackend()) {
    await request<void>('/auth/profile', {
      method: 'PATCH',
      body: { display_name: displayName, bio },
    })
    return
  }
  if (displayName.trim().toLowerCase() === 'alice') {
    throw new ApiError('该昵称已被使用', 409)
  }
  mockDisplayName = displayName.trim()
}

export function currentDisplayName(): string {
  return mockDisplayName
}
