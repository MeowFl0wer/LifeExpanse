import { describe, it, expect, beforeEach } from 'vitest'
import { getCurrentUser, setCurrentUser, clearCurrentUser, isLoggedIn, isAdmin, isOwnerOf } from './auth'

describe('session store', () => {
  beforeEach(() => {
    clearCurrentUser()
  })

  it('starts logged out', () => {
    expect(getCurrentUser()).toBeNull()
    expect(isLoggedIn()).toBe(false)
  })

  it('remembers the user after login', () => {
    setCurrentUser('euan')
    expect(getCurrentUser()).toBe('euan')
    expect(isLoggedIn()).toBe(true)
  })

  // Default is a tab-scoped session; only "保持登录" survives a browser restart.
  it('keeps an unremembered session in sessionStorage only', () => {
    setCurrentUser('euan')
    expect(window.sessionStorage.getItem('life_session_user')).toBe('euan')
    expect(window.localStorage.getItem('life_session_user')).toBeNull()
  })

  it('persists a remembered session to localStorage', () => {
    setCurrentUser('euan', { remember: true })
    expect(window.localStorage.getItem('life_session_user')).toBe('euan')
    expect(window.sessionStorage.getItem('life_session_user')).toBeNull()
  })

  it('switching to a remembered session does not leave a stale copy behind', () => {
    setCurrentUser('euan')
    setCurrentUser('euan', { remember: true })
    expect(window.sessionStorage.getItem('life_session_user')).toBeNull()
    expect(window.localStorage.getItem('life_session_user')).toBe('euan')
  })

  it('clears on logout', () => {
    setCurrentUser('euan')
    clearCurrentUser()
    expect(getCurrentUser()).toBeNull()
    expect(isLoggedIn()).toBe(false)
  })

  it('treats the site owner as admin and nobody else', () => {
    setCurrentUser('euan')
    expect(isAdmin()).toBe(true)
    setCurrentUser('alice')
    expect(isAdmin()).toBe(false)
  })

  it('scopes ownership to the matching username', () => {
    setCurrentUser('euan')
    expect(isOwnerOf('euan')).toBe(true)
    expect(isOwnerOf('alice')).toBe(false)
    expect(isOwnerOf(undefined)).toBe(false)
  })

  it('is not an owner of anything while logged out', () => {
    expect(isOwnerOf('euan')).toBe(false)
  })
})
