/**
 * URL allowlisting for anything that ends up in an `href` or `src`.
 *
 * Escaping the body stopped raw HTML, but a Markdown link is HTML the renderer
 * generates itself — and `[点我](javascript:alert(1))` produces a perfectly
 * valid, perfectly dangerous anchor. The scheme has to be checked separately.
 *
 * The rule is an allowlist, not a blocklist. `javascript:` is only the obvious
 * one; `data:text/html`, `vbscript:` and whatever a browser adds next are all
 * refused by saying what *is* allowed rather than listing what is not.
 */

/** Schemes a reader may be sent to from content. */
const LINK_SCHEMES = ['https:', 'mailto:']

/** Where an image or video may load from. */
const MEDIA_SCHEMES = ['https:']

/**
 * Strips what a scheme check can be hidden behind.
 *
 * Browsers ignore ASCII whitespace and control characters when parsing a
 * scheme, so `java\tscript:` and `  javascript:` both run. The comparison has
 * to see the same string the browser does.
 */
function normalise(raw: string): string {
  // C0/C1 controls, space, and the Unicode separators and bidi marks that can
  // sit invisibly inside a scheme. Written as escapes: the literal characters
  // are invisible in a diff, which is exactly how one gets removed by accident.
  return raw
    .replace(/[\u0000-\u0020\u007f-\u00a0\u1680\u2000-\u200f\u2028-\u202f\u205f-\u2064\u3000\ufeff]/g, '')
    .toLowerCase()
}


function schemeOf(raw: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/.exec(normalise(raw))
  return match ? `${match[1]}:` : null
}

/** Internal destinations: app routes and in-page anchors. */
function isInternal(raw: string): boolean {
  const cleaned = normalise(raw)
  // `//evil.example` is protocol-relative — it leaves the site despite the
  // leading slash, so "starts with /" is not enough on its own.
  if (cleaned.startsWith('//')) return false
  return cleaned.startsWith('/') || cleaned.startsWith('#')
}

/**
 * A link a reader may follow, or null if it must not be one.
 *
 * Callers render null as plain text: the address stays visible, it just is not
 * clickable. Dropping it entirely would hide what the author wrote.
 */
export function safeLinkUrl(raw: string): string | null {
  const url = raw.trim()
  if (!url) return null
  if (isInternal(url)) return url

  const scheme = schemeOf(url)
  // No scheme and not internal — e.g. `example.com/page`. Refused rather than
  // guessed at: prefixing `https://` would invent a destination the author
  // did not write.
  if (scheme === null) return null
  return LINK_SCHEMES.includes(scheme) ? url : null
}

/**
 * A source an image or video may load from, or null.
 *
 * Stricter than links, because media loads without the reader doing anything:
 * `data:` is refused outright, since `data:text/html` in the wrong element is
 * a document rather than a picture.
 */
export function safeMediaUrl(raw: string): string | null {
  const url = raw.trim()
  if (!url) return null
  if (isInternal(url)) return url

  const scheme = schemeOf(url)
  if (scheme === null) return null
  return MEDIA_SCHEMES.includes(scheme) ? url : null
}
