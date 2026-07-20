import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentCreatePage from './ContentCreatePage'
import { setCurrentUser, clearCurrentUser } from '../auth'
import { listPkm } from '../api/pkm'

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
