import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentDetailPage from './ContentDetailPage'
import ContentEditPage from './ContentEditPage'
import ContentListPage from './ContentListPage'
import { setCurrentUser, clearCurrentUser } from '../auth'
import { createPkm, createFolder, createSeriesEntry } from '../api/pkm'
import { allContent, folders, series, trashedItems } from '../mockData'

const madeContent: string[] = []
const madeFolders: string[] = []
const madeSeries: string[] = []

afterEach(() => {
  for (const id of madeContent.splice(0)) {
    const i = allContent.findIndex(c => c.id === id)
    if (i >= 0) allContent.splice(i, 1)
    const t = trashedItems.findIndex(x => x.item.id === id)
    if (t >= 0) trashedItems.splice(t, 1)
  }
  for (const id of madeFolders.splice(0)) {
    const i = folders.findIndex(f => f.id === id)
    if (i >= 0) folders.splice(i, 1)
  }
  for (const id of madeSeries.splice(0)) {
    const i = series.findIndex(s => s.id === id)
    if (i >= 0) series.splice(i, 1)
  }
  vi.restoreAllMocks()
})

async function makeNote(over: Partial<Parameters<typeof createPkm>[1]> = {}) {
  const item = await createPkm('euan', {
    title: `笔记 ${Math.random().toString(36).slice(2, 7)}`,
    body: '正文',
    contentKind: 'note',
    visibility: 'public',
    tagNames: [], folderIds: [], seriesIds: [],
    ...over,
  })
  madeContent.push(item.id)
  return item
}

function renderDetail(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/euan/pkm/${slug}`]}>
      <Routes>
        <Route path="/:username/pkm/:slug" element={<ContentDetailPage section="pkm" />} />
        <Route path="/:username/pkm" element={<div>列表</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('publish as article', () => {
  beforeEach(() => { clearCurrentUser(); setCurrentUser('euan') })

  it('persists instead of only changing the current view', async () => {
    const user = userEvent.setup()
    const note = await makeNote()
    renderDetail(note.slug)
    await waitFor(() => expect(screen.getByRole('button', { name: /发布为文章/ })).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /发布为文章/ }))

    await waitFor(() =>
      expect(allContent.find(c => c.id === note.id)!.contentKind).toBe('article')
    )
  })

  it('offers reverting once it is an article', async () => {
    const article = await makeNote({ contentKind: 'article' })
    renderDetail(article.slug)
    await waitFor(() => expect(screen.getByRole('button', { name: /退回笔记/ })).toBeTruthy())
  })
})

describe('table of contents', () => {
  beforeEach(() => { clearCurrentUser(); setCurrentUser('euan') })

  it('lists the headings of an article', async () => {
    const article = await makeNote({
      contentKind: 'article',
      body: '# 开头\n\n正文\n\n## 中间\n\n## 结尾',
    })
    renderDetail(article.slug)

    await waitFor(() => expect(screen.getByRole('navigation', { name: '内容目录' })).toBeTruthy())
    const toc = screen.getByRole('navigation', { name: '内容目录' })
    expect(toc.textContent).toContain('开头')
    expect(toc.textContent).toContain('中间')
  })

  // Notes get an outline too — a long note benefits from it exactly as an
  // article does.
  it('lists the headings of a note as well', async () => {
    const note = await makeNote({ body: '# 笔记开头\n\n正文\n\n## 笔记中间' })
    renderDetail(note.slug)

    await waitFor(() => expect(screen.getByRole('navigation', { name: '内容目录' })).toBeTruthy())
    const toc = screen.getByRole('navigation', { name: '内容目录' })
    expect(toc.textContent).toContain('笔记开头')
    expect(toc.textContent).toContain('笔记中间')
  })

  // Without this the sidebar column would still be reserved, leaving an empty
  // gutter beside content that has nothing to outline.
  it('is not shown when the body has no headings', async () => {
    const note = await makeNote({ body: '只有正文，没有任何标题。' })
    renderDetail(note.slug)
    await waitFor(() => expect(screen.getAllByText(note.title).length).toBeGreaterThan(0))
    expect(screen.queryByRole('navigation', { name: '内容目录' })).toBeNull()
  })
})

describe('links between notes', () => {
  beforeEach(() => { clearCurrentUser(); setCurrentUser('euan') })

  it('renders a wiki link to the target note', async () => {
    const target = await makeNote({ title: '目标笔记 abc' })
    const source = await makeNote({ body: `见 [[${target.slug}]]` })

    renderDetail(source.slug)

    await waitFor(() => {
      const link = screen.getByText(target.title, { selector: 'a' })
      expect(link.getAttribute('href')).toBe(`/euan/pkm/${target.slug}`)
    })
  })

  it('shows backlinks on the target', async () => {
    const target = await makeNote({ title: '被引用 xyz' })
    const source = await makeNote({ title: '引用来源 qwe', body: `见 [[${target.slug}]]` })

    renderDetail(target.slug)

    await waitFor(() => expect(screen.getByText('链接到这里的笔记')).toBeTruthy())
    expect(screen.getByText(source.title)).toBeTruthy()
  })

  it('flags an unresolved link for the author', async () => {
    const note = await makeNote({ body: '见 [[还没写的笔记]]' })
    renderDetail(note.slug)
    await waitFor(() => expect(screen.getByText(/还没有对应笔记的链接/)).toBeTruthy())
  })
})

describe('editor article fields', () => {
  beforeEach(() => { clearCurrentUser(); setCurrentUser('euan') })

  function renderEdit(slug: string) {
    return render(
      <MemoryRouter initialEntries={[`/euan/pkm/${slug}/edit`]}>
        <Routes>
          <Route path="/:username/pkm/:slug/edit" element={<ContentEditPage section="pkm" />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('exposes summary, favourite and archive for any note', async () => {
    const note = await makeNote()
    renderEdit(note.slug)

    expect(screen.getByLabelText('摘要')).toBeTruthy()
    expect(screen.getByLabelText('收藏')).toBeTruthy()
    expect(screen.getByLabelText(/归档/)).toBeTruthy()
  })

  it('shows article-only fields only for articles', async () => {
    const note = await makeNote()
    const { unmount } = renderEdit(note.slug)
    expect(screen.queryByLabelText('分类')).toBeNull()
    unmount()

    const article = await makeNote({ contentKind: 'article' })
    renderEdit(article.slug)
    expect(screen.getByLabelText('分类')).toBeTruthy()
    expect(screen.getByLabelText('SEO 标题')).toBeTruthy()
  })

  it('saves the summary', async () => {
    const user = userEvent.setup()
    const note = await makeNote()
    renderEdit(note.slug)

    await user.clear(screen.getByLabelText('摘要'))
    await user.type(screen.getByLabelText('摘要'), '我写的摘要')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() =>
      expect(allContent.find(c => c.id === note.id)!.summary).toBe('我写的摘要')
    , { timeout: 3000 })
  })
})

describe('library management', () => {
  beforeEach(() => { clearCurrentUser(); setCurrentUser('euan') })

  function renderList(entry: string) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/:username/:s" element={<ContentListPage section="pkm" />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('offers settings and delete inside a folder', async () => {
    const folder = await createFolder('euan', { name: '可管理文件夹' })
    madeFolders.push(folder.id)

    renderList(`/euan/pkm?folder=${folder.id}`)

    await waitFor(() => expect(screen.getByRole('button', { name: '设置' })).toBeTruthy())
    expect(screen.getByRole('button', { name: '删除' })).toBeTruthy()
  })

  // Deleting a container must not take its contents with it.
  it('deleting a folder keeps its notes and unfiles them', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    const folder = await createFolder('euan', { name: '待删文件夹' })
    const note = await makeNote({ folderIds: [folder.id] })

    renderList(`/euan/pkm?folder=${folder.id}`)
    await waitFor(() => expect(screen.getByRole('button', { name: '删除' })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => expect(folders.some(f => f.id === folder.id)).toBe(false))
    expect(allContent.some(c => c.id === note.id)).toBe(true)
    expect(allContent.find(c => c.id === note.id)!.folderIds).toEqual([])
  })

  it('offers settings and delete inside a series', async () => {
    const entry = await createSeriesEntry('euan', { name: '可管理系列' })
    madeSeries.push(entry.id)

    renderList(`/euan/pkm?series=${entry.id}`)

    await waitFor(() => expect(screen.getByRole('button', { name: '设置' })).toBeTruthy())
    expect(screen.getByRole('button', { name: '删除' })).toBeTruthy()
  })

  it('does not offer management to a guest', async () => {
    const folder = await createFolder('euan', { name: '公开文件夹' })
    madeFolders.push(folder.id)
    const note = await makeNote({ folderIds: [folder.id], visibility: 'public' })
    madeContent.push(note.id)

    clearCurrentUser()
    renderList(`/euan/pkm?folder=${folder.id}`)
    await waitFor(() => expect(screen.getAllByText('公开文件夹').length).toBeGreaterThan(0))

    expect(screen.queryByRole('button', { name: '设置' })).toBeNull()
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull()
  })
})
