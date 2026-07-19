import { describe, it, expect } from 'vitest'
import {
  effectiveSeriesId, itemsInFolder, foldersInSeries, looseItemsInSeries,
  allItemsInSeries, unfiledItems, normaliseMembership, extractHashTags,
} from './library'
import type { ContentItem, Folder } from '../types'

const folders = [
  { id: 'f1', owner: 'euan', name: '前端', seriesId: 's1', createdAt: '' },
  { id: 'f2', owner: 'euan', name: '系统', createdAt: '' },
] as Folder[]

function item(partial: Partial<ContentItem>): ContentItem {
  return {
    id: 'x', slug: 'x', type: 'pkm', title: 't', body: '', summary: '',
    visibility: 'public', tags: [], createdAt: '', updatedAt: '', publishedAt: '',
    author: 'euan', ...partial,
  }
}

describe('effectiveSeriesId', () => {
  it('takes the series from the folder when the note is filed', () => {
    expect(effectiveSeriesId({ folderId: 'f1' }, folders)).toBe('s1')
  })

  it('uses the direct series when the note has no folder', () => {
    expect(effectiveSeriesId({ seriesId: 's2' }, folders)).toBe('s2')
  })

  // Rule 2.8: a foldered note travels with its folder, never independently.
  it('lets the folder override a stale direct series', () => {
    expect(effectiveSeriesId({ folderId: 'f1', seriesId: 's9' }, folders)).toBe('s1')
  })

  it('is undefined when the folder is in no series', () => {
    expect(effectiveSeriesId({ folderId: 'f2', seriesId: 's9' }, folders)).toBeUndefined()
  })

  it('is undefined when unfiled', () => {
    expect(effectiveSeriesId({}, folders)).toBeUndefined()
  })
})

describe('membership queries', () => {
  const items = [
    item({ id: 'a', folderId: 'f1' }),
    item({ id: 'b', folderId: 'f2' }),
    item({ id: 'c', seriesId: 's1' }),
    item({ id: 'd' }),
  ]

  it('finds notes in a folder', () => {
    expect(itemsInFolder(items, 'f1').map(i => i.id)).toEqual(['a'])
  })

  it('finds folders in a series', () => {
    expect(foldersInSeries(folders, 's1').map(f => f.id)).toEqual(['f1'])
  })

  it('loose notes exclude foldered ones', () => {
    expect(looseItemsInSeries(items, 's1').map(i => i.id)).toEqual(['c'])
  })

  it('all notes in a series include those reached via a folder', () => {
    expect(allItemsInSeries(items, folders, 's1').map(i => i.id).sort()).toEqual(['a', 'c'])
  })

  it('finds unfiled notes', () => {
    expect(unfiledItems(items).map(i => i.id)).toEqual(['d'])
  })
})

describe('normaliseMembership', () => {
  it('clears a direct series when a folder is chosen', () => {
    expect(normaliseMembership({ folderId: 'f1', seriesId: 's9' })).toEqual({
      folderId: 'f1',
      seriesId: undefined,
    })
  })

  it('keeps a direct series when there is no folder', () => {
    expect(normaliseMembership({ seriesId: 's2' })).toEqual({
      folderId: undefined,
      seriesId: 's2',
    })
  })

  it('treats empty strings as unfiled', () => {
    expect(normaliseMembership({ folderId: '', seriesId: '' })).toEqual({
      folderId: undefined,
      seriesId: undefined,
    })
  })
})

describe('extractHashTags', () => {
  it('pulls tags out of text', () => {
    expect(extractHashTags('聊聊 #React 和 #前端')).toEqual(['React', '前端'])
  })

  it('de-duplicates', () => {
    expect(extractHashTags('#技术 #技术')).toEqual(['技术'])
  })

  it('stops at punctuation', () => {
    expect(extractHashTags('#技术，还有 #运维。')).toEqual(['技术', '运维'])
  })

  it('returns nothing when there are no tags', () => {
    expect(extractHashTags('普通的一段话')).toEqual([])
  })
})
