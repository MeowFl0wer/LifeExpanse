import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentCreatePage from './ContentCreatePage'
import ContentEditPage from './ContentEditPage'
import { setCurrentUser, clearCurrentUser } from '../auth'
import { loadDraft, createKey, editKey } from '../api/drafts'
import { createPkm } from '../api/pkm'
import { allContent, trashedItems } from '../mockData'

const made: string[] = []

beforeEach(() => {
  clearCurrentUser()
  setCurrentUser('euan')
  window.localStorage.clear()
})

afterEach(() => {
  for (const id of made.splice(0)) {
    const i = allContent.findIndex(c => c.id === id)
    if (i >= 0) allContent.splice(i, 1)
    const t = trashedItems.findIndex(x => x.item.id === id)
    if (t >= 0) trashedItems.splice(t, 1)
  }
  vi.restoreAllMocks()
})

function renderCreate(type = 'note') {
  return render(
    <MemoryRouter initialEntries={[`/new/${type}`]}>
      <Routes>
        <Route path="/new/:type" element={<ContentCreatePage />} />
      </Routes>
    </MemoryRouter>
  )
}

async function renderEdit(slug: string) {
  const view = render(
    <MemoryRouter initialEntries={[`/euan/pkm/${slug}/edit`]}>
      <Routes>
        <Route path="/:username/pkm/:slug/edit" element={<ContentEditPage section="pkm" />} />
      </Routes>
    </MemoryRouter>
  )
  // The item is fetched, so the form is not on screen for the first frame.
  await waitFor(() => expect(screen.getByLabelText('正文')).toBeTruthy())
  return view
}

async function makeNote() {
  const item = await createPkm('euan', {
    title: `笔记 ${Math.random().toString(36).slice(2, 7)}`,
    body: '原始正文',
    contentKind: 'note',
    visibility: 'public',
    tagNames: [], folderIds: [], seriesIds: [],
  })
  made.push(item.id)
  return item
}

describe('create page autosave', () => {
  it('stores what was typed', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.type(screen.getByLabelText(/标题/), '写了一半的笔记')
    await user.type(screen.getByLabelText(/正文/), '正文也写了一点')

    await waitFor(async () => {
      const draft = await loadDraft<{ title: string; body: string }>(createKey('euan', 'note'))
      expect(draft?.data.title).toBe('写了一半的笔记')
      expect(draft?.data.body).toBe('正文也写了一点')
    }, { timeout: 3000 })
  })

  // The whole point: close the tab, come back, keep writing.
  it('restores the draft on a later visit', async () => {
    const user = userEvent.setup()
    const first = renderCreate()
    await user.type(screen.getByLabelText(/标题/), '未完成的标题')
    await waitFor(async () =>
      expect((await loadDraft(createKey('euan', 'note')))).not.toBeNull(), { timeout: 3000 })
    first.unmount()

    renderCreate()

    await waitFor(() =>
      expect((screen.getByLabelText(/标题/) as HTMLInputElement).value).toBe('未完成的标题')
    )
    expect(screen.getByText('已恢复未保存的草稿')).toBeTruthy()
  })

  it('discarding clears the draft and empties the form', async () => {
    const user = userEvent.setup()
    const first = renderCreate()
    await user.type(screen.getByLabelText(/标题/), '不想要的内容')
    await waitFor(async () =>
      expect(await loadDraft(createKey('euan', 'note'))).not.toBeNull(), { timeout: 3000 })
    first.unmount()

    renderCreate()
    await waitFor(() => expect(screen.getByText('已恢复未保存的草稿')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '放弃草稿' }))

    expect((screen.getByLabelText(/标题/) as HTMLInputElement).value).toBe('')
    await waitFor(async () => expect(await loadDraft(createKey('euan', 'note'))).toBeNull())
  })

  it('keeps drafts of different types apart', async () => {
    const user = userEvent.setup()
    const note = renderCreate('note')
    await user.type(screen.getByLabelText(/标题/), '笔记草稿')
    await waitFor(async () =>
      expect(await loadDraft(createKey('euan', 'note'))).not.toBeNull(), { timeout: 3000 })
    note.unmount()

    renderCreate('diary')
    // A diary must not inherit the note's draft.
    await waitFor(() =>
      expect((screen.getByLabelText(/标题/) as HTMLInputElement).value).toBe('')
    )
  })

  it('clears the draft once the item is created', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderCreate()

    await user.type(screen.getByLabelText(/标题/), '真的要保存')
    await user.type(screen.getByLabelText(/正文/), '正文内容')
    // Ensure a draft exists first, so its removal is meaningful.
    await waitFor(async () =>
      expect(await loadDraft(createKey('euan', 'note'))).not.toBeNull(), { timeout: 3000 })

    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() =>
      expect(allContent.some(c => c.title === '真的要保存')).toBe(true), { timeout: 3000 })
    expect(await loadDraft(createKey('euan', 'note'))).toBeNull()

    const created = allContent.find(c => c.title === '真的要保存')
    if (created) made.push(created.id)
  })
})

describe('edit page autosave', () => {
  it('stores edits before they are saved', async () => {
    const user = userEvent.setup()
    const note = await makeNote()
    await renderEdit(note.slug)

    await user.clear(screen.getByLabelText('正文'))
    await user.type(screen.getByLabelText('正文'), '改到一半的正文')

    await waitFor(async () => {
      const draft = await loadDraft<{ body: string }>(editKey('euan', note.id))
      expect(draft?.data.body).toBe('改到一半的正文')
    }, { timeout: 3000 })

    // The stored content is untouched until an explicit save.
    expect(allContent.find(c => c.id === note.id)!.body).toBe('原始正文')
  })

  it('restores the unsaved edit on return', async () => {
    const user = userEvent.setup()
    const note = await makeNote()
    const first = await renderEdit(note.slug)

    await user.clear(screen.getByLabelText('正文'))
    await user.type(screen.getByLabelText('正文'), '离开前写的内容')
    await waitFor(async () =>
      expect(await loadDraft(editKey('euan', note.id))).not.toBeNull(), { timeout: 3000 })
    first.unmount()

    await renderEdit(note.slug)

    await waitFor(() =>
      expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('离开前写的内容')
    )
    expect(screen.getByText('已恢复未保存的草稿')).toBeTruthy()
  })

  it('discarding restores the stored content', async () => {
    const user = userEvent.setup()
    const note = await makeNote()
    const first = await renderEdit(note.slug)

    await user.clear(screen.getByLabelText('正文'))
    await user.type(screen.getByLabelText('正文'), '要丢掉的改动')
    await waitFor(async () =>
      expect(await loadDraft(editKey('euan', note.id))).not.toBeNull(), { timeout: 3000 })
    first.unmount()

    await renderEdit(note.slug)
    await waitFor(() => expect(screen.getByText('已恢复未保存的草稿')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '放弃草稿' }))

    expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('原始正文')
  })

  it('a different note does not pick up this one’s draft', async () => {
    const user = userEvent.setup()
    const a = await makeNote()
    const b = await makeNote()

    const first = await renderEdit(a.slug)
    await user.clear(screen.getByLabelText('正文'))
    await user.type(screen.getByLabelText('正文'), 'A 的草稿')
    await waitFor(async () =>
      expect(await loadDraft(editKey('euan', a.id))).not.toBeNull(), { timeout: 3000 })
    first.unmount()

    await renderEdit(b.slug)
    await waitFor(() =>
      expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('原始正文')
    )
  })

  it('clears the draft after a real save', async () => {
    const user = userEvent.setup()
    const note = await makeNote()
    await renderEdit(note.slug)

    await user.clear(screen.getByLabelText('正文'))
    await user.type(screen.getByLabelText('正文'), '最终内容')
    // Let the debounce write a draft, so its removal is meaningful rather than
    // trivially true.
    await waitFor(async () =>
      expect(await loadDraft(editKey('euan', note.id))).not.toBeNull(), { timeout: 3000 })

    await user.click(screen.getByRole('button', { name: '保存' }))

    // The save is what we are waiting on; the draft is cleared as part of it.
    await waitFor(() =>
      expect(allContent.find(c => c.id === note.id)!.body).toBe('最终内容'), { timeout: 3000 })
    expect(await loadDraft(editKey('euan', note.id))).toBeNull()
  })
})

/**
 * Excerpt provenance is part of the draft.
 *
 * Without it, changing only the source left the page looking unmodified: no
 * "unsaved" state, no leave warning, and nothing autosaved — so the edit was
 * silently lost on navigating away.
 */
describe('excerpt provenance is tracked as unsaved work', () => {
  async function renderThoughtEdit(slug: string) {
    const view = render(
      <MemoryRouter initialEntries={[`/euan/thoughts/${slug}/edit`]}>
        <Routes>
          <Route
            path="/:username/thoughts/:slug/edit"
            element={<ContentEditPage section="thoughts" />}
          />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByLabelText('正文')).toBeTruthy())
    return view
  }

  async function makeExcerpt() {
    return createPkm('euan', {
      type: 'thought',
      thoughtType: 'excerpt',
      title: `摘录 ${Math.random().toString(36).slice(2, 7)}`,
      body: '引用的内容',
      visibility: 'public',
      tagNames: [], folderIds: [], seriesIds: [],
      sourceAuthor: '原作者',
    })
  }

  it('autosaves a change to the source author alone', async () => {
    const user = userEvent.setup()
    const excerpt = await makeExcerpt()
    await renderThoughtEdit(excerpt.slug)

    await user.clear(screen.getByLabelText('作者或说话者'))
    await user.type(screen.getByLabelText('作者或说话者'), '改过的作者')

    await waitFor(async () => {
      const draft = await loadDraft<{ sourceAuthor: string }>(editKey('euan', excerpt.id))
      expect(draft?.data.sourceAuthor).toBe('改过的作者')
    }, { timeout: 3000 })
  })

  it('autosaves a change to the source link alone', async () => {
    const user = userEvent.setup()
    const excerpt = await makeExcerpt()
    await renderThoughtEdit(excerpt.slug)

    await user.type(screen.getByLabelText('来源链接'), 'https://example.com/x')

    await waitFor(async () => {
      const draft = await loadDraft<{ sourceUrl: string }>(editKey('euan', excerpt.id))
      expect(draft?.data.sourceUrl).toBe('https://example.com/x')
    }, { timeout: 3000 })
  })

  it('restores the source fields from a draft', async () => {
    const user = userEvent.setup()
    const excerpt = await makeExcerpt()
    const first = await renderThoughtEdit(excerpt.slug)

    await user.clear(screen.getByLabelText('作者或说话者'))
    await user.type(screen.getByLabelText('作者或说话者'), '离开前改的作者')
    await waitFor(async () =>
      expect(await loadDraft(editKey('euan', excerpt.id))).not.toBeNull(), { timeout: 3000 })
    first.unmount()

    await renderThoughtEdit(excerpt.slug)
    await waitFor(() =>
      expect((screen.getByLabelText('作者或说话者') as HTMLInputElement).value)
        .toBe('离开前改的作者'))
  })
})
