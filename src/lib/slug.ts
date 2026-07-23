/**
 * The most a slug may be. The backend column is `String(200)`; this leaves
 * headroom for the `-NN` uniqueness suffix so the two never disagree about
 * whether a value fits.
 */
export const MAX_SLUG_LENGTH = 180

/**
 * Derives a URL slug from a title.
 *
 * Non-ASCII titles (e.g. Chinese) leave nothing usable behind, so the caller
 * supplies a fallback rather than producing an empty slug.
 *
 * The result is length-capped: a title is user input, and an uncapped slug
 * would flow straight into a URL and a fixed-width database column. Cut on a
 * `-` where possible so a word is not sliced in half.
 */
export function slugify(title: string, fallback = 'entry'): string {
  const ascii = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return capSlug(ascii || fallback)
}

function capSlug(slug: string): string {
  if (slug.length <= MAX_SLUG_LENGTH) return slug
  const cut = slug.slice(0, MAX_SLUG_LENGTH)
  const lastDash = cut.lastIndexOf('-')
  // Prefer a word boundary, but only if it does not throw most of it away.
  const trimmed = lastDash > MAX_SLUG_LENGTH / 2 ? cut.slice(0, lastDash) : cut
  return trimmed.replace(/-+$/g, '')
}

/**
 * Returns a slug that is not already present in `taken`, appending -2, -3, ...
 * Slugs address content, so a collision would make "view what I just saved"
 * open somebody else's older item.
 */
export function uniqueSlug(base: string, taken: readonly string[]): string {
  // `base` is already capped by `slugify`, but callers can pass a raw string,
  // so cap here too. The suffix then always fits inside the column.
  const root = capSlug(base || 'entry')
  if (!taken.includes(root)) return root
  let n = 2
  while (taken.includes(`${root}-${n}`)) n++
  return `${root}-${n}`
}
