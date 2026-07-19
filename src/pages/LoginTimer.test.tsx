import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'
import { clearCurrentUser } from '../auth'

const navigateSpy = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateSpy }
})

/** Fills the form and submits without waiting for the simulated request. */
function submitValidCredentials() {
  const credential = screen.getByPlaceholderText('euan 或 user@example.com') as HTMLInputElement
  const password = screen.getByPlaceholderText('••••••••') as HTMLInputElement

  act(() => {
    credential.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
      .set!.call(credential, 'euan')
    credential.dispatchEvent(new Event('input', { bubbles: true }))

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
      .set!.call(password, 'demo123456')
    password.dispatchEvent(new Event('input', { bubbles: true }))
  })

  act(() => {
    screen.getByRole('button', { name: '登录' }).click()
  })
}

describe('login redirect timer', () => {
  beforeEach(() => {
    clearCurrentUser()
    navigateSpy.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('navigates once the success pause elapses', async () => {
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>)
    submitValidCredentials()

    // Simulated request, then the success pause.
    await act(async () => { await vi.advanceTimersByTimeAsync(1200) })
    expect(navigateSpy).not.toHaveBeenCalled()

    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(navigateSpy).toHaveBeenCalledWith('/app')
  })

  // The reported issue: leaving during the pause used to pull the user back.
  it('does not navigate if the page is left during the success pause', async () => {
    const view = render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>)
    submitValidCredentials()

    await act(async () => { await vi.advanceTimersByTimeAsync(1200) })
    view.unmount()

    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('does not update state if the page is left during the request', async () => {
    const view = render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>)
    submitValidCredentials()

    // Leave while the simulated request is still in flight.
    view.unmount()

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(navigateSpy).not.toHaveBeenCalled()
  })
})
