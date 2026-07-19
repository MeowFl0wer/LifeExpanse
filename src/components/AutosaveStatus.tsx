import type { AutosaveStatus } from '../hooks/useAutosave'

interface AutosaveIndicatorProps {
  status: AutosaveStatus
  savedAt: Date | null
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function AutosaveIndicator({ status, savedAt }: AutosaveIndicatorProps) {
  if (status === 'idle' && !savedAt) return null

  return (
    <span className="text-xs text-[color:var(--muted-foreground)]" aria-live="polite">
      {status === 'saving'
        ? '正在保存草稿…'
        : savedAt
          ? `草稿已保存 ${timeLabel(savedAt)}`
          : ''}
    </span>
  )
}
