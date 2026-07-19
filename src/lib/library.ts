import type { ContentItem, Folder, Series } from '../types'

/**
 * Library hierarchy: Series > Folder > Note.
 *
 * Membership is many-to-many — a note may sit in several folders and several
 * series, and a folder may belong to several series. One rule constrains it:
 * a note filed in a folder travels with that folder, so within a series it
 * appears under the folder rather than loose beside it.
 */

type Membership = Pick<ContentItem, 'folderIds' | 'seriesIds'>

function ids(value: string[] | undefined): string[] {
  return value ?? []
}

/** Folders a note is filed in. */
export function foldersOf(item: Membership, folders: readonly Folder[]): Folder[] {
  return folders.filter(f => ids(item.folderIds).includes(f.id))
}

/**
 * Every series a note belongs to: those it was filed into directly, plus those
 * inherited from the folders it sits in.
 */
export function effectiveSeriesIds(item: Membership, folders: readonly Folder[]): string[] {
  const inherited = foldersOf(item, folders).flatMap(f => ids(f.seriesIds))
  return Array.from(new Set([...ids(item.seriesIds), ...inherited]))
}

/** Notes filed in a folder. */
export function itemsInFolder(items: readonly ContentItem[], folderId: string): ContentItem[] {
  return items.filter(item => ids(item.folderIds).includes(folderId))
}

/** Folders belonging to a series. */
export function foldersInSeries(folders: readonly Folder[], seriesId: string): Folder[] {
  return folders.filter(folder => ids(folder.seriesIds).includes(seriesId))
}

/**
 * Notes shown directly under a series — those filed into it that are not
 * already reachable through one of that series' folders.
 */
export function looseItemsInSeries(
  items: readonly ContentItem[],
  folders: readonly Folder[],
  seriesId: string
): ContentItem[] {
  const folderIdsInSeries = foldersInSeries(folders, seriesId).map(f => f.id)
  return items.filter(item => {
    if (!ids(item.seriesIds).includes(seriesId)) return false
    return !ids(item.folderIds).some(fid => folderIdsInSeries.includes(fid))
  })
}

/** Every note in a series, whether loose or inside one of its folders. */
export function allItemsInSeries(
  items: readonly ContentItem[],
  folders: readonly Folder[],
  seriesId: string
): ContentItem[] {
  return items.filter(item => effectiveSeriesIds(item, folders).includes(seriesId))
}

/** Notes not filed anywhere. */
export function unfiledItems(items: readonly ContentItem[]): ContentItem[] {
  return items.filter(item => ids(item.folderIds).length === 0 && ids(item.seriesIds).length === 0)
}

/**
 * Normalises membership before saving.
 *
 * Drops any direct series link already covered by one of the item's folders,
 * so a note cannot be both inside a folder in series S and loose in S. Also
 * de-duplicates and removes blanks.
 */
export function normaliseMembership(
  input: { folderIds?: string[]; seriesIds?: string[] },
  folders: readonly Folder[]
): { folderIds: string[]; seriesIds: string[] } {
  const folderIds = Array.from(new Set(ids(input.folderIds).filter(Boolean)))
  const inherited = new Set(
    folders.filter(f => folderIds.includes(f.id)).flatMap(f => ids(f.seriesIds))
  )
  const seriesIds = Array.from(
    new Set(ids(input.seriesIds).filter(Boolean).filter(id => !inherited.has(id)))
  )
  return { folderIds, seriesIds }
}

/** Folders and series a note belongs to, for display on the detail page. */
export function locationTrail(
  item: Membership,
  folders: readonly Folder[],
  series: readonly Series[]
): { folders: Folder[]; series: Series[] } {
  const seriesIds = effectiveSeriesIds(item, folders)
  return {
    folders: foldersOf(item, folders),
    series: series.filter(s => seriesIds.includes(s.id)),
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
