/** Routes it makes no sense to bounce back to after signing in. */
const REJECTED_PREFIXES = ['/login', '/register', '/logout']

/**
 * Validates a `?next=` target before navigating to it.
 *
 * A bare `startsWith('/')` check is not enough: `//evil.com` and
 * `/\evil.com` are protocol-relative and would leave the site, and `/login`
 * would bounce the user straight back to where they came from. Anything that
 * fails the check falls back to `fallback`.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/app'): string {
  if (!next) return fallback

  let value = next.trim()
  if (!value.startsWith('/')) return fallback

  // Protocol-relative ("//host", "/\host") escapes the origin.
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback

  // Reject control characters that could smuggle a second URL past the check.
  if (/[\u0000-\u0020]/.test(value)) return fallback

  // Compare the path alone, so /login?x= is caught as well as /login.
  const path = value.split(/[?#]/)[0]!.toLowerCase().replace(/\/+$/, '') || '/'
  if (REJECTED_PREFIXES.some(p => path === p || path.startsWith(`${p}/`))) return fallback

  return value
}

/** Builds a login URL that returns to `from` after a successful sign-in. */
export function loginUrlFor(from: string): string {
  const target = safeNextPath(from, '')
  return target ? `/login?next=${encodeURIComponent(target)}` : '/login'
}
