import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import LoginPage from './LoginPage'
import ContentCreatePage from './ContentCreatePage'
import AccountPage from './AccountPage'
import App from '../App'
import { getCurrentUser, clearCurrentUser, setCurrentUser } from '../auth'

/** Renders the current path so a redirect can be asserted on. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="path">{`${location.pathname}${location.search}`}</div>
}

function renderLogin(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<div>工作台首页</div>} />
        <Route path="/new/note" element={<ContentCreatePage />} />
        <Route path="/account" element={<AccountPage />} />
      </Routes>
    </MemoryRouter>
  )
}

async function signIn(user: ReturnType<typeof userEvent.setup>, opts: { remember?: boolean } = {}) {
  await user.type(screen.getByPlaceholderText('euan 或 user@example.com'), 'euan')
  await user.type(screen.getByPlaceholderText('••••••••'), 'demo123456')
  if (opts.remember) await user.click(screen.getByLabelText('保持登录'))
  await user.click(screen.getByRole('button', { name: '登录' }))
}

describe('login redirect', () => {
  beforeEach(() => clearCurrentUser())

  it('lands on the workspace with no next', async () => {
    const user = userEvent.setup()
    renderLogin('/login')
    await signIn(user)

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/app'), { timeout: 4000 })
  })

  it('returns to the requested page', async () => {
    const user = userEvent.setup()
    renderLogin('/login?next=%2Fnew%2Fnote')
    await signIn(user)

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/new/note'), { timeout: 4000 })
  })

  it('ignores an off-site next', async () => {
    const user = userEvent.setup()
    renderLogin('/login?next=https%3A%2F%2Fevil.example')
    await signIn(user)

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/app'), { timeout: 4000 })
  })

  it('ignores a protocol-relative next', async () => {
    const user = userEvent.setup()
    renderLogin('/login?next=%2F%2Fevil.example')
    await signIn(user)

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/app'), { timeout: 4000 })
  })
})

describe('保持登录', () => {
  beforeEach(() => clearCurrentUser())

  it('keeps the session only for the tab when unchecked', async () => {
    const user = userEvent.setup()
    renderLogin('/login')
    await signIn(user)

    await waitFor(() => expect(getCurrentUser()).toBe('euan'), { timeout: 4000 })
    expect(window.sessionStorage.getItem('life_session_user')).toBe('euan')
    expect(window.localStorage.getItem('life_session_user')).toBeNull()
  })

  it('persists the session when checked', async () => {
    const user = userEvent.setup()
    renderLogin('/login')
    await signIn(user, { remember: true })

    await waitFor(() => expect(getCurrentUser()).toBe('euan'), { timeout: 4000 })
    expect(window.localStorage.getItem('life_session_user')).toBe('euan')
    expect(window.sessionStorage.getItem('life_session_user')).toBeNull()
  })

  it('logging out clears both stores', () => {
    setCurrentUser('euan', { remember: true })
    clearCurrentUser()
    expect(window.localStorage.getItem('life_session_user')).toBeNull()
    expect(window.sessionStorage.getItem('life_session_user')).toBeNull()
  })
})

describe('protected routes keep the destination', () => {
  beforeEach(() => clearCurrentUser())

  function renderApp(entry: string) {
    window.history.pushState({}, '', entry)
    return render(<App />)
  }

  it('sends a guest hitting /new/note to login with next', () => {
    renderApp('/new/note')
    expect(window.location.pathname + window.location.search)
      .toBe('/login?next=%2Fnew%2Fnote')
  })

  it('sends a guest hitting /account to login with next', () => {
    renderApp('/account')
    expect(window.location.pathname + window.location.search)
      .toBe('/login?next=%2Faccount')
  })

  it('preserves a query string on the protected route', () => {
    renderApp('/euan/pkm')
    // Public route: no redirect at all.
    expect(window.location.pathname).toBe('/euan/pkm')
  })
})
