import { headingId } from '../lib/toc'
import { parseWikiLinks } from '../lib/wikilink'
import { downloadUrl, isManagedMedia, thumbnailUrl } from '../lib/mediaUrl'

export interface WikiLinkTarget {
  /** Where the link should go, or undefined when nothing matches yet. */
  href?: string
  label: string
}

interface MarkdownRendererProps {
  content: string
  className?: string
  /**
   * Resolves `[[targets]]` to internal links. Without it, wiki links render as
   * plain text so the renderer stays usable outside the notes module.
   */
  resolveLink?: (target: string) => WikiLinkTarget | undefined
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseMarkdown(
  md: string,
  resolveLink?: (target: string) => WikiLinkTarget | undefined
): string {
  // Everything is escaped before any rule runs, so the only HTML in the output
  // is HTML this function produced. A body is Markdown, not a document — and
  // a public article is read by other people, so raw HTML here would mean one
  // author could run script in every reader's browser.
  //
  // `<script>` inserted via innerHTML is inert, but `<img onerror>` is not,
  // and `<iframe>` loads. Escaping up front closes the whole category rather
  // than the examples anyone happened to think of.
  let html = escapeHtml(md)

  // Wiki links run before other inline rules so their contents are not
  // mangled by emphasis or link parsing.
  if (resolveLink) {
    for (const link of parseWikiLinks(md)) {
      const resolved = resolveLink(link.target)
      // `[[slug]]` shows the target note's title; an explicit `[[x|别名]]` wins.
      const hasAlias = link.display !== link.target
      // The label and href come from the caller (a note title, a route), not
      // from the already-escaped body, so these still need escaping.
      const label = escapeHtml(hasAlias ? link.display : resolved?.label ?? link.display)
      const replacement = resolved?.href
        ? `<a class="wikilink" href="${escapeHtml(resolved.href)}">${label}</a>`
        : `<span class="wikilink wikilink-missing" title="尚未创建">${label}</span>`
      html = html.split(link.raw).join(replacement)
    }
  }

  // Code blocks (must come before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    // Already escaped by the pass at the top; escaping again would display
    // `&lt;script&gt;` where the author wrote `<script>`.
    return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`)

  // Headings, with anchors so the table of contents can scroll to them.
  const usedIds = new Map<string, number>()
  function anchorFor(text: string): string {
    const base = headingId(text.replace(/<[^>]+>/g, ''))
    const seen = usedIds.get(base) ?? 0
    usedIds.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen + 1}`
  }
  html = html.replace(/^(#{1,4}) (.+)$/gm, (_m, hashes: string, text: string) => {
    const level = hashes.length
    return `<h${level} id="${anchorFor(text)}">${text}</h${level}>`
  })

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Images (before links to avoid conflicts)
  // Images display the thumbnail. The original is only fetched when the
  // reader asks for it — a page of ten photos should not pull ten full-size
  // files to show them a few hundred pixels wide.
  //
  // The two controls sit in the bottom-right corner and appear on hover. On a
  // touch screen there is no hover, so they stay visible: a control nobody can
  // reach is not subtle design, it is a missing feature.
  // `@[video](url)` — the editor's own syntax, so inserting a video never
  // requires putting HTML in the body.
  html = html.replace(/@\[video\]\(([^)\s]+)\)/g, (_full, src: string) => {
    const poster = isManagedMedia(src) ? ` poster="${thumbnailUrl(src)}"` : ''
    return (
      `<video src="${src}"${poster} controls preload="metadata" ` +
      `class="life-video"></video>`
    )
  })

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_full, alt: string, src: string) => {
    if (!isManagedMedia(src)) {
      return `<img src="${src}" alt="${alt}" />`
    }
    return (
      `<span class="life-figure">` +
      `<img src="${thumbnailUrl(src)}" alt="${alt}" loading="lazy" />` +
      `<span class="life-figure-actions">` +
      `<a href="${src}" target="_blank" rel="noopener noreferrer">查看原图</a>` +
      `<a href="${downloadUrl(src)}" download>下载</a>` +
      `</span></span>`
    )
  })

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr />')

  // Unordered lists
  html = html.replace(/((?:^[-*] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line => `<li>${line.replace(/^[-*] /, '')}</li>`).join('')
    return `<ul>${items}</ul>`
  })

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line => `<li>${line.replace(/^\d+\. /, '')}</li>`).join('')
    return `<ol>${items}</ol>`
  })

  // Paragraphs (lines that aren't already block elements)
  const lines = html.split('\n')
  const result: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^<(h[1-6]|p|ul|ol|li|blockquote|pre|hr|img|div|video|span class="life-figure")/.test(trimmed)) {
      result.push(trimmed)
    } else {
      result.push(`<p>${trimmed}</p>`)
    }
  }

  return result.join('\n')
}

export default function MarkdownRenderer({ content, className = '', resolveLink }: MarkdownRendererProps) {
  const html = parseMarkdown(content, resolveLink)

  return (
    <div
      className={`prose max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
