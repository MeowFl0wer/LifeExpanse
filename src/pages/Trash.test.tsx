import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TrashPage from './TrashPage'
import ContentListPage from './ContentListPage'
import ContentDetailPage from './ContentDetailPage'
import SearchPage from './SearchPage'
import { setCurrentUser, clearCurrentUser } from '../auth'
import {
  allContent, trashedItems, addContentItem, addFolder, folders,
  deleteContentItem, restoreContentItem, getTrash, purgeExpiredTrash, emptyTrash,
} from '../mockData'
import type { ContentItem } from '../types'

const DAY = 24 * 60 * 60 * 1000

function seed(overrides: Partial<ContentItem> = {}): ContentItem {
  const suffix = Math.random().toString(36).slice(2)
  const item: ContentItem = {
    id: `t-${suffix}`,
    slug: `t-${suffix}`,
    type: 'pkm',
    contentKind: 'note',
    title: `回收站测试 ${suffix}`,
    body: '正文内容',
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

/** Removes anything this file added, so the shared mock store stays clean. */
function resetStore(ids: string[]) {
  for (const id of ids) {
    const live = allContent.findIndex(c => c.id === id)
    if (live >= 0) allContent.splice(live, 1)
    const binned = trashedItems.findIndex(t => t.item.id === id)
    if (binned >= 0) trashedItems.splice(binned, 1)
  }
}

describe('soft delete removes the item from every surface', () => {
  const created: string[] = []

  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  afterEach(() => {
    resetStore(created.splice(0))
  })

  it('drops it out of the live content store', () => {
    const item = seed()
    created.push(item.id)

    deleteContentItem(item.id)

    expect(allContent.some(c => c.id === item.id)).toBe(false)
    expect(trashedItems.some(t => t.item.id === item.id)).toBe(true)
  })

  it('disappears from the list page', () => {
    const item = seed({ title: '会被删掉的笔记' })
    created.push(item.id)

    deleteContentItem(item.id)
    render(
      <MemoryRouter initialEntries={['/euan/pkm']}>
        <Routes>
          <Route path="/:username/:s" element={<ContentListPage section="pkm" />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText('会被删掉的笔记')).toBeNull()
  })

  it('disappears from search', async () => {
    const user = userEvent.setup()
    const item = seed({ title: '搜索不到的笔记' })
    created.push(item.id)
    deleteContentItem(item.id)

    render(<MemoryRouter initialEntries={['/search']}><SearchPage /></MemoryRouter>)
    await user.type(screen.getByPlaceholderText('搜索标题、正文、地点...'), '搜索不到')
    await user.click(screen.getByRole('button', { name: '搜索' }))

    expect(screen.queryByText('搜索不到的笔记')).toBeNull()
  })

  it('its detail page 404s', () => {
    const item = seed()
    created.push(item.id)
    deleteContentItem(item.id)

    render(
      <MemoryRouter initialEntries={[`/euan/pkm/${item.slug}`]}>
        <Routes>
          <Route path="/:username/pkm/:slug" element={<ContentDetailPage section="pkm" />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('404')).toBeTruthy()
  })

  it('is no longer counted inside its folder', () => {
    const folderId = `fd-test-${Math.random().toString(36).slice(2)}`
    addFolder({ id: folderId, owner: 'euan', name: '临时文件夹', createdAt: '' })
    const item = seed({ folderIds: [folderId] })
    created.push(item.id)

    deleteContentItem(item.id)

    expect(allContent.filter(c => (c.folderIds ?? []).includes(folderId))).toHaveLength(0)
    const idx = folders.findIndex(f => f.id === folderId)
    if (idx >= 0) folders.splice(idx, 1)
  })
})

describe('restore', () => {
  const created: string[] = []

  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  afterEach(() => {
    resetStore(created.splice(0))
  })

  it('puts the item back into the live store', () => {
    const item = seed()
    created.push(item.id)

    deleteContentItem(item.id)
    restoreContentItem(item.id)

    expect(allContent.some(c => c.id === item.id)).toBe(true)
    expect(trashedItems.some(t => t.item.id === item.id)).toBe(false)
  })

  it('gives a fresh slug when the old one was taken while it sat in the bin', () => {
    const item = seed({ slug: 'contested-slug' })
    created.push(item.id)
    deleteContentItem(item.id)

    const replacement = seed({ slug: 'contested-slug' })
    created.push(replacement.id)

    restoreContentItem(item.id)

    const restored = allContent.find(c => c.id === item.id)!
    expect(restored.slug).not.toBe('contested-slug')
    // The item that took the slug keeps it.
    expect(allContent.filter(c => c.slug === 'contested-slug')).toHaveLength(1)
  })
})

describe('retention', () => {
  const created: string[] = []

  afterEach(() => {
    resetStore(created.splice(0))
    vi.restoreAllMocks()
  })

  it('purges entries past the window and keeps the rest', () => {
    const stale = seed()
    const fresh = seed()
    created.push(stale.id, fresh.id)

    deleteContentItem(stale.id)
    deleteContentItem(fresh.id)
    // Backdate one deletion beyond the retention window.
    trashedItems.find(t => t.item.id === stale.id)!.deletedAt =
      new Date(Date.now() - 31 * DAY).toISOString()

    purgeExpiredTrash()

    expect(trashedItems.some(t => t.item.id === stale.id)).toBe(false)
    expect(trashedItems.some(t => t.item.id === fresh.id)).toBe(true)
  })

  it('emptying only affects that owner', () => {
    const mine = seed({ author: 'euan' })
    const theirs = seed({ author: 'alice' })
    created.push(mine.id, theirs.id)

    deleteContentItem(mine.id)
    deleteContentItem(theirs.id)
    emptyTrash('euan')

    expect(getTrash('euan')).toHaveLength(0)
    expect(getTrash('alice').some(t => t.item.id === theirs.id)).toBe(true)
  })
})

describe('trash page', () => {
  const created: string[] = []

  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  afterEach(() => {
    resetStore(created.splice(0))
    vi.restoreAllMocks()
  })

  function renderTrash() {
    return render(<MemoryRouter initialEntries={['/trash']}><TrashPage /></MemoryRouter>)
  }

  it('lists a deleted item with how long it has left', () => {
    const item = seed({ title: '在回收站里的笔记' })
    created.push(item.id)
    deleteContentItem(item.id)

    renderTrash()

    expect(screen.getByText('在回收站里的笔记')).toBeTruthy()
    expect(screen.getByText(/天后清理|今天到期/)).toBeTruthy()
  })

  it('restores from the page', async () => {
    const user = userEvent.setup()
    const item = seed({ title: '要恢复的笔记' })
    created.push(item.id)
    deleteContentItem(item.id)

    renderTrash()
    await user.click(screen.getByRole('button', { name: '恢复' }))

    expect(allContent.some(c => c.id === item.id)).toBe(true)
    expect(screen.getByText(/已恢复/)).toBeTruthy()
  })

  it('permanent delete takes two steps', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const item = seed()
    created.push(item.id)
    deleteContentItem(item.id)

    renderTrash()
    await user.click(screen.getByRole('button', { name: '彻底删除' }))
    // Still there after the first step.
    expect(trashedItems.some(t => t.item.id === item.id)).toBe(true)

    await user.click(screen.getByRole('button', { name: '确认彻底删除' }))
    expect(trashedItems.some(t => t.item.id === item.id)).toBe(false)
  })

  it('keeps the item if the final confirm is declined', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const item = seed()
    created.push(item.id)
    deleteContentItem(item.id)

    renderTrash()
    await user.click(screen.getByRole('button', { name: '彻底删除' }))
    await user.click(screen.getByRole('button', { name: '确认彻底删除' }))

    expect(trashedItems.some(t => t.item.id === item.id)).toBe(true)
  })

  it('shows an empty state when nothing is deleted', () => {
    renderTrash()
    expect(screen.getByText('回收站是空的。')).toBeTruthy()
  })
})
