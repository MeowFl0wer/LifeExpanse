import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  // The session store is module state backed by localStorage; clearing between
  // tests keeps a login in one test from leaking into the next.
  window.localStorage.clear()
  window.sessionStorage.clear()
})
