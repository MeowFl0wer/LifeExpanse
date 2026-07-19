import type { Tag } from '../types'

interface TagListProps {
  tags: Tag[]
  className?: string
  small?: boolean
}

export default function TagList({ tags, className = '', small = false }: TagListProps) {
  if (!tags.length) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map(tag => (
        <span
          key={tag.id}
          className={`inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2 py-0.5 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary)] ${small ? 'text-xs' : 'text-xs'}`}
        >
          <span className="text-[color:var(--accent)] mr-0.5">#</span>
          {tag.name}
        </span>
      ))}
    </div>
  )
}
