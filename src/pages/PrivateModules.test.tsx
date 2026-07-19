import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TrajectoryPage from './TrajectoryPage'
import FootprintMapPage from './FootprintMapPage'
import FlightsPage from './FlightsPage'
import HomePage from './HomePage'
import { setCurrentUser, clearCurrentUser } from '../auth'

function renderAt(path: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:username/*" element={element} />
      </Routes>
    </MemoryRouter>
  )
}

describe('private modules hide their data from guests', () => {
  beforeEach(() => clearCurrentUser())

  it('trajectory shows the prompt, not the entries', () => {
    renderAt('/euan/trajectory', <TrajectoryPage />)
    expect(screen.getByText('隐私内容请登录后查看')).toBeTruthy()
    // A real entry summary from the seed data must not be rendered.
    expect(screen.queryByText('成田机场转机，候机三小时。')).toBeNull()
  })

  it('footprint map shows the prompt, not the cities', () => {
    renderAt('/euan/map', <FootprintMapPage />)
    expect(screen.getByText('隐私内容请登录后查看')).toBeTruthy()
    expect(screen.queryByText('首尔')).toBeNull()
  })

  it('flights shows the prompt, not the flight numbers', () => {
    renderAt('/euan/flights', <FlightsPage />)
    expect(screen.getByText('隐私内容请登录后查看')).toBeTruthy()
    expect(screen.queryByText('NH202')).toBeNull()
  })

  it('still tells the guest how much exists', () => {
    renderAt('/euan/flights', <FlightsPage />)
    expect(screen.getByText(/5 段航班/)).toBeTruthy()
  })
})

describe('private modules open up for the owner', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('trajectory renders real entries', () => {
    renderAt('/euan/trajectory', <TrajectoryPage />)
    expect(screen.queryByText('隐私内容请登录后查看')).toBeNull()
    expect(screen.getByText('成田机场转机，候机三小时。')).toBeTruthy()
  })

  it('footprint map renders real cities', () => {
    renderAt('/euan/map', <FootprintMapPage />)
    expect(screen.queryByText('隐私内容请登录后查看')).toBeNull()
    expect(screen.getAllByText('首尔').length).toBeGreaterThan(0)
  })

  it('flights renders real flight numbers', () => {
    renderAt('/euan/flights', <FlightsPage />)
    expect(screen.queryByText('隐私内容请登录后查看')).toBeNull()
    expect(screen.getByText('NH202')).toBeTruthy()
  })
})

describe('homepage private sidebar', () => {
  beforeEach(() => clearCurrentUser())

  it('hides trajectory detail from a guest but names the module', () => {
    render(<MemoryRouter initialEntries={['/']}><HomePage /></MemoryRouter>)
    expect(screen.getByText('私密板块')).toBeTruthy()
    expect(screen.getByText('隐私内容请登录后查看。')).toBeTruthy()
    expect(screen.queryByText('成田机场转机，候机三小时。')).toBeNull()
  })

  it('points 进入工作台 at the login page for a guest', () => {
    render(<MemoryRouter initialEntries={['/']}><HomePage /></MemoryRouter>)
    const link = screen.getByText('进入工作台').closest('a')
    expect(link?.getAttribute('href')).toBe('/login')
  })

  // The reported bug: this link was hardcoded to /login, so a logged-in user
  // clicking 进入工作台 was bounced to the login screen.
  it('points 进入工作台 at the workspace once logged in', () => {
    setCurrentUser('euan')
    render(<MemoryRouter initialEntries={['/']}><HomePage /></MemoryRouter>)
    const link = screen.getByText('进入工作台').closest('a')
    expect(link?.getAttribute('href')).toBe('/app')
  })
})
