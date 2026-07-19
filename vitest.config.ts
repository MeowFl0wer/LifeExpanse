import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Kept separate from vite.config.ts: that config carries the Figma Make
// plugins, which are irrelevant to (and slow down) the test run. JSX is
// transformed by esbuild using the `jsx: react-jsx` setting in tsconfig.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
  },
})
