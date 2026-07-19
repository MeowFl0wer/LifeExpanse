import type { Visibility } from '../types'

interface VisibilityBadgeProps {
  visibility: Visibility
  className?: string
}

export default function VisibilityBadge({ visibility, className = '' }: VisibilityBadgeProps) {
  const configs = {
    public: { label: '公开', cls: 'bg-[#EEF8F0] text-[#3F744D] border-[#D5EBD9]' },
    private: { label: '私密', cls: 'bg-[#F6F8FA] text-[#5F6E78] border-[#E3EAF0]' },
    draft: { label: '草稿', cls: 'bg-[#FFF8E9] text-[#8A6428] border-[#F3E5BD]' },
  }
  const { label, cls } = configs[visibility]

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border rounded-full ${cls} ${className}`}
    >
      {label}
    </span>
  )
}
