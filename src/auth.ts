const SESSION_KEY = 'life_session_user'

export function getCurrentUser(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function setCurrentUser(username: string): void {
  try {
    window.localStorage.setItem(SESSION_KEY, username)
  } catch {
    // localStorage unavailable (private mode, disabled storage) — session simply won't persist
  }
}

export function clearCurrentUser(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

export function isLoggedIn(): boolean {
  return getCurrentUser() !== null
}

/** Ch 21: the site owner is the super admin. Prototype stand-in for a role model. */
const SITE_OWNER = 'euan'

export function isAdmin(): boolean {
  return getCurrentUser() === SITE_OWNER
}

export function isOwnerOf(username: string | undefined): boolean {
  if (!username) return false
  return getCurrentUser() === username
}

/* ---- Ch 15.6: visitor sessions for encrypted spaces ----
 *
 * A visitor session is scoped to exactly one space. Holding a session for
 * space A must never grant access to space B, so every read checks the
 * requested spaceId against the stored one. Prototype only — a real backend
 * issues an HttpOnly cookie and re-validates space_id server side.
 */

const SPACE_SESSION_KEY = 'life_space_session'

interface SpaceSession {
  spaceId: string
  spaceKey: string
  expiresAt: number
}

function readSpaceSessions(): SpaceSession[] {
  try {
    const raw = window.sessionStorage.getItem(SPACE_SESSION_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as SpaceSession[]).filter(s => s.expiresAt > Date.now())
  } catch {
    return []
  }
}

function writeSpaceSessions(sessions: SpaceSession[]): void {
  try {
    window.sessionStorage.setItem(SPACE_SESSION_KEY, JSON.stringify(sessions))
  } catch {
    // ignore
  }
}

/** Grants access to one space only. Multiple spaces can be open in parallel tabs. */
export function grantSpaceSession(spaceId: string, spaceKey: string, ttlMinutes: number): void {
  const sessions = readSpaceSessions().filter(s => s.spaceId !== spaceId)
  sessions.push({ spaceId, spaceKey, expiresAt: Date.now() + ttlMinutes * 60_000 })
  writeSpaceSessions(sessions)
}

export function hasSpaceSession(spaceId: string): boolean {
  return readSpaceSessions().some(s => s.spaceId === spaceId)
}

export function revokeSpaceSession(spaceId: string): void {
  writeSpaceSessions(readSpaceSessions().filter(s => s.spaceId !== spaceId))
}
