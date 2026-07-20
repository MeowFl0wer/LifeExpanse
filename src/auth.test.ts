import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCurrentUser, setCurrentUser, setCurrentRole, clearCurrentUser,
  isLoggedIn, isAdmin, isOwnerOf,
} from './auth'

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

  // The site owner used to count as the admin. It no longer does: the owner
  // is an ordinary account with a content space, and the admin is separate
  // (需求 3.1), so a compromised admin login does not also expose the diary.
  it('does not treat the site owner as an admin', () => {
    setCurrentUser('euan')
    expect(isAdmin()).toBe(false)
    setCurrentUser('alice')
    expect(isAdmin()).toBe(false)
  })

  it('follows the role the server reported', () => {
    setCurrentUser('AdminEuan')
    setCurrentRole('admin')
    expect(isAdmin()).toBe(true)

    // The role wins over the name, so renaming the admin account does not
    // silently break the check.
    setCurrentRole('user')
    expect(isAdmin()).toBe(false)
  })

  it('stops claiming admin once signed out', () => {
    setCurrentUser('AdminEuan')
    setCurrentRole('admin')
    clearCurrentUser()
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
