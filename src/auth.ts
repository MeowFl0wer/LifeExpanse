import { useSyncExternalStore } from 'react'
import { clearDraftsFor } from './api/drafts'

const SESSION_KEY = 'life_session_user'

/* The session is a reactive store rather than a bare localStorage read.
 * Reading localStorage during render gives the right answer once but never
 * updates, so a header rendered before login keeps showing the logged-out
 * state until a full reload. Subscribers are notified on every change, and
 * `storage` events keep other tabs in sync. */

type Listener = () => void
const listeners = new Set<Listener>()

/** Cached so getSnapshot returns a stable reference between notifications. */
let cachedUser: string | null = readSession()

/**
 * Persistent ("保持登录") sessions live in localStorage and survive a browser
 * restart; otherwise the session lives in sessionStorage and ends with the tab.
 * localStorage is checked first so a remembered login wins.
 */
function readSession(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function emit(): void {
  cachedUser = readSession()
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  // Login or logout in another tab should not leave this one stale.
  window.addEventListener('storage', event => {
    if (event.key === SESSION_KEY || event.key === null) emit()
  })
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCurrentUser(): string | null {
  return cachedUser
}

export function setCurrentUser(username: string, options: { remember?: boolean } = {}): void {
  const remember = options.remember ?? false
  try {
    if (remember) {
      window.localStorage.setItem(SESSION_KEY, username)
      window.sessionStorage.removeItem(SESSION_KEY)
    } else {
      window.sessionStorage.setItem(SESSION_KEY, username)
      window.localStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // Storage unavailable (private mode, disabled storage) — session won't persist
  }
  emit()
}

export function clearCurrentUser(): void {
  // Drafts belong to the person who wrote them; logging out must not leave
  // them visible to whoever signs in next on this browser.
  const leaving = cachedUser
  if (leaving) void clearDraftsFor(leaving)
  try {
    window.localStorage.removeItem(SESSION_KEY)
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
  emit()
}

/**
 * Subscribes a component to the session. Use this instead of getCurrentUser()
 * anywhere the UI must change when the user logs in or out.
 */
export function useCurrentUser(): string | null {
  return useSyncExternalStore(subscribe, getCurrentUser, () => null)
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

/* Reactive variants. Prefer these inside components so the UI updates the
 * moment the session changes, instead of only after a remount. */

export function useIsLoggedIn(): boolean {
  return useCurrentUser() !== null
}

export function useIsAdmin(): boolean {
  return useCurrentUser() === SITE_OWNER
}

export function useIsOwnerOf(username: string | undefined): boolean {
  const current = useCurrentUser()
  if (!username) return false
  return current === username
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
