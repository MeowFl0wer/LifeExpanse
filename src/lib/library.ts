import type { ContentItem, Folder, Series } from '../types'

/**
 * Library hierarchy: Series > Folder > Note.
 *
 * A note may live directly in a series, or in a folder. When it lives in a
 * folder, the folder decides the series — the note travels with its folder and
 * can never surface in a series outside it. These helpers are the single place
 * that rule is expressed.
 */

/**
 * The series a note actually belongs to. A folder's series always wins, so a
 * stale direct seriesId on a foldered note cannot pull it out of its folder.
 */
export function effectiveSeriesId(
  item: Pick<ContentItem, 'folderId' | 'seriesId'>,
  folders: readonly Folder[]
): string | undefined {
  if (item.folderId) {
    return folders.find(f => f.id === item.folderId)?.seriesId
  }
  return item.seriesId
}

/** Notes sitting directly in a folder. */
export function itemsInFolder(items: readonly ContentItem[], folderId: string): ContentItem[] {
  return items.filter(item => item.folderId === folderId)
}

/** Folders that belong to a series. */
export function foldersInSeries(folders: readonly Folder[], seriesId: string): Folder[] {
  return folders.filter(folder => folder.seriesId === seriesId)
}

/**
 * Notes that sit directly in a series — i.e. not inside any of its folders.
 * Foldered notes are reached through their folder instead.
 */
export function looseItemsInSeries(items: readonly ContentItem[], seriesId: string): ContentItem[] {
  return items.filter(item => !item.folderId && item.seriesId === seriesId)
}

/** Every note in a series, whether loose or inside one of its folders. */
export function allItemsInSeries(
  items: readonly ContentItem[],
  folders: readonly Folder[],
  seriesId: string
): ContentItem[] {
  return items.filter(item => effectiveSeriesId(item, folders) === seriesId)
}

/** Notes not filed under any folder or series. */
export function unfiledItems(items: readonly ContentItem[]): ContentItem[] {
  return items.filter(item => !item.folderId && !item.seriesId)
}

/**
 * Normalises membership before saving. Setting a folder clears any direct
 * series link, because the folder now determines the series (rule 2.8).
 */
export function normaliseMembership(input: {
  folderId?: string
  seriesId?: string
}): { folderId?: string; seriesId?: string } {
  if (input.folderId) {
    return { folderId: input.folderId, seriesId: undefined }
  }
  return { folderId: undefined, seriesId: input.seriesId || undefined }
}

/** Breadcrumb trail for a note: its series (if any), then its folder (if any). */
export function locationTrail(
  item: Pick<ContentItem, 'folderId' | 'seriesId'>,
  folders: readonly Folder[],
  series: readonly Series[]
): { series?: Series; folder?: Folder } {
  const folder = item.folderId ? folders.find(f => f.id === item.folderId) : undefined
  const seriesId = effectiveSeriesId(item, folders)
  return {
    folder,
    series: seriesId ? series.find(s => s.id === seriesId) : undefined,
  }
}

/**
 * Parses inline #tags out of body text so they can be captured while writing.
 * Returns the tag names without the leading #, de-duplicated, order preserved.
 */
export function extractHashTags(text: string): string[] {
  const found = text.match(/#([^\s#，,。.!?？！；;：:()（）[\]【】"'`]+)/g) ?? []
  const names = found.map(raw => raw.slice(1)).filter(Boolean)
  return Array.from(new Set(names))
}
