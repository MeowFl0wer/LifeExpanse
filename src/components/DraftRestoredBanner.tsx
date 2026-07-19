interface DraftRestoredBannerProps {
  savedAt: string
  /** True when the underlying content changed after this draft was written. */
  stale?: boolean
  onDiscard: () => void
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Shown when an unsaved draft was restored, so the editor never silently
 * replaces what the user expected to see.
 */
export default function DraftRestoredBanner({ savedAt, stale, onDiscard }: DraftRestoredBannerProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border px-4 py-3 ${
        stale
          ? 'border-[#F3E5BD] bg-[#FFF8E9]'
          : 'border-[#D5EBD9] bg-[#EEF8F0]'
      }`}
    >
      <div>
        <p className={`text-sm font-medium ${stale ? 'text-[#8A6428]' : 'text-[#3F744D]'}`}>
          已恢复未保存的草稿
        </p>
        <p className="mt-0.5 text-xs leading-6 text-[color:var(--muted-foreground)]">
          上次编辑于 {formatWhen(savedAt)}。
          {stale && ' 这条内容在此期间被改动过，保存会覆盖那次改动。'}
        </p>
      </div>
      <button type="button" onClick={onDiscard} className="life-button shrink-0 text-xs">
        放弃草稿
      </button>
    </div>
  )
}
