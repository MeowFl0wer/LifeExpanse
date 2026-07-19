import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PublicHeader from './PublicHeader'
import { setCurrentUser, clearCurrentUser, getCurrentUser } from '../auth'

function renderHeader(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PublicHeader />
    </MemoryRouter>
  )
}

describe('PublicHeader session state', () => {
  beforeEach(() => clearCurrentUser())

  it('offers login while logged out', () => {
    renderHeader()
    expect(screen.getAllByText('登录').length).toBeGreaterThan(0)
    expect(screen.queryByText('登出')).toBeNull()
  })

  it('shows logout and the workspace link once logged in', () => {
    setCurrentUser('euan')
    renderHeader()
    expect(screen.getByText('登出')).toBeTruthy()
    expect(screen.getByText('工作台')).toBeTruthy()
    expect(screen.queryByText('登录')).toBeNull()
  })

  // The original bug: the header read the session once at render, so logging in
  // left every already-mounted header showing the logged-out state.
  it('reacts to a login that happens after mount', () => {
    renderHeader()
    expect(screen.queryByText('登出')).toBeNull()

    act(() => setCurrentUser('euan'))

    expect(screen.getByText('登出')).toBeTruthy()
    expect(screen.queryByText('登录')).toBeNull()
  })

  it('reacts to a logout that happens after mount', () => {
    setCurrentUser('euan')
    renderHeader()
    expect(screen.getByText('登出')).toBeTruthy()

    act(() => clearCurrentUser())

    expect(screen.getAllByText('登录').length).toBeGreaterThan(0)
    expect(screen.queryByText('登出')).toBeNull()
  })

  it('clicking 登出 ends the session', async () => {
    const user = userEvent.setup()
    setCurrentUser('euan')
    renderHeader()

    await user.click(screen.getByText('登出'))

    expect(getCurrentUser()).toBeNull()
    expect(screen.getAllByText('登录').length).toBeGreaterThan(0)
  })

  it('links to the about page', () => {
    renderHeader()
    const about = screen.getAllByText('关于')[0] as HTMLAnchorElement
    expect(about.getAttribute('href')).toBe('/about')
  })
})
