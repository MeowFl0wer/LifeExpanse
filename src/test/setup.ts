import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { clearCurrentUser } from '../auth'

afterEach(() => {
  cleanup()
  // Go through the auth module rather than clearing storage directly: the
  // session is cached in module state, so wiping storage alone would leave a
  // stale user visible to the next test.
  clearCurrentUser()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
