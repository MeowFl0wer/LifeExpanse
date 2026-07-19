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

export function isOwnerOf(username: string | undefined): boolean {
  if (!username) return false
  return getCurrentUser() === username
}
