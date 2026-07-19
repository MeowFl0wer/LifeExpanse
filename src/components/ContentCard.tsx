import { Link } from 'react-router-dom'
import type { ContentItem } from '../types'
import TagList from './TagList'
import VisibilityBadge from './VisibilityBadge'

interface ContentCardProps {
  item: ContentItem
  showVisibility?: boolean
  compact?: boolean
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
}

function getDetailPath(item: ContentItem): string {
  const typeMap: Record<ContentItem['type'], string> = {
    diary: 'diary',
    pkm: 'pkm',
    thought: 'thoughts',
  }
  return `/euan/${typeMap[item.type]}/${item.slug}`
}

export default function ContentCard({ item, showVisibility = false, compact = false }: ContentCardProps) {
  const path = getDetailPath(item)

  return (
    <article
      className={`group border-b border-[color:var(--border)] ${compact ? 'py-4' : 'py-6'} transition-colors`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {showVisibility && <VisibilityBadge visibility={item.visibility} />}
            {item.type === 'pkm' && item.contentKind && (
              <span className="rounded-full bg-[color:var(--secondary)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                {item.contentKind === 'article' ? '文章' : '笔记'}
              </span>
            )}
            {item.type === 'thought' && item.thoughtType && (
              <span className="rounded-full bg-[color:var(--secondary)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                {item.thoughtType === 'excerpt' ? '摘录' : '原创'}
              </span>
            )}
            <time
              className="text-xs text-[color:var(--muted-foreground)]"
              dateTime={item.publishedAt || item.createdAt}
            >
              {formatDate(item.publishedAt || item.createdAt)}
            </time>
          </div>

          <Link
            to={path}
            className="block group-hover:text-[color:var(--primary)] transition-colors no-underline"
          >
            <h3
              className={`font-medium leading-snug text-[color:var(--foreground)] group-hover:text-[color:var(--primary)] transition-colors ${compact ? 'text-sm' : 'text-lg'}`}
            >
              {item.title}
            </h3>
          </Link>

          {!compact && item.summary && (
            <p className="mt-1.5 text-sm text-[color:var(--muted-foreground)] leading-relaxed line-clamp-2">
              {item.summary}
            </p>
          )}

          {item.tags.length > 0 && (
            <TagList tags={item.tags} className="mt-2" small />
          )}
        </div>

        <Link
          to={path}
          className="shrink-0 mt-1 text-[color:var(--border)] group-hover:text-[color:var(--primary)] transition-colors"
          tabIndex={-1}
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </article>
  )
}
