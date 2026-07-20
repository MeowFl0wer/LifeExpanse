import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MePage from './MePage'
import AboutPage from './AboutPage'
import PublicHeader from '../components/PublicHeader'
import { setCurrentUser, clearCurrentUser } from '../auth'
import { euanProfile } from '../mockData'

function renderMe() {
  return render(
    <MemoryRouter initialEntries={['/me']}>
      <Routes>
        <Route path="/me" element={<MePage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('我的 page', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('shows the profile identity', () => {
    renderMe()
    expect(screen.getByText(euanProfile.displayName)).toBeTruthy()
    expect(screen.getByText('@euan')).toBeTruthy()
  })

  // The whole point of the masking: a screenshot of this page must not carry
  // the address away.
  it('never renders the full email address', () => {
    renderMe()
    expect(screen.getByText('e***n@example.com')).toBeTruthy()
    expect(screen.queryByText(euanProfile.email)).toBeNull()
  })

  it('says so when no backup email is set', () => {
    renderMe()
    expect(screen.getByText('未设置')).toBeTruthy()
  })

  it('lists the five sections in the agreed order', () => {
    renderMe()
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(headings).toEqual(['设置', '记录概况', '数据导出', 'About'])
  })

  it('links out to settings, export and About rather than inlining them', () => {
    renderMe()
    expect(screen.getByRole('link', { name: '打开设置' }).getAttribute('href')).toBe('/account')
    expect(screen.getByRole('link', { name: '前往导出' }).getAttribute('href')).toBe('/account')
    expect(screen.getByRole('link', { name: '查看 About' }).getAttribute('href')).toBe('/about')
  })
})

describe('记录概况 moved off About', () => {
  it('is on 我的', () => {
    clearCurrentUser()
    setCurrentUser('euan')
    renderMe()
    expect(screen.getByText('记录概况')).toBeTruthy()
  })

  it('is no longer on About', () => {
    clearCurrentUser()
    render(
      <MemoryRouter initialEntries={['/about']}>
        <Routes>
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.queryByText('记录概况')).toBeNull()
    // About keeps its own reason for existing.
    expect(screen.getByText('站点说明')).toBeTruthy()
  })
})

describe('header nav slot', () => {
  function renderHeader() {
    return render(<MemoryRouter><PublicHeader /></MemoryRouter>)
  }

  // A first-time visitor needs About; it must not move behind the login.
  it('offers 关于 to a guest', () => {
    clearCurrentUser()
    renderHeader()
    expect(screen.getAllByRole('link', { name: '关于' })[0]!.getAttribute('href')).toBe('/about')
    expect(screen.queryByRole('link', { name: '我的' })).toBeNull()
  })

  it('offers 我的 once signed in', () => {
    clearCurrentUser()
    setCurrentUser('euan')
    renderHeader()
    expect(screen.getAllByRole('link', { name: '我的' })[0]!.getAttribute('href')).toBe('/me')
  })
})
