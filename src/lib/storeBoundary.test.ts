import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Pages must not read or write the content store directly.
 *
 * Permission filtering and the ownership rule live in `src/api/`. Every time a
 * page has been allowed to touch the store, it has eventually forgotten one of
 * them — private content reachable by slug, deleted content still on the
 * homepage, folders leaking their names to guests, a thought written to the
 * server and then read back from memory.
 *
 * The primary guard is the compiler: `src/mockData.ts` no longer re-exports
 * anything content-related, so reaching for `allContent` from a page fails to
 * build. This test guards the guard — it fails if somebody widens the façade
 * again, which the compiler would then happily accept.
 */

const CONTENT_SYMBOLS = [
  'allContent',
  'addContentItem',
  'updateContentItem',
  'deleteContentItem',
  'getContentBySlug',
  'getContentByTypeAndUser',
  'contentOfType',
  'recentContent',
  'countOfType',
  'makeUniqueSlug',
  'trashedItems',
  'getTrash',
  'restoreContentItem',
  'purgeContentItem',
  'emptyTrash',
  'purgeExpiredTrash',
]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('the content store is reachable only from the data layer', () => {
  it('the façade re-exports nothing content-related', () => {
    const facade = readFileSync('src/mockData.ts', 'utf8')
    const leaked = CONTENT_SYMBOLS.filter(name =>
      new RegExp(`(^|[\\s,{])${name}([\\s,}]|$)`, 'm').test(facade)
    )
    expect(leaked, `mockData.ts must not re-export: ${leaked.join(', ')}`).toEqual([])
  })

  it('no page or component imports the store', () => {
    const offenders = [...sourceFiles('src/pages'), ...sourceFiles('src/components')]
      .filter(file => /from ['"][^'"]*api\/store['"]/.test(readFileSync(file, 'utf8')))
    expect(offenders, `these must go through src/api: ${offenders.join(', ')}`).toEqual([])
  })

  it('only the data layer and the façade import the store', () => {
    // The façade is the one file outside `src/api/` allowed to touch it, and
    // the first test above is what keeps it to the safe subset.
    const ALLOWED_OUTSIDE_API = ['src/mockData.ts']

    const importers = sourceFiles('src')
      .filter(file => /from ['"][^'"]*\/store['"]|from ['"]\.\/store['"]/.test(readFileSync(file, 'utf8')))
      .filter(file => !ALLOWED_OUTSIDE_API.includes(file))

    for (const file of importers) {
      expect(file.startsWith('src/api/'), `${file} may not import the store`).toBe(true)
    }
  })
})
