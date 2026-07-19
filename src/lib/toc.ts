export interface Heading {
  level: number
  text: string
  /** Anchor id, unique within the document. */
  id: string
}

/** Anchor-safe id. CJK is kept, since stripping it would leave nothing. */
export function headingId(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .replace(/^-+|-+$/g, '')
  return base || 'section'
}

/**
 * Extracts ATX headings (`## Title`) for a table of contents.
 *
 * Fenced code blocks are skipped so a `#` comment inside an example is not
 * mistaken for a heading. Duplicate titles get `-2`, `-3`… so every anchor is
 * unique and the TOC can scroll to the right one.
 */
export function extractHeadings(markdown: string, maxLevel = 3): Heading[] {
  const headings: Heading[] = []
  const used = new Map<string, number>()
  let inFence = false

  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!match) continue

    const level = match[1]!.length
    if (level > maxLevel) continue

    const text = match[2]!.trim()
    const base = headingId(text)
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)

    headings.push({ level, text, id: seen === 0 ? base : `${base}-${seen + 1}` })
  }

  return headings
}
