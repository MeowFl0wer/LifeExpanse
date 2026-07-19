interface LibraryCoverProps {
  name: string
  kind: 'folder' | 'series'
  cover?: string
  className?: string
}

/** Stable hue per name, so a folder keeps the same default cover across renders. */
function hueFor(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return hash % 360
}

/**
 * Cover art for a folder or series. Uses the uploaded image when there is one,
 * otherwise draws a tinted folder/stack glyph derived from the name so every
 * item still reads as distinct without anyone having to upload anything.
 */
export default function LibraryCover({ name, kind, cover, className = '' }: LibraryCoverProps) {
  if (cover) {
    return (
      <div className={`overflow-hidden rounded-[var(--radius)] bg-[color:var(--muted)] ${className}`}>
        <img src={cover} alt="" className="h-full w-full object-cover" />
      </div>
    )
  }

  const hue = hueFor(name)
  const bg = `hsl(${hue} 42% 95%)`
  const fg = `hsl(${hue} 34% 58%)`

  return (
    <div
      className={`flex items-center justify-center rounded-[var(--radius)] ${className}`}
      style={{ background: bg }}
      aria-hidden="true"
    >
      {kind === 'folder' ? (
        <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2a1.5 1.5 0 0 1 1.06.44l1.24 1.24h8.5A1.5 1.5 0 0 1 21 9.18v8.32A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z"
            stroke={fg}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="8.5" width="17" height="11" rx="1.6" stroke={fg} strokeWidth="1.4" />
          <path d="M6 6h12M8 3.5h8" stroke={fg} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}
