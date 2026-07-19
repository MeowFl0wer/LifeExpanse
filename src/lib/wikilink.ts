export interface WikiLink {
  /** Raw source, e.g. `[[slug|显示名]]` */
  raw: string
  /** What the link points at — a slug or a title. */
  target: string
  /** Text to render; falls back to the target. */
  display: string
}

interface LinkableItem {
  slug: string
  title: string
}

const LINK_PATTERN = /\[\[([^\][|]+?)(?:\|([^\][]*?))?\]\]/g

/**
 * Finds `[[wiki links]]` in Markdown.
 *
 * Supports `[[target]]` and `[[target|display]]`. Targets are matched later
 * against a slug or a title, so a note can be linked by either.
 */
export function parseWikiLinks(text: string): WikiLink[] {
  const links: WikiLink[] = []
  for (const match of text.matchAll(LINK_PATTERN)) {
    const target = match[1]!.trim()
    if (!target) continue
    const display = (match[2] ?? '').trim() || target
    links.push({ raw: match[0], target, display })
  }
  return links
}

/** Resolves a link target to an item, by slug first and then by title. */
export function resolveWikiLink<T extends LinkableItem>(
  target: string,
  items: readonly T[]
): T | undefined {
  const needle = target.trim().toLowerCase()
  if (!needle) return undefined
  return (
    items.find(item => item.slug.toLowerCase() === needle) ??
    items.find(item => item.title.toLowerCase() === needle)
  )
}

/** Link targets in a document that do not resolve to anything yet. */
export function unresolvedLinks<T extends LinkableItem>(
  body: string,
  items: readonly T[]
): string[] {
  const missing = parseWikiLinks(body)
    .filter(link => !resolveWikiLink(link.target, items))
    .map(link => link.target)
  return Array.from(new Set(missing))
}

/**
 * Items whose body links to `item`.
 *
 * The item itself is excluded, so a note that mentions its own title does not
 * appear in its own backlink list.
 */
export function backlinksTo<T extends LinkableItem>(
  item: T,
  items: readonly (T & { body: string })[]
): (T & { body: string })[] {
  return items.filter(candidate => {
    if (candidate.slug === item.slug) return false
    return parseWikiLinks(candidate.body).some(
      link => resolveWikiLink(link.target, [item]) !== undefined
    )
  })
}

/** Outgoing links from a document that resolve to an item. */
export function outgoingLinks<T extends LinkableItem>(
  body: string,
  items: readonly T[]
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const link of parseWikiLinks(body)) {
    const found = resolveWikiLink(link.target, items)
    if (found && !seen.has(found.slug)) {
      seen.add(found.slug)
      out.push(found)
    }
  }
  return out
}
