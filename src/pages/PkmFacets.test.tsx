import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentListPage from './ContentListPage'
import { setCurrentUser, clearCurrentUser } from '../auth'

function renderPkm(entry = '/euan/pkm') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/:username/:sectionPath" element={<ContentListPage section="pkm" />} />
      </Routes>
    </MemoryRouter>
  )
}

// Seed library: series 工程笔记(sr2) contains folders 前端 / React(fd1) and
// 系统 / Linux(fd2). Inbox(fd3) is in no series. Series LifeExpanse 构建札记(sr1)
// holds one article directly.
describe('folders view', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('lists folders as cards rather than dumping the notes', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))

    expect(screen.getByText('前端 / React')).toBeTruthy()
    expect(screen.getByText('系统 / Linux')).toBeTruthy()
    // Notes are inside the folders, not listed at this level.
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
  })

  it('opens a folder and shows only its notes', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.click(screen.getByRole('button', { name: /前端 \/ React/ }))

    expect(screen.getByText('React 中的并发模式：一些实践记录')).toBeTruthy()
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
  })

  it('shows which series the open folder belongs to', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.click(screen.getByRole('button', { name: /前端 \/ React/ }))

    expect(screen.getByText(/属于系列「工程笔记」/)).toBeTruthy()
  })

  it('can go back to the folder list', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.click(screen.getByRole('button', { name: /前端 \/ React/ }))
    await user.click(screen.getByRole('button', { name: '← 返回文件夹' }))

    expect(screen.getByText('系统 / Linux')).toBeTruthy()
  })

  it('offers folder creation to the owner only', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    expect(screen.getByRole('button', { name: '+ 新建文件夹' })).toBeTruthy()

    clearCurrentUser()
    renderPkm()
    const tabs = screen.getAllByRole('button', { name: 'Folders' })
    await user.click(tabs[tabs.length - 1]!)
    expect(screen.queryByRole('button', { name: '+ 新建文件夹' })).toBeNull()
  })

  it('exposes a settings action inside a folder', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.click(screen.getByRole('button', { name: /前端 \/ React/ }))

    expect(screen.getByRole('button', { name: '设置' })).toBeTruthy()
  })
})

describe('series view', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('lists series as cards', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Series' }))

    expect(screen.getByText('工程笔记')).toBeTruthy()
    expect(screen.getByText('LifeExpanse 构建札记')).toBeTruthy()
  })

  // Rule 2.8: a note inside a folder shows up under that folder within the
  // series, never loose alongside it.
  it('shows a series as folders plus only its loose notes', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Series' }))
    await user.click(screen.getByRole('button', { name: /工程笔记/ }))

    // Its two folders appear...
    expect(screen.getByText('前端 / React')).toBeTruthy()
    expect(screen.getByText('系统 / Linux')).toBeTruthy()
    // ...but their notes are not loose in the series.
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
    expect(screen.getByText(/没有直接归入本系列的内容/)).toBeTruthy()
  })

  it('shows notes filed directly into a series', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Series' }))
    await user.click(screen.getByRole('button', { name: /LifeExpanse 构建札记/ }))

    expect(screen.getByText('为什么我要自己做一个记录平台')).toBeTruthy()
  })

  it('can drill from a series into one of its folders', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Series' }))
    await user.click(screen.getByRole('button', { name: /工程笔记/ }))
    await user.click(screen.getByRole('button', { name: /系统 \/ Linux/ }))

    expect(screen.getByText('SSH Config 常用配置备忘')).toBeTruthy()
  })

  it('offers series creation to the owner', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Series' }))
    expect(screen.getByRole('button', { name: '+ 新建系列' })).toBeTruthy()
  })
})

describe('tag filter strip', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('replaces the old Tags tab', () => {
    renderPkm()
    expect(screen.queryByRole('button', { name: 'Tags' })).toBeNull()
    expect(screen.getByRole('button', { name: /选择标签/ })).toBeTruthy()
  })

  it('stays collapsed until opened', async () => {
    const user = userEvent.setup()
    renderPkm()
    expect(screen.queryByRole('button', { name: /#React/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: /选择标签/ }))
    expect(screen.getByRole('button', { name: /#React/ })).toBeTruthy()
  })

  it('filters on selection and relabels the toggle', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: /选择标签/ }))
    await user.click(screen.getByRole('button', { name: /#React/ }))

    expect(screen.getByText('React 中的并发模式：一些实践记录')).toBeTruthy()
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
    expect(screen.getByRole('button', { name: /已筛选标签/ })).toBeTruthy()
  })

  it('supports selecting several tags at once', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: /选择标签/ }))
    await user.click(screen.getByRole('button', { name: /#React/ }))
    await user.click(screen.getByRole('button', { name: /#Linux/ }))

    expect(screen.getByText('React 中的并发模式：一些实践记录')).toBeTruthy()
    expect(screen.getByText('SSH Config 常用配置备忘')).toBeTruthy()
  })

  it('clears everything through 全部', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: /选择标签/ }))
    await user.click(screen.getByRole('button', { name: /#React/ }))
    await user.click(screen.getByRole('button', { name: '全部标签' }))

    expect(screen.getByText('SSH Config 常用配置备忘')).toBeTruthy()
    expect(screen.getByRole('button', { name: /选择标签/ })).toBeTruthy()
  })
})

describe('visibility filter chips', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('renders one flat chip per state, not a badge inside a button', () => {
    renderPkm()
    const publicChip = screen.getByRole('button', { name: '公开' })
    expect(publicChip.querySelector('span')).toBeNull()
    expect(publicChip.textContent).toBe('公开')
  })

  it('filters by visibility', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: '草稿' }))

    expect(screen.getByText('待整理的想法（草稿）')).toBeTruthy()
    expect(screen.queryByText('SSH Config 常用配置备忘')).toBeNull()
  })
})

describe('library metadata is not leaked to guests', () => {
  beforeEach(() => clearCurrentUser())

  // Inbox holds only a draft, so its very name and description would disclose
  // the shape of a private library.
  it('hides a folder whose contents are all private', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))

    expect(screen.queryByText('Inbox')).toBeNull()
    expect(screen.queryByText('还没成形的东西。')).toBeNull()
  })

  it('still shows folders that hold public content', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))

    expect(screen.getByText('前端 / React')).toBeTruthy()
  })

  // The index hid Inbox, but the drill-in used to resolve straight from the
  // store, so a hand-typed id still rendered its name and description.
  it('does not open a private folder from a hand-typed query string', () => {
    renderPkm('/euan/pkm?folder=fd3')

    expect(screen.queryByText('Inbox')).toBeNull()
    expect(screen.queryByText('还没归类的东西。')).toBeNull()
  })

  it('opens a series that holds public content', async () => {
    renderPkm('/euan/pkm?series=sr1')
    await waitFor(() => expect(screen.getByText('LifeExpanse 构建札记')).toBeTruthy())
    expect(screen.getByText('为什么我要自己做一个记录平台')).toBeTruthy()
  })

  it('a drill-in URL restores the library view rather than the All tab', async () => {
    setCurrentUser('euan')
    renderPkm('/euan/pkm?folder=fd3')
    // Opens the folder itself, not the flat list.
    await waitFor(() => expect(screen.getByRole('button', { name: '← 返回文件夹' })).toBeTruthy())
    expect(screen.getByText('待整理的想法（草稿）')).toBeTruthy()
  })

  it('still opens a folder that holds public content', async () => {
    renderPkm('/euan/pkm?folder=fd1')
    await waitFor(() => expect(screen.getAllByText('前端 / React').length).toBeGreaterThan(0))
  })

  it('shows the private folder to its owner', async () => {
    const user = userEvent.setup()
    setCurrentUser('euan')
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))

    expect(screen.getByText('Inbox')).toBeTruthy()
  })
})

describe('new content entry', () => {
  beforeEach(() => clearCurrentUser())

  it('offers a 新建 button', () => {
    renderPkm()
    expect(screen.getByRole('button', { name: '+ 新建' })).toBeTruthy()
  })
})

// The keyword box used to go dead as soon as you opened Folders or Series.
describe('searching the folder and series indexes', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('filters folders by name', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.type(screen.getByPlaceholderText('搜索文件夹...'), '前端')

    await waitFor(() => expect(screen.queryByText('系统 / Linux')).toBeNull())
    expect(screen.getByText('前端 / React')).toBeTruthy()
  })

  it('filters series by name', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Series' }))
    await user.type(screen.getByPlaceholderText('搜索系列...'), '工程')

    await waitFor(() => expect(screen.queryByText('LifeExpanse 构建札记')).toBeNull())
    expect(screen.getByText('工程笔记')).toBeTruthy()
  })

  it('says so when nothing matches, instead of looking empty', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.type(screen.getByPlaceholderText('搜索文件夹...'), '不存在的东西')

    await waitFor(() => expect(screen.getByText(/没有名称或简介匹配/)).toBeTruthy())
  })

  it('keeps note search working inside an open folder', async () => {
    const user = userEvent.setup()
    renderPkm()
    await user.click(screen.getByRole('button', { name: 'Folders' }))
    await user.click(screen.getByRole('button', { name: /前端 \/ React/ }))
    await user.type(screen.getByPlaceholderText('关键词搜索...'), '并发')

    await waitFor(() =>
      expect(screen.getByText('React 中的并发模式：一些实践记录')).toBeTruthy()
    )
  })
})

// 「选择标签」used to sit on its own row below the filters.
describe('filter toolbar order', () => {
  beforeEach(() => {
    clearCurrentUser()
    setCurrentUser('euan')
  })

  it('places the tag toggle between the 草稿 pill and the search box', async () => {
    renderPkm()
    await waitFor(() => expect(screen.getByRole('button', { name: '草稿' })).toBeTruthy())

    const draft = screen.getByRole('button', { name: '草稿' })
    const tags = screen.getByRole('button', { name: '选择标签' })
    const search = screen.getByPlaceholderText('关键词搜索...')

    // DOCUMENT_POSITION_FOLLOWING === 4: the argument comes after the subject.
    expect(draft.compareDocumentPosition(tags) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tags.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps all three on one row', async () => {
    renderPkm()
    await waitFor(() => expect(screen.getByRole('button', { name: '草稿' })).toBeTruthy())

    const row = screen.getByRole('button', { name: '选择标签' }).parentElement!
    expect(row.contains(screen.getByRole('button', { name: '草稿' }))).toBe(true)
    expect(row.contains(screen.getByPlaceholderText('关键词搜索...'))).toBe(true)
  })
})
