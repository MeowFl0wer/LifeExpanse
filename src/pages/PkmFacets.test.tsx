import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentListPage from './ContentListPage'
import { setCurrentUser, clearCurrentUser } from '../auth'

function renderPkm() {
  return render(
    <MemoryRouter initialEntries={['/euan/pkm']}>
      <Routes>
        <Route path="/:username/:sectionPath" element={<ContentListPage section="pkm" />} />
      </Routes>
    </MemoryRouter>
  )
}

// Seed data: two notes (前端 / React, 系统 / Linux), one draft note (Inbox),
// one article (series: LifeExpanse 构建札记). The 技术 tag spans three of them.
describe('PKM folder facet', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('lists folders with counts and filters on click', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))

    const folderChip = screen.getByRole('button', { name: /前端 \/ React/ })
    expect(folderChip).toBeTruthy()

    await user.click(folderChip)

    expect(screen.getByText('React 中的并发模式：一些实践记录')).toBeTruthy()
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
  })

  it('keeps every folder listed after one is chosen', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.click(screen.getByRole('button', { name: /前端 \/ React/ }))

    // The other folders must remain selectable, not vanish with the results.
    expect(screen.getByRole('button', { name: /系统 \/ Linux/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Inbox/ })).toBeTruthy()
  })

  it('clicking the active folder again clears the filter', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))

    const chip = screen.getByRole('button', { name: /前端 \/ React/ })
    await user.click(chip)
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()

    await user.click(screen.getByRole('button', { name: /前端 \/ React/ }))
    expect(screen.getByText('SSH Config 常用配置备忘')).toBeTruthy()
  })
})

describe('PKM tag facet', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('filters to items carrying the clicked tag', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Tags' }))

    await user.click(screen.getByRole('button', { name: /#React/ }))

    expect(screen.getByText('React 中的并发模式：一些实践记录')).toBeTruthy()
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
  })

  it('reports what is being filtered and can clear it', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Tags' }))
    await user.click(screen.getByRole('button', { name: /#React/ }))

    expect(screen.getByText(/正在按/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '清除' }))
    expect(screen.getByText('SSH Config 常用配置备忘')).toBeTruthy()
  })
})

describe('PKM series facet', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('filters to the chosen series', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Series' }))

    await user.click(screen.getByRole('button', { name: /LifeExpanse 构建札记/ }))

    expect(screen.getByText('为什么我要自己做一个记录平台')).toBeTruthy()
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
  })
})

describe('switching views', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('drops a folder filter so it cannot silently hide the next view', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.click(screen.getByRole('button', { name: /前端 \/ React/ }))
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('SSH Config 常用配置备忘')).toBeTruthy()
  })
})

describe('visibility filter chips', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('renders one flat chip per state, not a badge inside a button', () => {
    renderPkm()
    const publicChip = screen.getByRole('button', { name: '公开' })
    // A nested badge would leave an element inside the button; the label is now
    // the button's own text.
    expect(publicChip.querySelector('span')).toBeNull()
    expect(publicChip.textContent).toBe('公开')
  })

  it('filters by visibility', async () => {
    const user = userEvent.setup()
    renderPkm()

    await user.click(screen.getByRole('button', { name: '草稿' }))

    expect(screen.getByText('待整理的想法（草稿）')).toBeTruthy()
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
  })
})
