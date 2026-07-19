/** PRD 25.2: deleted content is recoverable for a limited window. */
export const TRASH_RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whole days left before an item is purged, counted from when it was deleted.
 * Returns 0 once the window has closed — never a negative number, so callers
 * can render it directly.
 */
export function daysRemaining(
  deletedAt: string,
  now: number = Date.now(),
  retentionDays: number = TRASH_RETENTION_DAYS
): number {
  const deleted = new Date(deletedAt).getTime()
  if (Number.isNaN(deleted)) return 0
  const expiresAt = deleted + retentionDays * DAY_MS
  return Math.max(0, Math.ceil((expiresAt - now) / DAY_MS))
}

/** True once the retention window has passed and the item may be purged. */
export function isExpired(
  deletedAt: string,
  now: number = Date.now(),
  retentionDays: number = TRASH_RETENTION_DAYS
): boolean {
  const deleted = new Date(deletedAt).getTime()
  // An unparseable timestamp is treated as expired rather than kept forever.
  if (Number.isNaN(deleted)) return true
  return now >= deleted + retentionDays * DAY_MS
}

/** Short human label for how long an item has left. */
export function retentionLabel(
  deletedAt: string,
  now: number = Date.now(),
  retentionDays: number = TRASH_RETENTION_DAYS
): string {
  if (isExpired(deletedAt, now, retentionDays)) return '即将被清理'
  const days = daysRemaining(deletedAt, now, retentionDays)
  return days <= 1 ? '今天到期' : `${days} 天后清理`
}
