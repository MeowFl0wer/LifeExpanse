import { ok, fail } from './client'
import { usingBackend } from './http'
import * as remote from './pkmHttp'
import {
  allContent, folders as folderStore, series as seriesStore,
  addContentItem, updateContentItem, deleteContentItem, makeUniqueSlug, nextId,
  addFolder, updateFolder, deleteFolder,
  addSeries, updateSeries, deleteSeries,
} from './store'
import { normaliseMembership } from '../lib/library'
import { backlinksTo, outgoingLinks, unresolvedLinks } from '../lib/wikilink'
import { slugify } from '../lib/slug'
import type { ContentItem, ContentKind, Folder, Series, Visibility } from '../types'

/**
 * Notes & articles data access.
 *
 * Each function checks `usingBackend()` first: with `VITE_API_BASE` set the
 * call goes to the server, otherwise it runs against the in-memory store.
 * Pages call the same names either way, so switching does not touch them.
 *
 * Permission filtering happens here rather than in components so a page cannot
 * forget it. When this moves behind a real API the same rules must also be
 * enforced server side — a client-side check alone is not security.
 */

export interface ListParams {
  author: string
  /** Defaults to 'pkm'. */
  type?: ContentItem['type']
  /** The signed-in user, or null for a guest. */
  viewer: string | null
  kind?: ContentKind
  draftsOnly?: boolean
  folderId?: string
  seriesId?: string
  tags?: string[]
  keyword?: string
  visibility?: Visibility
  favouriteOnly?: boolean
  includeArchived?: boolean
}

function visibleTo(item: ContentItem, viewer: string | null): boolean {
  return item.visibility === 'public' || item.author === viewer
}

export async function listPkm(params: ListParams): Promise<ContentItem[]> {
  if (usingBackend()) return remote.listPkm(params)

  const { author, viewer } = params
  const type = params.type ?? 'pkm'
  let items = allContent.filter(c => c.type === type && c.author === author && visibleTo(c, viewer))

  if (!params.includeArchived) items = items.filter(c => !c.archived)
  if (params.kind) items = items.filter(c => c.contentKind === params.kind)
  if (params.draftsOnly) items = items.filter(c => c.visibility === 'draft')
  if (params.visibility) items = items.filter(c => c.visibility === params.visibility)
  if (params.favouriteOnly) items = items.filter(c => c.favorite)
  if (params.folderId) items = items.filter(c => (c.folderIds ?? []).includes(params.folderId!))
  if (params.seriesId) items = items.filter(c => (c.seriesIds ?? []).includes(params.seriesId!))
  if (params.tags?.length) {
    items = items.filter(c => c.tags.some(t => params.tags!.includes(t.name)))
  }
  if (params.keyword) {
    const kw = params.keyword.toLowerCase()
    items = items.filter(
      c => c.title.toLowerCase().includes(kw) || c.summary.toLowerCase().includes(kw)
    )
  }

  return ok(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
}

/**
 * Looks up one note or article.
 *
 * Scoped to the author in the URL and to PKM content: a slug belonging to
 * someone else, or to a diary entry, must not surface under
 * /{author}/pkm/{slug}.
 */
export async function getPkmBySlug(params: {
  author: string
  slug: string
  viewer: string | null
  /** Defaults to 'pkm'. */
  type?: ContentItem['type']
}): Promise<ContentItem> {
  if (usingBackend()) return remote.getPkmBySlug(params)
  const type = params.type ?? 'pkm'
  const item = allContent.find(
    c => c.slug === params.slug && c.type === type && c.author === params.author
  )
  // Same response whether it is missing, of the wrong type, owned by someone
  // else, or hidden — so the reply cannot be used to probe for private content.
  if (!item || !visibleTo(item, params.viewer)) return fail('内容不存在', 404)
  return ok(item)
}

export interface PkmDraft {
  /** Defaults to 'pkm'. Thoughts and diary entries pass their own. */
  type?: ContentItem['type']
  title: string
  body: string
  summary?: string
  /** Only meaningful for `pkm`. */
  contentKind?: ContentKind
  visibility: Visibility
  tagNames: string[]
  folderIds: string[]
  seriesIds: string[]
  cover?: string
  category?: string
  seoTitle?: string
  seoDescription?: string
  allowComments?: boolean
  favorite?: boolean
  archived?: boolean
  /** Thought-specific: original writing or a quotation. */
  thoughtType?: ContentItem['thoughtType']
  /** Provenance for an excerpt. */
  sourceAuthor?: string
  sourceTitle?: string
  sourceType?: ContentItem['sourceType']
  sourceUrl?: string
  sourceLocator?: string
}

/**
 * Creates content of any type.
 *
 * Thoughts and diary entries go through here too. They used to write to the
 * store directly, which meant that with a backend configured they simply were
 * not saved — and that the ownership rule enforced here did not apply to them.
 */
export async function createPkm(author: string, draft: PkmDraft): Promise<ContentItem> {
  if (usingBackend()) return remote.createPkm(draft)

  if (!draft.title.trim()) return fail('标题不能为空')
  if (!draft.body.trim()) return fail('正文不能为空')

  const type = draft.type ?? 'pkm'
  const now = new Date().toISOString()
  const item: ContentItem = {
    id: nextId('c'),
    slug: makeUniqueSlug(slugify(draft.title, `entry-${Date.now()}`)),
    type,
    contentKind: type === 'pkm' ? draft.contentKind : undefined,
    title: draft.title.trim(),
    body: draft.body,
    summary: draft.summary?.trim() || draft.body.trim().slice(0, 80),
    visibility: draft.visibility,
    tags: draft.tagNames.map(name => ({ id: nextId('tag'), name })),
    createdAt: now,
    updatedAt: now,
    publishedAt: draft.visibility === 'draft' ? '' : now,
    author,
    cover: draft.cover,
    category: draft.category,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    allowComments: type === 'pkm' && (draft.allowComments ?? draft.contentKind === 'article'),
    favorite: draft.favorite ?? false,
    archived: draft.archived ?? false,
    thoughtType: draft.thoughtType,
    sourceAuthor: draft.sourceAuthor,
    sourceTitle: draft.sourceTitle,
    sourceType: draft.sourceType,
    sourceUrl: draft.sourceUrl,
    sourceLocator: draft.sourceLocator,
    ...normaliseMembership({ folderIds: draft.folderIds, seriesIds: draft.seriesIds }, folderStore),
  }

  addContentItem(item)
  return ok(item)
}

/**
 * Loads an item the actor is allowed to modify.
 *
 * Mutations take an `actor` so the rule lives here rather than in each caller:
 * a page that forgets to check ownership still cannot write to someone else's
 * content. Not-found and not-yours are the same 404, so the error does not
 * reveal that the id exists.
 */
function ownedByActor(id: string, actor: string): ContentItem | null {
  const item = allContent.find(c => c.id === id)
  // Type is not part of ownership: a diary entry belongs to its author exactly
  // as a note does. Restricting this to `pkm` was what forced other types onto
  // a separate, unchecked write path.
  if (!item || item.author !== actor) return null
  return item
}

export async function updatePkm(
  id: string,
  actor: string,
  patch: Partial<PkmDraft>
): Promise<ContentItem> {
  if (usingBackend()) return remote.updatePkm(id, patch)
  const existing = ownedByActor(id, actor)
  if (!existing) return fail('内容不存在', 404)
  if (patch.title !== undefined && !patch.title.trim()) return fail('标题不能为空')

  const membership =
    patch.folderIds !== undefined || patch.seriesIds !== undefined
      ? normaliseMembership(
          {
            folderIds: patch.folderIds ?? existing.folderIds,
            seriesIds: patch.seriesIds ?? existing.seriesIds,
          },
          folderStore
        )
      : {}

  updateContentItem(id, {
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.body !== undefined ? { body: patch.body } : {}),
    ...(patch.summary !== undefined ? { summary: patch.summary.trim() } : {}),
    ...(patch.contentKind !== undefined ? { contentKind: patch.contentKind } : {}),
    ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
    ...(patch.tagNames !== undefined
      ? { tags: patch.tagNames.map(name => ({ id: nextId('tag') , name })) }
      : {}),
    ...(patch.cover !== undefined ? { cover: patch.cover } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.seoTitle !== undefined ? { seoTitle: patch.seoTitle } : {}),
    ...(patch.seoDescription !== undefined ? { seoDescription: patch.seoDescription } : {}),
    ...(patch.allowComments !== undefined ? { allowComments: patch.allowComments } : {}),
    ...(patch.favorite !== undefined ? { favorite: patch.favorite } : {}),
    ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
    ...(patch.thoughtType !== undefined ? { thoughtType: patch.thoughtType } : {}),
    // Excerpt provenance: without these an excerpt saved with the wrong source
    // could never be corrected.
    ...(patch.sourceAuthor !== undefined ? { sourceAuthor: patch.sourceAuthor } : {}),
    ...(patch.sourceTitle !== undefined ? { sourceTitle: patch.sourceTitle } : {}),
    ...(patch.sourceType !== undefined ? { sourceType: patch.sourceType } : {}),
    ...(patch.sourceUrl !== undefined ? { sourceUrl: patch.sourceUrl } : {}),
    ...(patch.sourceLocator !== undefined ? { sourceLocator: patch.sourceLocator } : {}),
    ...membership,
    updatedAt: new Date().toISOString(),
  })

  return ok(allContent.find(c => c.id === id)!)
}

/**
 * Switches a note to article form, keeping the same id, body and history.
 * Article-only fields are supplied here rather than being invented.
 */
export async function publishAsArticle(
  id: string,
  actor: string,
  extra: { summary?: string; category?: string; allowComments?: boolean } = {}
): Promise<ContentItem> {
  if (usingBackend()) return remote.publishAsArticle(id)
  const item = ownedByActor(id, actor)
  if (!item) return fail('内容不存在', 404)
  return updatePkm(id, actor, {
    contentKind: 'article',
    summary: extra.summary ?? item.summary,
    category: extra.category ?? item.category,
    allowComments: extra.allowComments ?? true,
  })
}

/** Returns an article to note form. Comments are switched off on the way back. */
export async function revertToNote(id: string, actor: string): Promise<ContentItem> {
  if (usingBackend()) return remote.revertToNote(id)
  return updatePkm(id, actor, { contentKind: 'note', allowComments: false })
}

export async function deletePkm(id: string, actor: string): Promise<void> {
  if (usingBackend()) return remote.deletePkm(id)
  if (!ownedByActor(id, actor)) return fail('内容不存在', 404)
  deleteContentItem(id)
  return ok(undefined)
}

export async function toggleFavourite(id: string, actor: string, value: boolean): Promise<ContentItem> {
  return updatePkm(id, actor, { favorite: value })
}

export async function toggleArchived(id: string, actor: string, value: boolean): Promise<ContentItem> {
  return updatePkm(id, actor, { archived: value })
}

/* ---- Links between notes ---- */

export interface LinkGraph {
  outgoing: ContentItem[]
  backlinks: ContentItem[]
  unresolved: string[]
}

export async function getLinkGraph(item: ContentItem, viewer: string | null): Promise<LinkGraph> {
  if (usingBackend()) return remote.getLinkGraph(item)
  const visible = allContent.filter(c => c.author === item.author && visibleTo(c, viewer))
  return ok({
    outgoing: outgoingLinks(item.body, visible).filter(i => i.id !== item.id),
    backlinks: backlinksTo(item, visible),
    unresolved: unresolvedLinks(item.body, visible),
  })
}

/* ---- Library ---- */

export async function listFolders(author: string, viewer: string | null): Promise<Folder[]> {
  if (usingBackend()) return remote.listFolders(author)
  const owned = folderStore.filter(f => f.owner === author)
  if (viewer === author) return ok(owned)
  // A folder holding nothing public would leak its name and description.
  const visible = allContent.filter(c => c.author === author && c.visibility === 'public')
  return ok(owned.filter(f => visible.some(c => (c.folderIds ?? []).includes(f.id))))
}

export async function listSeries(author: string, viewer: string | null): Promise<Series[]> {
  if (usingBackend()) return remote.listSeries(author)
  const owned = seriesStore.filter(s => s.owner === author)
  if (viewer === author) return ok(owned)
  const visible = allContent.filter(c => c.author === author && c.visibility === 'public')
  const folderIds = new Set(folderStore.filter(f => f.owner === author).map(f => f.id))
  return ok(
    owned.filter(s =>
      visible.some(c => {
        if ((c.seriesIds ?? []).includes(s.id)) return true
        return (c.folderIds ?? []).some(
          fid => folderIds.has(fid) && (folderStore.find(f => f.id === fid)?.seriesIds ?? []).includes(s.id)
        )
      })
    )
  )
}

export interface LibraryDraft {
  name: string
  description?: string
  cover?: string
  seriesIds?: string[]
}

export async function createFolder(owner: string, draft: LibraryDraft): Promise<Folder> {
  if (usingBackend()) return remote.createFolder(draft)
  if (!draft.name.trim()) return fail('文件夹名称不能为空')
  const folder: Folder = {
    id: nextId('fd'),
    owner,
    name: draft.name.trim(),
    description: draft.description?.trim(),
    cover: draft.cover,
    seriesIds: draft.seriesIds ?? [],
    createdAt: new Date().toISOString(),
  }
  addFolder(folder)
  return ok(folder)
}

export async function saveFolder(id: string, actor: string, draft: LibraryDraft): Promise<Folder> {
  if (usingBackend()) return remote.saveFolder(id, draft)
  const owned = folderStore.find(f => f.id === id && f.owner === actor)
  if (!owned) return fail('文件夹不存在', 404)
  if (!draft.name.trim()) return fail('文件夹名称不能为空')
  updateFolder(id, {
    name: draft.name.trim(),
    description: draft.description?.trim(),
    cover: draft.cover,
    seriesIds: draft.seriesIds ?? [],
  })
  const folder = folderStore.find(f => f.id === id)
  if (!folder) return fail('文件夹不存在', 404)
  return ok(folder)
}

/**
 * Removes a folder. Content is never deleted with it — items are detached and
 * become unfiled, so deleting a container can never destroy what it held.
 */
export async function removeFolder(id: string, actor: string): Promise<{ detached: number }> {
  if (usingBackend()) return remote.removeFolder(id)
  if (!folderStore.some(f => f.id === id && f.owner === actor)) return fail('文件夹不存在', 404)
  const affected = allContent.filter(c => (c.folderIds ?? []).includes(id))
  for (const item of affected) {
    updateContentItem(item.id, { folderIds: (item.folderIds ?? []).filter(f => f !== id) })
  }
  deleteFolder(id)
  return ok({ detached: affected.length })
}

export async function createSeriesEntry(owner: string, draft: LibraryDraft): Promise<Series> {
  if (usingBackend()) return remote.createSeriesEntry(draft)
  if (!draft.name.trim()) return fail('系列名称不能为空')
  const entry: Series = {
    id: nextId('sr'),
    owner,
    name: draft.name.trim(),
    description: draft.description?.trim(),
    cover: draft.cover,
    createdAt: new Date().toISOString(),
  }
  addSeries(entry)
  return ok(entry)
}

export async function saveSeries(id: string, actor: string, draft: LibraryDraft): Promise<Series> {
  if (usingBackend()) return remote.saveSeries(id, draft)
  const owned = seriesStore.find(s => s.id === id && s.owner === actor)
  if (!owned) return fail('系列不存在', 404)
  if (!draft.name.trim()) return fail('系列名称不能为空')
  updateSeries(id, {
    name: draft.name.trim(),
    description: draft.description?.trim(),
    cover: draft.cover,
  })
  const entry = seriesStore.find(s => s.id === id)
  if (!entry) return fail('系列不存在', 404)
  return ok(entry)
}

/** Removes a series, detaching its folders and any directly filed content. */
export async function removeSeries(id: string, actor: string): Promise<{ detachedFolders: number; detachedItems: number }> {
  if (usingBackend()) return remote.removeSeries(id)
  if (!seriesStore.some(s => s.id === id && s.owner === actor)) return fail('系列不存在', 404)
  const childFolders = folderStore.filter(f => (f.seriesIds ?? []).includes(id))
  for (const folder of childFolders) {
    updateFolder(folder.id, { seriesIds: (folder.seriesIds ?? []).filter(s => s !== id) })
  }
  const affected = allContent.filter(c => (c.seriesIds ?? []).includes(id))
  for (const item of affected) {
    updateContentItem(item.id, { seriesIds: (item.seriesIds ?? []).filter(s => s !== id) })
  }
  deleteSeries(id)
  return ok({ detachedFolders: childFolders.length, detachedItems: affected.length })
}

/* ---- Cross-type reads ---- */

/**
 * Every piece of content the viewer may see, across all types.
 *
 * Search and the dashboard need this. Doing it here rather than filtering
 * `allContent` in a component is the whole point of the layer: the permission
 * rule is applied once, and a page cannot forget it.
 */
export async function listAllVisible(
  author: string,
  viewer: string | null
): Promise<ContentItem[]> {
  if (usingBackend()) {
    // `author` is required by the server and is not the viewer: passing the
    // viewer meant a guest sent an empty author (404, so search came back
    // empty) and a signed-in user only ever searched their own content.
    const perType = await Promise.all(
      (['thought', 'diary', 'pkm'] as const).map(type =>
        // Visibility is applied server side from the session cookie.
        remote.listPkm({ author, viewer, type, includeArchived: false })
      )
    )
    return perType.flat()
  }
  return ok(allContent.filter(c => c.author === author && visibleTo(c, viewer)))
}

/** How many items of a type an author has that the viewer may see. */
export async function countByType(
  type: ContentItem['type'],
  author: string,
  viewer: string | null
): Promise<number> {
  const items = await listPkm({ author, viewer, type })
  return items.length
}

/** The viewer's most recently created content across types, newest first. */
export async function recentVisible(
  limit: number,
  author: string,
  viewer: string | null
): Promise<ContentItem[]> {
  const all = await listAllVisible(author, viewer)
  return all
    .filter(c => c.author === author && c.visibility !== 'draft')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit)
}

/** Count of an author's public content. Used by the About and 我的 pages. */
export async function countPublic(author: string): Promise<number> {
  // `viewer: null` so this is what a visitor would actually see.
  const all = await listAllVisible(author, null)
  return all.filter(c => c.visibility === 'public').length
}
