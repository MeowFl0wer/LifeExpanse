/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the backend, e.g. `/api/v1`. When empty the app runs entirely
   * on the in-memory mock store, which is what `pnpm dev` and the tests use.
   */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
