import { ok } from './client'
import { request, usingBackend } from './http'

/**
 * In-progress edits, kept so closing the tab mid-sentence does not lose work.
 *
 * These live in localStorage rather than the in-memory store: the store resets
 * on reload, which is exactly the case this feature exists to survive. 需求
 * 25.2 also asks that a draft outlive a dropped connection, so a local copy is
 * the right primitive even once a backend exists — at that point this module
 * additionally pushes to the server and reconciles on load.
 */

const PREFIX = 'life_draft:'
/** Drafts older than this are dropped, so abandoned edits do not accumulate. */
const MAX_AGE_DAYS = 14

export interface Draft<T> {
  key: string
  savedAt: string
  /**
   * `updatedAt` of the item when editing began. Lets the editor notice the
   * content changed elsewhere while a draft was sitting unsaved.
   */
  baseUpdatedAt?: string
  data: T
}

/*
 * Keys are scoped to the signed-in user. Without that, two people sharing a
 * browser would inherit each other's unsaved drafts — euan writes half a note,
 * logs out, and alice sees it on her create page.
 */

/** Key for editing an existing item. */
export function editKey(owner: string, contentId: string): string {
  return `${owner}:edit:${contentId}`
}

/** Key for a new item that has not been saved yet. */
export function createKey(owner: string, type: string): string {
  return `${owner}:new:${type}`
}

/** Removes every draft belonging to a user — used on logout. */
export async function clearDraftsFor(owner: string): Promise<number> {
  const store = storage()
  if (!store) return ok(0)
  const doomed: string[] = []
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i)
    if (k?.startsWith(`${PREFIX}${owner}:`)) doomed.push(k)
  }
  for (const k of doomed) store.removeItem(k)
  return ok(doomed.length)
}

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isFresh(savedAt: string, now: number): boolean {
  const t = new Date(savedAt).getTime()
  if (Number.isNaN(t)) return false
  return now - t < MAX_AGE_DAYS * 24 * 60 * 60 * 1000
}

export async function saveDraft<T>(
  key: string,
  data: T,
  baseUpdatedAt?: string
): Promise<Draft<T>> {
  const draft: Draft<T> = { key, savedAt: new Date().toISOString(), baseUpdatedAt, data }

  // Always keep the local copy: it is what survives a dropped connection
  // (需求 25.2) and what makes the next page load instant.
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(draft))
  } catch {
    // Quota or private mode — autosave degrades rather than throwing mid-typing.
  }

  if (usingBackend()) {
    try {
      await request(`/drafts/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: { payload: data, base_updated_at: baseUpdatedAt ?? null },
      })
    } catch {
      // Offline: the local copy stands in until the next successful save.
    }
  }

  return ok(draft)
}

export async function loadDraft<T>(key: string): Promise<Draft<T> | null> {
  // Prefer the server copy so a draft written on another device wins.
  if (usingBackend()) {
    try {
      const remote = await request<{
        key: string
        payload: T
        base_updated_at: string | null
        saved_at: string
      } | null>(`/drafts/${encodeURIComponent(key)}`)
      if (remote) {
        return ok({
          key: remote.key,
          savedAt: remote.saved_at,
          baseUpdatedAt: remote.base_updated_at ?? undefined,
          data: remote.payload,
        })
      }
      return ok(null)
    } catch {
      // Fall through to the local copy when the server is unreachable.
    }
  }

  const raw = storage()?.getItem(PREFIX + key)
  if (!raw) return ok(null)
  try {
    const parsed = JSON.parse(raw) as Draft<T>
    if (!parsed?.savedAt || !isFresh(parsed.savedAt, Date.now())) {
      storage()?.removeItem(PREFIX + key)
      return ok(null)
    }
    return ok(parsed)
  } catch {
    storage()?.removeItem(PREFIX + key)
    return ok(null)
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    storage()?.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
  if (usingBackend()) {
    try {
      await request(`/drafts/${encodeURIComponent(key)}`, { method: 'DELETE' })
    } catch {
      // The local copy is gone either way; the server entry expires on its own.
    }
  }
  return ok(undefined)
}

/** Every stored draft, newest first. Used by the workspace to surface them. */
export async function listDrafts(): Promise<Draft<unknown>[]> {
  const store = storage()
  if (!store) return ok([])

  const drafts: Draft<unknown>[] = []
  const stale: string[] = []
  const now = Date.now()

  for (let i = 0; i < store.length; i++) {
    const storageKey = store.key(i)
    if (!storageKey?.startsWith(PREFIX)) continue
    try {
      const parsed = JSON.parse(store.getItem(storageKey) ?? '') as Draft<unknown>
      if (!parsed?.savedAt || !isFresh(parsed.savedAt, now)) {
        stale.push(storageKey)
        continue
      }
      drafts.push(parsed)
    } catch {
      stale.push(storageKey)
    }
  }

  for (const key of stale) store.removeItem(key)

  return ok(drafts.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()))
}
