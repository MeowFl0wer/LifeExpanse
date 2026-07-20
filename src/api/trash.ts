import { ok, fail } from './client'
import { request, usingBackend } from './http'
import {
  trashedItems, restoreContentItem, purgeContentItem, emptyTrash, purgeExpiredTrash,
} from './store'
import type { ContentItem } from '../types'

/**
 * The recycle bin.
 *
 * Previously the page called the store directly, which meant two things: with
 * a backend configured nothing it did was persisted, and the "only your own
 * content" rule lived in the component rather than here. Both are the shape
 * this layer exists to prevent.
 */

export interface TrashEntry {
  item: ContentItem
  deletedAt: string
}

interface WireTrash {
  id: string
  slug: string
  type: ContentItem['type']
  content_kind: string | null
  title: string
  summary: string
  visibility: ContentItem['visibility']
  author: string
  deleted_at: string
  created_at: string
  updated_at: string
}

function fromWire(w: WireTrash): TrashEntry {
  return {
    item: {
      id: w.id,
      slug: w.slug,
      type: w.type,
      contentKind: (w.content_kind as ContentItem['contentKind']) ?? undefined,
      title: w.title,
      body: '',
      summary: w.summary,
      visibility: w.visibility,
      tags: [],
      author: w.author,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      publishedAt: '',
    },
    deletedAt: w.deleted_at,
  }
}

export async function listTrash(actor: string): Promise<TrashEntry[]> {
  if (usingBackend()) {
    const rows = await request<WireTrash[]>('/trash')
    return rows.map(fromWire)
  }
  // Owner-scoped here rather than in the page, so no caller can forget.
  return ok(trashedItems.filter(entry => entry.item.author === actor))
}

export async function restoreFromTrash(id: string, actor: string): Promise<void> {
  if (usingBackend()) {
    await request<void>(`/trash/${id}/restore`, { method: 'POST' })
    return
  }
  const entry = trashedItems.find(e => e.item.id === id)
  // Same 404 whether it is missing or someone else's.
  if (!entry || entry.item.author !== actor) return fail('内容不存在', 404)
  restoreContentItem(id)
  return ok(undefined)
}

export async function purgeFromTrash(id: string, actor: string): Promise<void> {
  if (usingBackend()) {
    await request<void>(`/trash/${id}`, { method: 'DELETE' })
    return
  }
  const entry = trashedItems.find(e => e.item.id === id)
  if (!entry || entry.item.author !== actor) return fail('内容不存在', 404)
  purgeContentItem(id)
  return ok(undefined)
}

export async function emptyTrashFor(actor: string): Promise<void> {
  if (usingBackend()) {
    await request<void>('/trash', { method: 'DELETE' })
    return
  }
  emptyTrash(actor)
  return ok(undefined)
}

/**
 * Drops entries past the retention window.
 *
 * Only meaningful for the in-memory store: with a backend, expiry is the
 * server's job and happens whether or not anyone opens this page.
 */
export async function sweepExpiredTrash(): Promise<number> {
  if (usingBackend()) return 0
  return ok(purgeExpiredTrash())
}
