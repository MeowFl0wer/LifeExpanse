import { useEffect, useState } from 'react'
import { extractHeadings } from '../lib/toc'

interface ArticleTocProps {
  body: string
}

/**
 * Table of contents for notes and articles (需求 10.3).
 *
 * Highlights the heading currently in view. Uses IntersectionObserver where
 * available and simply renders a static list otherwise, so the TOC still works
 * as navigation without it.
 */
export default function ArticleToc({ body }: ArticleTocProps) {
  const headings = extractHeadings(body)
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    if (headings.length === 0) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      // Bias towards the upper part of the viewport so the heading you are
      // reading under stays highlighted rather than the one below it.
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    )

    const nodes = headings
      .map(h => document.getElementById(h.id))
      .filter((n): n is HTMLElement => n !== null)
    nodes.forEach(node => observer.observe(node))

    return () => observer.disconnect()
    // Re-observe when the heading set changes.
  }, [headings.map(h => h.id).join('|')])

  if (headings.length === 0) return null

  return (
    <nav aria-label="内容目录" className="text-sm">
      <p className="life-kicker mb-3">目录</p>
      <ul className="space-y-1.5 border-l border-[color:var(--border)]">
        {headings.map(h => (
          <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 0.75 + 0.75}rem` }}>
            <a
              href={`#${h.id}`}
              onClick={e => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                setActiveId(h.id)
              }}
              className={`-ml-px block border-l-2 py-0.5 text-xs leading-6 transition-colors ${
                activeId === h.id
                  ? 'border-[color:var(--primary)] font-medium text-[color:var(--primary)]'
                  : 'border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
              }`}
              style={{ paddingLeft: '0.6rem' }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
