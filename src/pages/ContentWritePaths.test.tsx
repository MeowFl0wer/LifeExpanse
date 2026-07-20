import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentCreatePage from './ContentCreatePage'
import { setCurrentUser, clearCurrentUser } from '../auth'
import { createPkm, getPkmBySlug, listPkm } from '../api/pkm'

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateSpy }
})

beforeEach(() => {
  clearCurrentUser()
  setCurrentUser('euan')
  navigateSpy.mockClear()
})

function renderCreate(type: string) {
  return render(
    <MemoryRouter initialEntries={[`/new/${type}`]}>
      <Routes><Route path="/new/:type" element={<ContentCreatePage />} /></Routes>
    </MemoryRouter>
  )
}

/**
 * Thoughts and diary entries used to write to the store directly, bypassing
 * the data layer. With a backend configured that meant they were not saved at
 * all, and the ownership rule the data layer enforces did not apply to them.
 */
describe('every content type goes through the data layer', () => {
  it('creates a thought through it', async () => {
    const user = userEvent.setup()
    renderCreate('thought')

    await user.type(screen.getByPlaceholderText(/写点什么|标题/), '一个随想')
    const body = screen.getAllByRole('textbox').find(el => el.tagName === 'TEXTAREA')!
    await user.type(body, '随想的正文内容')
    await user.click(screen.getByRole('button', { name: /保存|发布/ }))

    await waitFor(async () => {
      const items = await listPkm({ author: 'euan', viewer: 'euan', type: 'thought' })
      expect(items.some(i => i.title === '一个随想')).toBe(true)
    }, { timeout: 3000 })
  })

  it('creates a diary entry through it', async () => {
    const user = userEvent.setup()
    renderCreate('diary')

    await user.type(screen.getByPlaceholderText(/写点什么|标题/), '今天的日记')
    const body = screen.getAllByRole('textbox').find(el => el.tagName === 'TEXTAREA')!
    await user.type(body, '日记的正文内容')
    await user.click(screen.getByRole('button', { name: /保存|发布/ }))

    await waitFor(async () => {
      const items = await listPkm({ author: 'euan', viewer: 'euan', type: 'diary' })
      expect(items.some(i => i.title === '今天的日记')).toBe(true)
    }, { timeout: 3000 })
  })
})

/**
 * Reads matter as much as writes. Routing only the write path meant a thought
 * saved to the server and then vanished: the list read memory, and the detail
 * page 404'd on something that was really there.
 */
describe('every content type is read through the data layer', () => {
  it('a newly created thought appears in the thoughts list', async () => {
    const user = userEvent.setup()
    renderCreate('thought')

    await user.type(screen.getByPlaceholderText(/写点什么|标题/), '会出现在列表里')
    const body = screen.getAllByRole('textbox').find(el => el.tagName === 'TEXTAREA')!
    await user.type(body, '正文')
    await user.click(screen.getByRole('button', { name: /保存|发布/ }))

    await waitFor(async () => {
      const items = await listPkm({ author: 'euan', viewer: 'euan', type: 'thought' })
      expect(items.some(i => i.title === '会出现在列表里')).toBe(true)
    }, { timeout: 3000 })
  })

  it('looks a thought up by slug through the data layer', async () => {
    const created = await createPkm('euan', {
      type: 'thought',
      title: '按 slug 查找', body: '正文', visibility: 'public',
      tagNames: [], folderIds: [], seriesIds: [],
    })

    const found = await getPkmBySlug({
      author: 'euan', slug: created.slug, viewer: 'euan', type: 'thought',
    })
    expect(found.id).toBe(created.id)
  })

  it('does not find a thought when asked for a note', async () => {
    const created = await createPkm('euan', {
      type: 'thought',
      title: '类型不匹配', body: '正文', visibility: 'public',
      tagNames: [], folderIds: [], seriesIds: [],
    })

    // Section and type must agree, or /euan/pkm/<thought-slug> would resolve.
    await expect(
      getPkmBySlug({ author: 'euan', slug: created.slug, viewer: 'euan', type: 'pkm' })
    ).rejects.toThrow('内容不存在')
  })

  it('hides a private diary entry from a guest', async () => {
    const created = await createPkm('euan', {
      type: 'diary',
      title: '私密日记', body: '正文', visibility: 'private',
      tagNames: [], folderIds: [], seriesIds: [],
    })

    await expect(
      getPkmBySlug({ author: 'euan', slug: created.slug, viewer: null, type: 'diary' })
    ).rejects.toThrow('内容不存在')
  })

  it('keeps a private diary entry out of a guest list', async () => {
    await createPkm('euan', {
      type: 'diary',
      title: '不该被访客看到', body: '正文', visibility: 'private',
      tagNames: [], folderIds: [], seriesIds: [],
    })

    const items = await listPkm({ author: 'euan', viewer: null, type: 'diary' })
    expect(items.some(i => i.title === '不该被访客看到')).toBe(false)
  })
})
