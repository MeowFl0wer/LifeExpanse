import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentListPage from './ContentListPage'
import { setCurrentUser, clearCurrentUser } from '../auth'

type Section = 'thoughts' | 'diary' | 'pkm'

function renderSection(section: Section, username = 'euan') {
  return render(
    <MemoryRouter initialEntries={[`/${username}/${section}`]}>
      <Routes>
        <Route path="/:username/:sectionPath" element={<ContentListPage section={section} />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ContentListPage section routing', () => {
  beforeEach(() => clearCurrentUser())

  it('renders 随想 on the thoughts route, not 笔记与文章', () => {
    renderSection('thoughts')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('随想')
  })

  it('renders 日记 on the diary route, not 笔记与文章', () => {
    renderSection('diary')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('日记')
  })

  it('renders 笔记与文章 on the pkm route', () => {
    renderSection('pkm')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('笔记与文章')
  })
})

describe('ContentListPage guest visibility', () => {
  beforeEach(() => clearCurrentUser())

  it('hides draft content from a guest', async () => {
    renderSection('pkm')
    await waitFor(() => expect(screen.getByText(/条笔记与文章/)).toBeTruthy())
    // 'private-note-draft' is a draft belonging to euan.
    expect(screen.queryByText('待整理的想法（草稿）')).toBeNull()
  })

  it('shows the same draft to its author', async () => {
    setCurrentUser('euan')
    renderSection('pkm')
    await waitFor(() => expect(screen.getByText('待整理的想法（草稿）')).toBeTruthy())
  })

  it('tells a guest the author has published nothing, per section', () => {
    // alice has no content at all in the seed data.
    renderSection('diary', 'alice')
    expect(screen.getByText('作者没有公开任何日记哦～')).toBeTruthy()
  })

  it('uses the section name in that message', () => {
    renderSection('pkm', 'alice')
    expect(screen.getByText('作者没有公开任何笔记与文章哦～')).toBeTruthy()
  })

  it('tells the owner they have nothing yet, not that nothing is public', () => {
    setCurrentUser('alice')
    renderSection('diary', 'alice')
    expect(screen.getByText('还没有日记')).toBeTruthy()
    expect(screen.queryByText('作者没有公开任何日记哦～')).toBeNull()
  })

  // Diary is served by the data layer now, so the list arrives asynchronously.
  it('shows public content to a guest', async () => {
    renderSection('diary')
    await waitFor(() =>
      expect(screen.getByText('东京转机，三个小时的候机室')).toBeTruthy())
  })

  it('offers the quick-capture form only to the owner', () => {
    renderSection('thoughts')
    expect(screen.queryByText('保存随想')).toBeNull()

    clearCurrentUser()
    setCurrentUser('euan')
    renderSection('thoughts')
    expect(screen.getAllByText('保存随想').length).toBeGreaterThan(0)
  })
})
