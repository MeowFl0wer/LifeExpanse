import type { Visibility } from '../types'

/**
 * One source of truth for how each visibility state is coloured, shared by the
 * badge and the list filters so they can never drift apart.
 *
 * 公开 uses the teal from the hero accent (--sky-tint / #2D7182) rather than a
 * green: the app's primary green already means "selected", so a green 公开 chip
 * read as an active state rather than as a value.
 */
export const visibilityConfig: Record<Visibility, { label: string; classes: string }> = {
  public: { label: '公开', classes: 'bg-[#EEF7FB] text-[#2D7182] border-[#CDE4EE]' },
  private: { label: '私密', classes: 'bg-[#F6F8FA] text-[#5F6E78] border-[#E3EAF0]' },
  draft: { label: '草稿', classes: 'bg-[#FFF8E9] text-[#8A6428] border-[#F3E5BD]' },
}

interface VisibilityBadgeProps {
  visibility: Visibility
  className?: string
}

export default function VisibilityBadge({ visibility, className = '' }: VisibilityBadgeProps) {
  const { label, classes } = visibilityConfig[visibility]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes} ${className}`}
    >
      {label}
    </span>
  )
}
