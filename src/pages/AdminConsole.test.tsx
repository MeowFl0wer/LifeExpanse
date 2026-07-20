import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from './AdminPage'
import { setCurrentUser, setCurrentRole, clearCurrentUser } from '../auth'

beforeEach(() => {
  clearCurrentUser()
  setCurrentUser('AdminEuan')
  setCurrentRole('admin')
})

function renderAdmin() {
  return render(<MemoryRouter><AdminPage /></MemoryRouter>)
}

describe('admin console', () => {
  it('opens on system status', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('在线用户')).toBeTruthy())
    expect(screen.getByText('运行时间')).toBeTruthy()
    expect(screen.getByText('系统负载')).toBeTruthy()
  })

  it('offers the three sort orders the spec asks for', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '用户' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '注册时间' })).toBeTruthy())
    expect(screen.getByRole('button', { name: '最近登录' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '登录次数' })).toBeTruthy()
  })

  it('sorts by login count', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '用户' }))
    await user.click(screen.getByRole('button', { name: '登录次数' }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: '详情' }).length).toBeGreaterThan(1))
    const names = screen.getAllByText(/^@/).map(n => n.textContent)
    expect(names[0]).toBe('@euan')  // 128 logins, the most
  })

  // The console manages accounts; it is not a reader.
  it('shows counts on the detail view, never content', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '用户' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: '详情' })[0]).toBeTruthy())
    await user.click(screen.getAllByRole('button', { name: '详情' })[0]!)

    await waitFor(() => expect(screen.getByText('数据量')).toBeTruthy())
    expect(screen.getByText('内容总数')).toBeTruthy()
    expect(screen.getByText('只统计数量。管理后台不展示用户内容的标题或正文。')).toBeTruthy()
  })

  it('never renders a full email address', async () => {
    const user = userEvent.setup()
    const view = renderAdmin()
    await user.click(screen.getByRole('button', { name: '用户' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: '详情' })[0]).toBeTruthy())

    expect(view.container.textContent).not.toMatch(/euan@example\.com/)
    expect(screen.getByText(/e\*\*\*n@example\.com/)).toBeTruthy()
  })

  it('can grant video upload from the detail view', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '用户' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: '详情' })[1]).toBeTruthy())
    await user.click(screen.getAllByRole('button', { name: '详情' })[1]!)

    await waitFor(() => expect(screen.getByLabelText('允许上传视频')).toBeTruthy())
    const box = screen.getByLabelText('允许上传视频') as HTMLInputElement
    expect(box.checked).toBe(false)

    await user.click(box)
    await waitFor(() => expect((screen.getByLabelText('允许上传视频') as HTMLInputElement).checked).toBe(true))
  })

  it('offers the three registration modes', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '注册与邀请' }))

    await waitFor(() => expect(screen.getByText('关闭注册')).toBeTruthy())
    expect(screen.getByText('邀请码注册')).toBeTruthy()
    expect(screen.getByText('公开注册')).toBeTruthy()
  })

  it('generates a single-use invite code', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '注册与邀请' }))
    await waitFor(() => expect(screen.getByText('还没有邀请码。')).toBeTruthy())

    await user.type(screen.getByLabelText(/备注/), '给朋友')
    await user.click(screen.getByRole('button', { name: '生成邀请码' }))

    await waitFor(() => expect(screen.getByText('给朋友')).toBeTruthy())
    expect(screen.getByText('未使用')).toBeTruthy()
  })

  it('shows the audit log newest first with a filter', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '审计日志' }))

    await waitFor(() => expect(screen.getByLabelText('按事件筛选')).toBeTruthy())
    // 「权限变更」 is also a filter option, so assert on the entry's detail.
    expect(screen.getByText('alice: can_upload_video=True')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('按事件筛选'), 'login')
    await waitFor(() => expect(screen.queryByText('alice: can_upload_video=True')).toBeNull())
  })

  it('lets the admin manage their own password and 2FA', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '管理员账号' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: '修改密码' })).toBeTruthy())
    expect(screen.getByRole('heading', { name: '两步验证' })).toBeTruthy()
  })

  // The prototype backup panel predates the real console; dropping it silently
  // would lose the plan for site-level backups.
  it('still has the backup panel', async () => {
    const user = userEvent.setup()
    renderAdmin()
    await user.click(screen.getByRole('button', { name: '备份与恢复' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: '系统备份' })).toBeTruthy())
    expect(screen.getByRole('heading', { name: '系统恢复' })).toBeTruthy()
  })
})

describe('header mark', () => {
  // The mark is the way home from anywhere. It used to point at /app, which
  // made it a no-op on the dashboard itself.
  it('links to the homepage from the app header', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByText('在线用户')).toBeTruthy())
    expect(screen.getByRole('link', { name: '返回主页' }).getAttribute('href')).toBe('/')
  })
})
