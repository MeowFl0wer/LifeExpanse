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
}

interface WireUser {
  id: string
  username: string
  display_name: string
  bio: string
}

const MOCK_USER = 'euan'
const MOCK_PASSWORD = 'demo123456'

export async function login(
  credential: string,
  password: string,
  remember: boolean
): Promise<AccountInfo> {
  if (!usingBackend()) {
    if ((credential === MOCK_USER || credential === 'euan@example.com') && password === MOCK_PASSWORD) {
      return { username: MOCK_USER, displayName: 'Euan' }
    }
    throw new Error('用户名或密码不正确')
  }
  const user = await request<WireUser>('/auth/login', {
    method: 'POST',
    body: { credential, password, remember },
  })
  return { username: user.username, displayName: user.display_name }
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
    return { username: user.username, displayName: user.display_name }
  } catch {
    return null
  }
}
