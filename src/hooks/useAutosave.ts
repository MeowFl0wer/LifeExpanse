import { useEffect, useRef, useState } from 'react'
import { saveDraft, clearDraft } from '../api/drafts'

export type AutosaveStatus = 'idle' | 'saving' | 'saved'

interface UseAutosaveOptions<T> {
  /** Draft key; pass null to disable (e.g. before the item has loaded). */
  key: string | null
  /** Current editor state. Saved when it changes and `dirty` is true. */
  value: T
  /** Only save once the user has actually changed something. */
  dirty: boolean
  /** `updatedAt` of the item when editing began, for conflict detection. */
  baseUpdatedAt?: string
  /** Quiet period after the last keystroke before writing. */
  delayMs?: number
}

interface UseAutosaveResult {
  status: AutosaveStatus
  savedAt: Date | null
  /** Drops the stored draft — call after a successful save or a discard. */
  discard: () => void
  /** Writes immediately, bypassing the debounce. */
  flush: () => void
}

/**
 * Debounced autosave for the editors.
 *
 * Writing on every keystroke would thrash storage, so a write happens once
 * typing pauses. The draft is also flushed when the tab is hidden or closed,
 * which is the case this feature exists for — a debounce alone would lose the
 * last few seconds of work.
 */
export function useAutosave<T>({
  key, value, dirty, baseUpdatedAt, delayMs = 800,
}: UseAutosaveOptions<T>): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Kept in refs so the unload handler always sees the latest values without
  // being re-registered on every keystroke.
  const latest = useRef({ key, value, dirty, baseUpdatedAt })
  latest.current = { key, value, dirty, baseUpdatedAt }

  const timer = useRef<number | null>(null)
  // A flush on pagehide can resolve after the component is gone; the write
  // itself must still happen, but the status update must not.
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function write() {
    const { key: k, value: v, dirty: d, baseUpdatedAt: base } = latest.current
    if (!k || !d) return
    void saveDraft(k, v, base).then(() => {
      if (!mounted.current) return
      setStatus('saved')
      setSavedAt(new Date())
    })
  }

  useEffect(() => {
    if (!key || !dirty) return

    setStatus('saving')
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      write()
    }, delayMs)

    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
    // `value` is compared by reference; callers pass a fresh object each render.
  }, [key, dirty, delayMs, JSON.stringify(value)])

  // Closing or hiding the tab must not lose the debounce window.
  useEffect(() => {
    function flushNow() {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      write()
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') flushNow()
    }

    window.addEventListener('pagehide', flushNow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flushNow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return {
    status,
    savedAt,
    discard: () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      if (latest.current.key) void clearDraft(latest.current.key)
      if (!mounted.current) return
      setStatus('idle')
      setSavedAt(null)
    },
    flush: () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      write()
    },
  }
}
