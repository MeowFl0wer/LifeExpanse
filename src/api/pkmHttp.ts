import { request } from './http'
import { backlinksTo, outgoingLinks, unresolvedLinks } from '../lib/wikilink'
import type { ContentItem, ContentKind, Folder, Series, Tag, Visibility } from '../types'
import type { ListParams, PkmDraft, LibraryDraft, LinkGraph } from './pkm'

/**
 * Backend-backed implementation of the notes & articles data layer.
 *
 * `pkm.ts` picks between this and the in-memory store, so pages never learn
 * which one is active. The wire format is snake_case; the app is camelCase,
 * and the mapping lives here rather than leaking either way.
 */

interface WireContent {
  id: string
  slug: string
  type: ContentItem['type']
  content_kind: ContentKind | null
  thought_type: string | null
  title: string
  body: string
  summary: string
  visibility: Visibility
  author: string
  tags: string[]
  folder_ids: string[]
  series_ids: string[]
  category: string | null
  cover: string | null
  seo_title: string | null
  seo_description: string | null
  allow_comments: boolean
  favorite: boolean
  archived: boolean
  source_author: string | null
  source_title: string | null
  source_type: string | null
  source_url: string | null
  source_locator: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

interface WireFolder {
  id: string
  name: string
  description: string
  cover: string | null
  owner: string
  series_ids: string[]
  created_at: string
}

interface WireSeries {
  id: string
  name: string
  description: string
  cover: string | null
  owner: string
  created_at: string
}

function toTags(names: string[]): Tag[] {
  return names.map((name, i) => ({ id: `${name}-${i}`, name }))
}

export function fromWire(w: WireContent): ContentItem {
  return {
    id: w.id,
    slug: w.slug,
    type: w.type,
    contentKind: w.content_kind ?? undefined,
    thoughtType: (w.thought_type as ContentItem['thoughtType']) ?? undefined,
    title: w.title,
    body: w.body,
    summary: w.summary,
    visibility: w.visibility,
    tags: toTags(w.tags),
    folderIds: w.folder_ids,
    seriesIds: w.series_ids,
    category: w.category ?? undefined,
    cover: w.cover ?? undefined,
    seoTitle: w.seo_title ?? undefined,
    seoDescription: w.seo_description ?? undefined,
    allowComments: w.allow_comments,
    favorite: w.favorite,
    archived: w.archived,
    sourceAuthor: w.source_author ?? undefined,
    sourceTitle: w.source_title ?? undefined,
    sourceType: (w.source_type as ContentItem['sourceType']) ?? undefined,
    sourceUrl: w.source_url ?? undefined,
    sourceLocator: w.source_locator ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    publishedAt: w.published_at ?? '',
    author: w.author,
  }
}

function folderFromWire(w: WireFolder): Folder {
  return {
    id: w.id,
    owner: w.owner,
    name: w.name,
    description: w.description,
    cover: w.cover ?? undefined,
    seriesIds: w.series_ids,
    createdAt: w.created_at,
  }
}

function seriesFromWire(w: WireSeries): Series {
  return {
    id: w.id,
    owner: w.owner,
    name: w.name,
    description: w.description,
    cover: w.cover ?? undefined,
    createdAt: w.created_at,
  }
}

export async function listPkm(params: ListParams): Promise<ContentItem[]> {
  const rows = await request<WireContent[]>('/content', {
    query: {
      author: params.author,
      type: 'pkm',
      kind: params.kind,
      visibility: params.visibility,
      keyword: params.keyword,
      tag: params.tags,
      folder_id: params.folderId,
      series_id: params.seriesId,
      favourite_only: params.favouriteOnly,
      include_archived: params.includeArchived,
    },
  })
  return rows.map(fromWire)
}

export async function getPkmBySlug(p: {
  author: string
  slug: string
}): Promise<ContentItem> {
  return fromWire(await request<WireContent>(`/content/${p.author}/pkm/${p.slug}`))
}

/**
 * Wiki links, resolved against what the server says the viewer may read.
 *
 * The parsing stays in TypeScript instead of moving into the backend: one
 * Markdown link parser is easier to keep correct than two, and `lib/wikilink`
 * is already the tested one. Permissions are still the server's call — the
 * candidate list comes from `/content`, which filters for the viewer, so a
 * link to something the viewer cannot read shows up as unresolved rather than
 * as a title they were not meant to see.
 */
export async function getLinkGraph(item: ContentItem): Promise<LinkGraph> {
  const visible = await listPkm({ author: item.author, viewer: null })
  return {
    outgoing: outgoingLinks(item.body, visible).filter(i => i.id !== item.id),
    backlinks: backlinksTo(item, visible),
    unresolved: unresolvedLinks(item.body, visible),
  }
}

function draftToWire(draft: Partial<PkmDraft>) {
  return {
    ...(draft.title !== undefined ? { title: draft.title } : {}),
    ...(draft.body !== undefined ? { body: draft.body } : {}),
    ...(draft.summary !== undefined ? { summary: draft.summary } : {}),
    ...(draft.contentKind !== undefined ? { content_kind: draft.contentKind } : {}),
    ...(draft.visibility !== undefined ? { visibility: draft.visibility } : {}),
    ...(draft.tagNames !== undefined ? { tags: draft.tagNames } : {}),
    ...(draft.folderIds !== undefined ? { folder_ids: draft.folderIds } : {}),
    ...(draft.seriesIds !== undefined ? { series_ids: draft.seriesIds } : {}),
    ...(draft.cover !== undefined ? { cover: draft.cover } : {}),
    ...(draft.category !== undefined ? { category: draft.category } : {}),
    ...(draft.seoTitle !== undefined ? { seo_title: draft.seoTitle } : {}),
    ...(draft.seoDescription !== undefined ? { seo_description: draft.seoDescription } : {}),
    ...(draft.allowComments !== undefined ? { allow_comments: draft.allowComments } : {}),
    ...(draft.favorite !== undefined ? { favorite: draft.favorite } : {}),
    ...(draft.archived !== undefined ? { archived: draft.archived } : {}),
  }
}

export async function createPkm(draft: PkmDraft): Promise<ContentItem> {
  return fromWire(
    await request<WireContent>('/content', {
      method: 'POST',
      body: { type: 'pkm', ...draftToWire(draft) },
    })
  )
}

export async function updatePkm(id: string, patch: Partial<PkmDraft>): Promise<ContentItem> {
  return fromWire(
    await request<WireContent>(`/content/${id}`, { method: 'PATCH', body: draftToWire(patch) })
  )
}

export async function publishAsArticle(id: string): Promise<ContentItem> {
  return fromWire(await request<WireContent>(`/content/${id}/publish`, { method: 'POST' }))
}

export async function revertToNote(id: string): Promise<ContentItem> {
  return fromWire(await request<WireContent>(`/content/${id}/revert`, { method: 'POST' }))
}

export async function deletePkm(id: string): Promise<void> {
  await request<void>(`/content/${id}`, { method: 'DELETE' })
}

export async function listFolders(author: string): Promise<Folder[]> {
  const rows = await request<WireFolder[]>('/library/folders', { query: { author } })
  return rows.map(folderFromWire)
}

export async function listSeries(author: string): Promise<Series[]> {
  const rows = await request<WireSeries[]>('/library/series', { query: { author } })
  return rows.map(seriesFromWire)
}

function libraryToWire(draft: LibraryDraft) {
  return {
    name: draft.name,
    description: draft.description ?? '',
    cover: draft.cover ?? null,
    series_ids: draft.seriesIds ?? [],
  }
}

export async function createFolder(draft: LibraryDraft): Promise<Folder> {
  return folderFromWire(
    await request<WireFolder>('/library/folders', { method: 'POST', body: libraryToWire(draft) })
  )
}

export async function saveFolder(id: string, draft: LibraryDraft): Promise<Folder> {
  return folderFromWire(
    await request<WireFolder>(`/library/folders/${id}`, {
      method: 'PATCH',
      body: libraryToWire(draft),
    })
  )
}

export async function removeFolder(id: string): Promise<{ detached: number }> {
  return request(`/library/folders/${id}`, { method: 'DELETE' })
}

export async function createSeriesEntry(draft: LibraryDraft): Promise<Series> {
  return seriesFromWire(
    await request<WireSeries>('/library/series', { method: 'POST', body: libraryToWire(draft) })
  )
}

export async function saveSeries(id: string, draft: LibraryDraft): Promise<Series> {
  return seriesFromWire(
    await request<WireSeries>(`/library/series/${id}`, {
      method: 'PATCH',
      body: libraryToWire(draft),
    })
  )
}

export async function removeSeries(
  id: string
): Promise<{ detachedFolders: number; detachedItems: number }> {
  const res = await request<{ detached_folders: number; detached_items: number }>(
    `/library/series/${id}`,
    { method: 'DELETE' }
  )
  return { detachedFolders: res.detached_folders, detachedItems: res.detached_items }
}
