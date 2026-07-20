import { describe, it, expect, beforeEach } from 'vitest'
import { saveDraft, loadDraft, clearDraft, clearDraftsFor, listDrafts, editKey, createKey } from './drafts'

const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  window.localStorage.clear()
})

describe('draft keys', () => {
  it('separates editing from creating', () => {
    expect(editKey('euan', 'c-1')).toBe('euan:edit:c-1')
    expect(createKey('euan', 'note')).toBe('euan:new:note')
    expect(editKey('euan', 'c-1')).not.toBe(createKey('euan', 'c-1'))
  })

  // Two people on one browser must not inherit each other's unsaved work.
  it('scopes keys to the owner', () => {
    expect(createKey('euan', 'note')).not.toBe(createKey('alice', 'note'))
    expect(editKey('euan', 'c-1')).not.toBe(editKey('alice', 'c-1'))
  })
})

describe('save and load', () => {
  it('round-trips a draft', async () => {
    await saveDraft('new:note', { title: '写了一半', body: '正文' })
    const draft = await loadDraft<{ title: string; body: string }>('new:note')

    expect(draft?.data.title).toBe('写了一半')
    expect(draft?.data.body).toBe('正文')
  })

  it('returns null when nothing is stored', async () => {
    expect(await loadDraft('new:note')).toBeNull()
  })

  it('records when it was saved', async () => {
    const before = Date.now()
    await saveDraft('new:note', { title: 'x' })
    const draft = await loadDraft('new:note')
    expect(new Date(draft!.savedAt).getTime()).toBeGreaterThanOrEqual(before)
  })

  it('keeps the base version for conflict detection', async () => {
    await saveDraft('edit:c-1', { title: 'x' }, '2024-11-01T00:00:00Z')
    const draft = await loadDraft('edit:c-1')
    expect(draft?.baseUpdatedAt).toBe('2024-11-01T00:00:00Z')
  })

  it('overwrites the previous draft for the same key', async () => {
    await saveDraft('new:note', { title: '第一版' })
    await saveDraft('new:note', { title: '第二版' })
    const draft = await loadDraft<{ title: string }>('new:note')
    expect(draft?.data.title).toBe('第二版')
  })

  it('keeps drafts for different keys apart', async () => {
    await saveDraft('new:note', { title: '笔记' })
    await saveDraft('new:diary', { title: '日记' })

    expect((await loadDraft<{ title: string }>('new:note'))?.data.title).toBe('笔记')
    expect((await loadDraft<{ title: string }>('new:diary'))?.data.title).toBe('日记')
  })
})

describe('clear', () => {
  it('removes a draft', async () => {
    await saveDraft('new:note', { title: 'x' })
    await clearDraft('new:note')
    expect(await loadDraft('new:note')).toBeNull()
  })

  it('is safe to call when nothing is stored', async () => {
    await expect(clearDraft('new:note')).resolves.toBeUndefined()
  })
})

describe('resilience', () => {
  it('discards a draft that is too old', async () => {
    const stale = {
      key: 'new:note',
      savedAt: new Date(Date.now() - 30 * DAY).toISOString(),
      data: { title: '很久以前' },
    }
    window.localStorage.setItem('life_draft:new:note', JSON.stringify(stale))

    expect(await loadDraft('new:note')).toBeNull()
    // and it is cleaned up rather than being re-read every time
    expect(window.localStorage.getItem('life_draft:new:note')).toBeNull()
  })

  it('discards unparseable data instead of throwing', async () => {
    window.localStorage.setItem('life_draft:new:note', 'not json')
    expect(await loadDraft('new:note')).toBeNull()
  })

  it('discards an entry with no timestamp', async () => {
    window.localStorage.setItem('life_draft:new:note', JSON.stringify({ data: { title: 'x' } }))
    expect(await loadDraft('new:note')).toBeNull()
  })
})

describe('clearDraftsFor', () => {
  it('removes only that user’s drafts', async () => {
    await saveDraft(createKey('euan', 'note'), { title: 'euan 的草稿' })
    await saveDraft(createKey('alice', 'note'), { title: 'alice 的草稿' })

    const removed = await clearDraftsFor('euan')

    expect(removed).toBe(1)
    expect(await loadDraft(createKey('euan', 'note'))).toBeNull()
    expect(await loadDraft(createKey('alice', 'note'))).not.toBeNull()
  })

  it('is safe when the user has none', async () => {
    expect(await clearDraftsFor('nobody')).toBe(0)
  })
})

describe('listDrafts', () => {
  it('lists drafts newest first', async () => {
    await saveDraft('new:note', { title: '旧' })
    await new Promise(r => setTimeout(r, 5))
    await saveDraft('new:diary', { title: '新' })

    const drafts = await listDrafts()
    expect(drafts.map(d => d.key)).toEqual(['new:diary', 'new:note'])
  })

  it('ignores unrelated localStorage entries', async () => {
    window.localStorage.setItem('life_session_user', 'euan')
    await saveDraft('new:note', { title: 'x' })

    const drafts = await listDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0]!.key).toBe('new:note')
  })

  it('prunes stale entries while listing', async () => {
    window.localStorage.setItem('life_draft:new:old', JSON.stringify({
      key: 'new:old',
      savedAt: new Date(Date.now() - 30 * DAY).toISOString(),
      data: {},
    }))
    await saveDraft('new:note', { title: 'x' })

    expect(await listDrafts()).toHaveLength(1)
    expect(window.localStorage.getItem('life_draft:new:old')).toBeNull()
  })

  it('returns an empty list when there are none', async () => {
    expect(await listDrafts()).toEqual([])
  })
})
