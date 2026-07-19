import { describe, it, expect } from 'vitest'
import {
  foldersOf, effectiveSeriesIds, itemsInFolder, foldersInSeries, looseItemsInSeries,
  allItemsInSeries, unfiledItems, normaliseMembership, locationTrail, extractHashTags,
} from './library'
import type { ContentItem, Folder, Series } from '../types'

const folders: Folder[] = [
  { id: 'f1', owner: 'euan', name: '前端', seriesIds: ['s1'], createdAt: '' },
  { id: 'f2', owner: 'euan', name: '系统', seriesIds: ['s1', 's2'], createdAt: '' },
  { id: 'f3', owner: 'euan', name: 'Inbox', createdAt: '' },
]

const series: Series[] = [
  { id: 's1', owner: 'euan', name: '工程笔记', createdAt: '' },
  { id: 's2', owner: 'euan', name: '运维手册', createdAt: '' },
]

function item(partial: Partial<ContentItem>): ContentItem {
  return {
    id: 'x', slug: 'x', type: 'pkm', title: 't', body: '', summary: '',
    visibility: 'public', tags: [], createdAt: '', updatedAt: '', publishedAt: '',
    author: 'euan', ...partial,
  }
}

describe('multi-membership', () => {
  it('a note can sit in several folders', () => {
    const note = item({ folderIds: ['f1', 'f3'] })
    expect(foldersOf(note, folders).map(f => f.id)).toEqual(['f1', 'f3'])
  })

  it('a folder can belong to several series', () => {
    expect(foldersInSeries(folders, 's1').map(f => f.id)).toEqual(['f1', 'f2'])
    expect(foldersInSeries(folders, 's2').map(f => f.id)).toEqual(['f2'])
  })

  it('inherits series from every folder the note is in', () => {
    const note = item({ folderIds: ['f2'] })
    expect(effectiveSeriesIds(note, folders).sort()).toEqual(['s1', 's2'])
  })

  it('combines direct and inherited series without duplicates', () => {
    const note = item({ folderIds: ['f1'], seriesIds: ['s1', 's2'] })
    expect(effectiveSeriesIds(note, folders).sort()).toEqual(['s1', 's2'])
  })

  it('a note filed nowhere belongs to no series', () => {
    expect(effectiveSeriesIds(item({}), folders)).toEqual([])
  })
})

describe('series composition', () => {
  const items = [
    item({ id: 'a', folderIds: ['f1'] }),          // via folder f1 -> s1
    item({ id: 'b', seriesIds: ['s1'] }),          // loose in s1
    item({ id: 'c', folderIds: ['f3'], seriesIds: ['s1'] }), // folder not in s1 -> still loose
    item({ id: 'd' }),
  ]

  it('loose notes exclude those reachable through a folder of that series', () => {
    expect(looseItemsInSeries(items, folders, 's1').map(i => i.id)).toEqual(['b', 'c'])
  })

  it('all notes in a series include those reached via folders', () => {
    expect(allItemsInSeries(items, folders, 's1').map(i => i.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('finds notes in a folder', () => {
    expect(itemsInFolder(items, 'f1').map(i => i.id)).toEqual(['a'])
  })

  it('finds unfiled notes', () => {
    expect(unfiledItems(items).map(i => i.id)).toEqual(['d'])
  })
})

describe('normaliseMembership', () => {
  // Rule: a note inside a folder that is in series S must not also be loose in S.
  it('drops a direct series already covered by a chosen folder', () => {
    expect(normaliseMembership({ folderIds: ['f1'], seriesIds: ['s1'] }, folders)).toEqual({
      folderIds: ['f1'],
      seriesIds: [],
    })
  })

  it('keeps a direct series the folders do not cover', () => {
    expect(normaliseMembership({ folderIds: ['f1'], seriesIds: ['s2'] }, folders)).toEqual({
      folderIds: ['f1'],
      seriesIds: ['s2'],
    })
  })

  it('keeps several folders and several series', () => {
    const result = normaliseMembership({ folderIds: ['f1', 'f3'], seriesIds: ['s2'] }, folders)
    expect(result.folderIds).toEqual(['f1', 'f3'])
    expect(result.seriesIds).toEqual(['s2'])
  })

  it('de-duplicates and drops blanks', () => {
    expect(normaliseMembership({ folderIds: ['f3', 'f3', ''], seriesIds: ['s2', 's2'] }, folders)).toEqual({
      folderIds: ['f3'],
      seriesIds: ['s2'],
    })
  })

  it('handles nothing selected', () => {
    expect(normaliseMembership({}, folders)).toEqual({ folderIds: [], seriesIds: [] })
  })
})

describe('locationTrail', () => {
  it('reports every folder and series a note belongs to', () => {
    const note = item({ folderIds: ['f2'] })
    const trail = locationTrail(note, folders, series)
    expect(trail.folders.map(f => f.name)).toEqual(['系统'])
    expect(trail.series.map(s => s.name).sort()).toEqual(['工程笔记', '运维手册'])
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
