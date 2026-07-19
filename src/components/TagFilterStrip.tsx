import { useState } from 'react'

interface TagFacet {
  name: string
  count: number
}

interface TagFilterStripProps {
  tags: TagFacet[]
  selected: string[]
  onChange: (next: string[]) => void
}

/**
 * Tag filter as an expandable strip rather than a dropdown: the toggle opens a
 * row of small pills between two rules, and tags are multi-selectable. The
 * caret points up while open, and the label reflects whether a filter is
 * currently applied.
 */
export default function TagFilterStrip({ tags, selected, onChange }: TagFilterStripProps) {
  const [open, setOpen] = useState(false)
  const active = selected.length > 0

  function toggleTag(name: string) {
    onChange(selected.includes(name) ? selected.filter(t => t !== name) : [...selected, name])
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
          active
            ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
            : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
        }`}
      >
        {active ? `已筛选标签 ${selected.length}` : '选择标签'}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`transition-transform ${open ? '' : 'rotate-180'}`}
          aria-hidden="true"
        >
          <path d="M2 6.5 5 3.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 border-y border-[color:var(--border)] py-3">
          {tags.length === 0 ? (
            <p className="text-xs text-[color:var(--muted-foreground)]">暂无标签</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  !active
                    ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                    : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                }`}
              >
                全部标签
              </button>
              {tags.map(tag => {
                const on = selected.includes(tag.name)
                return (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    aria-pressed={on}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      on
                        ? 'border-[#CDE4EE] bg-[#EEF7FB] text-[#2D7182]'
                        : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                    }`}
                  >
                    #{tag.name}
                    <span className="ml-1 opacity-60">{tag.count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
