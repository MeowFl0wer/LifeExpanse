/**
 * Derives a URL slug from a title. Non-ASCII titles (e.g. Chinese) leave
 * nothing usable behind, so the caller supplies a fallback rather than
 * producing an empty slug.
 */
export function slugify(title: string, fallback = 'entry'): string {
  const ascii = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || fallback
}

/**
 * Returns a slug that is not already present in `taken`, appending -2, -3, ...
 * Slugs address content, so a collision would make "view what I just saved"
 * open somebody else's older item.
 */
export function uniqueSlug(base: string, taken: readonly string[]): string {
  const root = base || 'entry'
  if (!taken.includes(root)) return root
  let n = 2
  while (taken.includes(`${root}-${n}`)) n++
  return `${root}-${n}`
}
