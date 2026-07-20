import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentDetailPage from './ContentDetailPage'
import ContentCreatePage from './ContentCreatePage'
import { setCurrentUser, clearCurrentUser } from '../auth'
import { allContent, addContentItem } from '../mockData'
import type { ContentItem } from '../types'

function seedItem(overrides: Partial<ContentItem> = {}): ContentItem {
  const item: ContentItem = {
    id: `test-${Math.random().toString(36).slice(2)}`,
    slug: `test-${Math.random().toString(36).slice(2)}`,
    type: 'pkm',
    contentKind: 'note',
    title: '可删除的测试笔记',
    body: '正文',
    summary: '摘要',
    visibility: 'public',
    tags: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    publishedAt: '2024-01-01T00:00:00Z',
    author: 'euan',
    ...overrides,
  }
  addContentItem(item)
  return item
}

function renderDetail(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/euan/pkm/${slug}`]}>
      <Routes>
        <Route path="/:username/pkm/:slug" element={<ContentDetailPage section="pkm" />} />
        <Route path="/:username/pkm" element={<div>笔记列表</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('delete a note', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is not offered to a guest', async () => {
    const item = seedItem()
    clearCurrentUser()
    renderDetail(item.slug)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())
    expect(screen.queryByRole('button', { name: /删除/ })).toBeNull()
  })

  it('sits next to the edit button for the author', async () => {
    const item = seedItem()
    renderDetail(item.slug)
    await waitFor(() => expect(screen.getByRole('button', { name: /编辑/ })).toBeTruthy())
    expect(screen.getByRole('button', { name: /删除/ })).toBeTruthy()
  })

  it('asks before doing anything', async () => {
    const user = userEvent.setup()
    const item = seedItem()
    renderDetail(item.slug)
    await waitFor(() => expect(screen.getByRole('button', { name: /删除/ })).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /删除/ }))

    expect(screen.getByText('确定删除这条内容？')).toBeTruthy()
    // Nothing removed yet.
    expect(allContent.some(c => c.id === item.id)).toBe(true)
  })

  it('can be backed out of', async () => {
    const user = userEvent.setup()
    const item = seedItem()
    renderDetail(item.slug)
    await waitFor(() => expect(screen.getByRole('button', { name: /删除/ })).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /删除/ }))
    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.queryByText('确定删除这条内容？')).toBeNull()
    expect(allContent.some(c => c.id === item.id)).toBe(true)
  })

  it('keeps the item when the second confirmation is declined', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const item = seedItem()
    renderDetail(item.slug)
    await waitFor(() => expect(screen.getByRole('button', { name: /删除/ })).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /删除/ }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    expect(allContent.some(c => c.id === item.id)).toBe(true)
  })

  it('removes the item once both steps are confirmed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const item = seedItem()
    renderDetail(item.slug)
    await waitFor(() => expect(screen.getByRole('button', { name: /删除/ })).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /删除/ }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    expect(allContent.some(c => c.id === item.id)).toBe(false)
    expect(screen.getByText('笔记列表')).toBeTruthy()
  })
})

describe('editor fields are visible controls', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  function renderCreate(entry = '/new/note') {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/new/:type" element={<ContentCreatePage />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('labels the title and body fields', () => {
    renderCreate()
    expect(screen.getByLabelText(/标题/)).toBeTruthy()
    expect(screen.getByLabelText(/正文/)).toBeTruthy()
  })

  it('gives the inputs the shared bordered input style', () => {
    renderCreate()
    expect(screen.getByLabelText(/标题/).className).toContain('life-input')
    expect(screen.getByLabelText(/正文/).className).toContain('life-input')
  })

  it('offers Markdown import for notes and articles', () => {
    renderCreate('/new/note')
    expect(screen.getByText('从 Markdown 文件导入')).toBeTruthy()
  })

  it('does not offer Markdown import for a thought', () => {
    renderCreate('/new/thought')
    expect(screen.queryByText('从 Markdown 文件导入')).toBeNull()
  })
})
