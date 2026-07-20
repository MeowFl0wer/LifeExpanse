import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The HTTP branch of the data layer.
 *
 * Every other test in this project runs against the in-memory branch, because
 * `VITE_API_BASE` is unset. That left the backend branch entirely uncovered —
 * and it is where a whole class of bug lives, since the two branches have to
 * agree on a contract that nothing checks.
 *
 * The bug this file was written for: `listAllVisible` passed the *viewer* as
 * the `author` query parameter. The server requires an author and 404s on an
 * empty one, so a guest's search came back empty and the public content count
 * on the About page fell back to zero. Every test was green throughout.
 */

const requestMock = vi.fn()

vi.mock('./http', () => ({
  API_BASE: '/api/v1',
  usingBackend: () => true,
  request: (...args: unknown[]) => requestMock(...args),
}))

beforeEach(() => {
  requestMock.mockReset()
  requestMock.mockResolvedValue([])
})

/** The query object the data layer sent on its Nth call. */
function queryOf(call: number): Record<string, unknown> {
  return (requestMock.mock.calls[call]?.[1] as { query: Record<string, unknown> }).query
}

describe('listAllVisible sends an author the server can resolve', () => {
  it('sends the author, not the viewer', async () => {
    const { listAllVisible } = await import('./pkm')
    await listAllVisible('euan', 'alice')

    // One request per content type.
    expect(requestMock).toHaveBeenCalledTimes(3)
    for (let i = 0; i < 3; i += 1) {
      expect(queryOf(i).author).toBe('euan')
    }
  })

  // The reported failure: a guest produced `author=''`, which the server
  // answers with 404 「用户不存在」.
  it('never sends an empty author for a guest', async () => {
    const { listAllVisible } = await import('./pkm')
    await listAllVisible('euan', null)

    for (let i = 0; i < 3; i += 1) {
      expect(queryOf(i).author).toBe('euan')
      expect(queryOf(i).author).not.toBe('')
    }
  })

  it('asks for all three content types', async () => {
    const { listAllVisible } = await import('./pkm')
    await listAllVisible('euan', 'euan')

    const types = [0, 1, 2].map(i => queryOf(i).type)
    expect(new Set(types)).toEqual(new Set(['thought', 'diary', 'pkm']))
  })

  it('leaves archived content out', async () => {
    const { listAllVisible } = await import('./pkm')
    await listAllVisible('euan', 'euan')

    expect(queryOf(0).include_archived).toBe(false)
  })
})

describe('countPublic asks as a visitor would', () => {
  it('sends the author it was given', async () => {
    const { countPublic } = await import('./pkm')
    await countPublic('euan')

    for (let i = 0; i < 3; i += 1) {
      expect(queryOf(i).author).toBe('euan')
    }
  })
})

describe('recentVisible scopes to the author', () => {
  it('sends the author, not the viewer', async () => {
    const { recentVisible } = await import('./pkm')
    await recentVisible(5, 'euan', 'alice')

    for (let i = 0; i < 3; i += 1) {
      expect(queryOf(i).author).toBe('euan')
    }
  })
})

describe('single-type reads keep their contract', () => {
  it('listPkm defaults to the pkm type', async () => {
    const { listPkm } = await import('./pkm')
    await listPkm({ author: 'euan', viewer: null })

    expect(queryOf(0).author).toBe('euan')
    expect(queryOf(0).type).toBe('pkm')
  })

  it('listPkm passes a requested type through', async () => {
    const { listPkm } = await import('./pkm')
    await listPkm({ author: 'euan', viewer: null, type: 'diary' })

    expect(queryOf(0).type).toBe('diary')
  })
})

describe('slug lookup addresses the right route', () => {
  it('includes the type in the path so sections cannot cross', async () => {
    requestMock.mockResolvedValue({
      id: 'c1', slug: 's', type: 'diary', content_kind: null, thought_type: null,
      title: 't', body: '', summary: '', visibility: 'public', author: 'euan',
      tags: [], folder_ids: [], series_ids: [], category: null, cover: null,
      seo_title: null, seo_description: null, allow_comments: false,
      favorite: false, archived: false, source_author: null, source_title: null,
      source_type: null, source_url: null, source_locator: null,
      created_at: '', updated_at: '', published_at: null,
    })
    const { getPkmBySlug } = await import('./pkm')
    await getPkmBySlug({ author: 'euan', slug: 'my-entry', viewer: null, type: 'diary' })

    expect(requestMock.mock.calls[0]![0]).toBe('/content/euan/diary/my-entry')
  })
})
