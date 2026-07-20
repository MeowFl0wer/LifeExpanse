import { describe, it, expect, afterEach } from 'vitest'
import {
  listPkm, getPkmBySlug, createPkm, updatePkm, deletePkm,
  publishAsArticle, revertToNote, toggleFavourite, toggleArchived,
  getLinkGraph, listFolders, listSeries,
  createFolder, saveFolder, removeFolder,
  createSeriesEntry, removeSeries,
} from './pkm'
import { ApiError } from './client'
import { allContent, folders, series, trashedItems } from './store'

const createdContent: string[] = []
const createdFolders: string[] = []
const createdSeries: string[] = []

afterEach(() => {
  for (const id of createdContent.splice(0)) {
    const live = allContent.findIndex(c => c.id === id)
    if (live >= 0) allContent.splice(live, 1)
    const binned = trashedItems.findIndex(t => t.item.id === id)
    if (binned >= 0) trashedItems.splice(binned, 1)
  }
  for (const id of createdFolders.splice(0)) {
    const i = folders.findIndex(f => f.id === id)
    if (i >= 0) folders.splice(i, 1)
  }
  for (const id of createdSeries.splice(0)) {
    const i = series.findIndex(s => s.id === id)
    if (i >= 0) series.splice(i, 1)
  }
})

async function makeNote(overrides: Partial<Parameters<typeof createPkm>[1]> = {}) {
  const item = await createPkm('euan', {
    title: `测试笔记 ${Math.random().toString(36).slice(2)}`,
    body: '正文',
    contentKind: 'note',
    visibility: 'public',
    tagNames: [],
    folderIds: [],
    seriesIds: [],
    ...overrides,
  })
  createdContent.push(item.id)
  return item
}

describe('permission filtering lives in the data layer', () => {
  it('hides another author’s private content from a guest', async () => {
    const item = await makeNote({ visibility: 'private' })
    const asGuest = await listPkm({ author: 'euan', viewer: null })
    expect(asGuest.some(c => c.id === item.id)).toBe(false)
  })

  it('shows it to its author', async () => {
    const item = await makeNote({ visibility: 'private' })
    const asOwner = await listPkm({ author: 'euan', viewer: 'euan' })
    expect(asOwner.some(c => c.id === item.id)).toBe(true)
  })

  // Missing and hidden must be indistinguishable, or the error doubles as a probe.
  it('returns the same 404 for hidden and missing content', async () => {
    const hidden = await makeNote({ visibility: 'draft' })

    const hiddenErr = await getPkmBySlug({ author: 'euan', slug: hidden.slug, viewer: null }).catch(e => e as ApiError)
    const missingErr = await getPkmBySlug({ author: 'euan', slug: 'no-such-slug', viewer: null }).catch(e => e as ApiError)

    expect(hiddenErr).toBeInstanceOf(ApiError)
    expect((hiddenErr as ApiError).status).toBe(404)
    expect((hiddenErr as ApiError).message).toBe((missingErr as ApiError).message)
  })
})

describe('create and update', () => {
  it('rejects an empty title', async () => {
    await expect(
      createPkm('euan', {
        title: '  ', body: 'x', contentKind: 'note', visibility: 'public',
        tagNames: [], folderIds: [], seriesIds: [],
      })
    ).rejects.toThrow('标题不能为空')
  })

  it('rejects an empty body', async () => {
    await expect(
      createPkm('euan', {
        title: 'x', body: '  ', contentKind: 'note', visibility: 'public',
        tagNames: [], folderIds: [], seriesIds: [],
      })
    ).rejects.toThrow('正文不能为空')
  })

  it('derives a summary when none is given', async () => {
    const item = await makeNote({ body: '这是自动摘要的来源内容' })
    expect(item.summary).toContain('这是自动摘要')
  })

  it('keeps an explicit summary', async () => {
    const item = await makeNote({ summary: '手写摘要' })
    expect(item.summary).toBe('手写摘要')
  })

  it('leaves publishedAt empty for a draft', async () => {
    const item = await makeNote({ visibility: 'draft' })
    expect(item.publishedAt).toBe('')
  })

  it('persists article fields', async () => {
    const item = await makeNote({
      contentKind: 'article',
      category: '产品与工程',
      seoTitle: 'SEO 标题',
      seoDescription: 'SEO 描述',
      cover: '/cover.png',
    })
    expect(item.category).toBe('产品与工程')
    expect(item.seoTitle).toBe('SEO 标题')
    expect(item.cover).toBe('/cover.png')
  })

  it('updates only the fields provided', async () => {
    const item = await makeNote({ summary: '原摘要' })
    const updated = await updatePkm(item.id, 'euan', { title: '新标题' })
    expect(updated.title).toBe('新标题')
    expect(updated.summary).toBe('原摘要')
  })
})

describe('note and article forms', () => {
  it('publishing keeps the same id and body', async () => {
    const note = await makeNote({ body: '原始正文' })
    const article = await publishAsArticle(note.id, 'euan')

    expect(article.id).toBe(note.id)
    expect(article.body).toBe('原始正文')
    expect(article.contentKind).toBe('article')
    expect(article.allowComments).toBe(true)
  })

  it('publishing persists rather than only changing the view', async () => {
    const note = await makeNote()
    await publishAsArticle(note.id, 'euan')
    expect(allContent.find(c => c.id === note.id)!.contentKind).toBe('article')
  })

  it('reverting turns comments off', async () => {
    const note = await makeNote({ contentKind: 'article', allowComments: true })
    const reverted = await revertToNote(note.id, 'euan')
    expect(reverted.contentKind).toBe('note')
    expect(reverted.allowComments).toBe(false)
  })
})

describe('favourite and archive', () => {
  it('archived content is out of the default listing', async () => {
    const item = await makeNote()
    await toggleArchived(item.id, 'euan', true)

    const normal = await listPkm({ author: 'euan', viewer: 'euan' })
    const withArchived = await listPkm({ author: 'euan', viewer: 'euan', includeArchived: true })

    expect(normal.some(c => c.id === item.id)).toBe(false)
    expect(withArchived.some(c => c.id === item.id)).toBe(true)
  })

  it('can filter to favourites', async () => {
    const item = await makeNote()
    await toggleFavourite(item.id, 'euan', true)
    const faves = await listPkm({ author: 'euan', viewer: 'euan', favouriteOnly: true })
    expect(faves.every(c => c.favorite)).toBe(true)
    expect(faves.some(c => c.id === item.id)).toBe(true)
  })
})

describe('link graph', () => {
  it('reports outgoing links, backlinks and unresolved targets', async () => {
    const target = await makeNote({ title: '被链接的笔记' })
    const source = await makeNote({ body: `见 [[${target.slug}]] 和 [[不存在的笔记]]` })

    const fromSource = await getLinkGraph(source, 'euan')
    expect(fromSource.outgoing.map(i => i.id)).toEqual([target.id])
    expect(fromSource.unresolved).toEqual(['不存在的笔记'])

    const fromTarget = await getLinkGraph(target, 'euan')
    expect(fromTarget.backlinks.map(i => i.id)).toEqual([source.id])
  })

  it('does not surface links through content the viewer cannot see', async () => {
    const target = await makeNote({ title: '公开目标' })
    const secret = await makeNote({ visibility: 'private', body: `[[${target.slug}]]` })
    createdContent.push(secret.id)

    const asGuest = await getLinkGraph(target, null)
    expect(asGuest.backlinks.some(i => i.id === secret.id)).toBe(false)
  })
})

describe('library', () => {
  it('hides a folder with no public content from a guest', async () => {
    const folder = await createFolder('euan', { name: '私密文件夹' })
    createdFolders.push(folder.id)
    const item = await makeNote({ visibility: 'private', folderIds: [folder.id] })
    createdContent.push(item.id)

    const asGuest = await listFolders('euan', null)
    const asOwner = await listFolders('euan', 'euan')

    expect(asGuest.some(f => f.id === folder.id)).toBe(false)
    expect(asOwner.some(f => f.id === folder.id)).toBe(true)
  })

  it('shows a series reached through a public folder', async () => {
    const entry = await createSeriesEntry('euan', { name: '临时系列' })
    createdSeries.push(entry.id)
    const folder = await createFolder('euan', { name: '临时文件夹', seriesIds: [entry.id] })
    createdFolders.push(folder.id)
    const item = await makeNote({ visibility: 'public', folderIds: [folder.id] })
    createdContent.push(item.id)

    const asGuest = await listSeries('euan', null)
    expect(asGuest.some(s => s.id === entry.id)).toBe(true)
  })

  it('rejects a blank folder name', async () => {
    await expect(createFolder('euan', { name: '   ' })).rejects.toThrow('文件夹名称不能为空')
  })

  // Deleting a container must never destroy what it held.
  it('deleting a folder detaches its content instead of deleting it', async () => {
    const folder = await createFolder('euan', { name: '待删文件夹' })
    const item = await makeNote({ folderIds: [folder.id] })

    const result = await removeFolder(folder.id, 'euan')

    expect(result.detached).toBe(1)
    expect(allContent.some(c => c.id === item.id)).toBe(true)
    expect(allContent.find(c => c.id === item.id)!.folderIds).toEqual([])
    expect(folders.some(f => f.id === folder.id)).toBe(false)
  })

  it('deleting a series detaches its folders and content', async () => {
    const entry = await createSeriesEntry('euan', { name: '待删系列' })
    const folder = await createFolder('euan', { name: '子文件夹', seriesIds: [entry.id] })
    createdFolders.push(folder.id)
    const item = await makeNote({ seriesIds: [entry.id] })

    const result = await removeSeries(entry.id, 'euan')

    expect(result.detachedFolders).toBe(1)
    expect(result.detachedItems).toBe(1)
    expect(folders.find(f => f.id === folder.id)!.seriesIds).toEqual([])
    expect(allContent.find(c => c.id === item.id)!.seriesIds).toEqual([])
    expect(series.some(s => s.id === entry.id)).toBe(false)
  })

  it('saving a folder updates its series membership', async () => {
    const entry = await createSeriesEntry('euan', { name: '目标系列' })
    createdSeries.push(entry.id)
    const folder = await createFolder('euan', { name: '会改归属的文件夹' })
    createdFolders.push(folder.id)

    const saved = await saveFolder(folder.id, 'euan', { name: '改名后', seriesIds: [entry.id] })

    expect(saved.name).toBe('改名后')
    expect(saved.seriesIds).toEqual([entry.id])
  })
})

describe('ownership is enforced in the data layer', () => {
  it('another user cannot update your content', async () => {
    const item = await makeNote()
    await expect(updatePkm(item.id, 'alice', { title: '被别人改了' })).rejects.toThrow('内容不存在')
    expect(allContent.find(c => c.id === item.id)!.title).toBe(item.title)
  })

  it('another user cannot delete your content', async () => {
    const item = await makeNote()
    await expect(deletePkm(item.id, 'alice')).rejects.toThrow('内容不存在')
    expect(allContent.some(c => c.id === item.id)).toBe(true)
  })

  it('another user cannot publish your note', async () => {
    const item = await makeNote()
    await expect(publishAsArticle(item.id, 'alice')).rejects.toThrow('内容不存在')
  })

  it('another user cannot rename or delete your folder', async () => {
    const folder = await createFolder('euan', { name: '我的文件夹' })
    createdFolders.push(folder.id)
    await expect(saveFolder(folder.id, 'alice', { name: '改名' })).rejects.toThrow('文件夹不存在')
    await expect(removeFolder(folder.id, 'alice')).rejects.toThrow('文件夹不存在')
  })

  it('another user cannot delete your series', async () => {
    const entry = await createSeriesEntry('euan', { name: '我的系列' })
    createdSeries.push(entry.id)
    await expect(removeSeries(entry.id, 'alice')).rejects.toThrow('系列不存在')
  })
})

describe('lookups are scoped to author and type', () => {
  it('does not serve one author’s slug under another author', async () => {
    const item = await makeNote()
    await expect(
      getPkmBySlug({ author: 'alice', slug: item.slug, viewer: 'euan' })
    ).rejects.toThrow('内容不存在')
  })

  it('does not serve a diary entry through the pkm route', async () => {
    // 'demo-diary' is seed diary content belonging to euan.
    await expect(
      getPkmBySlug({ author: 'euan', slug: 'demo-diary', viewer: 'euan' })
    ).rejects.toThrow('内容不存在')
  })

  it('serves the author’s own pkm slug', async () => {
    const item = await makeNote()
    const found = await getPkmBySlug({ author: 'euan', slug: item.slug, viewer: null })
    expect(found.id).toBe(item.id)
  })
})

describe('delete', () => {
  it('moves content to the recycle bin', async () => {
    const item = await makeNote()
    await deletePkm(item.id, 'euan')

    expect(allContent.some(c => c.id === item.id)).toBe(false)
    expect(trashedItems.some(t => t.item.id === item.id)).toBe(true)
  })

  it('rejects an unknown id', async () => {
    await expect(deletePkm('nope', 'euan')).rejects.toThrow('内容不存在')
  })
})
