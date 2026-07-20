import { request, usingBackend } from './http'

/**
 * Authentication against the backend.
 *
 * The session lives in an HttpOnly cookie the browser cannot read, so the
 * signed-in identity is fetched from `/auth/me` rather than decoded locally.
 * With no backend configured these fall back to the prototype's mock login.
 */

export interface AccountInfo {
  username: string
  displayName: string
  /** 'admin' or 'user'. Decides what to render; the server re-checks it. */
  role: string
}

interface WireUser {
  id: string
  username: string
  display_name: string
  bio: string
  role?: string
}

const MOCK_USER = 'euan'
const MOCK_PASSWORD = 'demo123456'

/**
 * Thrown when the password was right but a second factor is still needed.
 *
 * A distinct type rather than a flag, so a caller cannot accidentally treat
 * "needs 2FA" as a successful sign-in.
 */
export class TwoFactorRequired extends Error {
  constructor(message = '需要两步验证码') {
    super(message)
    this.name = 'TwoFactorRequired'
  }
}

export async function login(
  credential: string,
  password: string,
  remember: boolean,
  totpCode?: string
): Promise<AccountInfo> {
  if (!usingBackend()) {
    if ((credential === MOCK_USER || credential === 'euan@example.com') && password === MOCK_PASSWORD) {
      return { username: MOCK_USER, displayName: 'Euan', role: 'user' }
    }
    throw new Error('用户名或密码不正确')
  }
  try {
    const user = await request<WireUser>('/auth/login', {
      method: 'POST',
      body: { credential, password, remember, totp_code: totpCode ?? null },
    })
    return { username: user.username, displayName: user.display_name, role: user.role ?? 'user' }
  } catch (err) {
    // The server answers 401 with this message when the password checked out
    // but the account has 2FA on.
    if (err instanceof Error && err.message.includes('两步验证码')) {
      throw new TwoFactorRequired(err.message)
    }
    throw err
  }
}

export async function logout(): Promise<void> {
  if (!usingBackend()) return
  try {
    await request<void>('/auth/logout', { method: 'POST' })
  } catch {
    // Already signed out server side; the local session is cleared regardless.
  }
}

/** Who the cookie says we are, or null. Used to restore a session on load. */
export async function fetchCurrentUser(): Promise<AccountInfo | null> {
  if (!usingBackend()) return null
  try {
    const user = await request<WireUser>('/auth/me')
    return { username: user.username, displayName: user.display_name, role: user.role ?? 'user' }
  } catch {
    return null
  }
}
