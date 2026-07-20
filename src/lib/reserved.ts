/**
 * Usernames that would shadow a platform route (需求 §259).
 *
 * Mirrors `RESERVED_USERNAMES` in `backend/app/accounts.py`. The server is the
 * authority — this copy only exists so the register form can say so before a
 * round trip. The two must be kept in step; the register page test checks a
 * handful of names to catch drift.
 */
export const RESERVED_USERNAMES = new Set([
  'about', 'account', 'admin', 'api', 'app', 'assets', 'auth', 'blog',
  'dashboard', 'diary', 'docs', 'explore', 'export', 'feed', 'flights',
  'help', 'home', 'import', 'login', 'logout', 'map', 'me', 'media', 'new',
  'notifications', 'pkm', 'privacy', 'public', 'register', 'reset', 'root',
  'rss', 'search', 'series', 'settings', 'signin', 'signout', 'signup',
  'site', 'space', 'static', 'status', 'support', 'system', 'tag', 'tags',
  'terms', 'thoughts', 'trajectory', 'trash', 'upload', 'user', 'users',
  'verify', 'www',
])
