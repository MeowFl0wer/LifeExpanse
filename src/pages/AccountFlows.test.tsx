import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RegisterPage from './RegisterPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import SecuritySettings from '../components/SecuritySettings'
import { __resetAccountMock } from '../api/account'
import { RESERVED_USERNAMES } from '../lib/reserved'
import { clearCurrentUser } from '../auth'

const navigateSpy = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateSpy }
})

beforeEach(() => {
  clearCurrentUser()
  __resetAccountMock()
  navigateSpy.mockClear()
})

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes><Route path="/register" element={<RegisterPage />} /></Routes>
    </MemoryRouter>
  )
}

function renderForgot() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes><Route path="/forgot-password" element={<ForgotPasswordPage />} /></Routes>
    </MemoryRouter>
  )
}

describe('registration', () => {
  it('asks for the details first, then the code', async () => {
    const user = userEvent.setup()
    renderRegister()

    expect(screen.queryByLabelText('邮箱验证码')).toBeNull()

    await user.type(screen.getByLabelText('用户名'), 'newbie')
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'demo123456')
    await user.type(screen.getByLabelText('确认密码'), 'demo123456')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => expect(screen.getByLabelText('邮箱验证码')).toBeTruthy())
  })

  // The server answers identically for a free and a taken address; the form
  // must not undo that by guessing locally.
  it('says exactly the same thing for a free and a taken address', async () => {
    const user = userEvent.setup()

    async function noticeFor(email: string): Promise<string> {
      const view = renderRegister()
      await user.type(screen.getByLabelText('用户名'), 'newbie')
      await user.type(screen.getByLabelText('邮箱'), email)
      await user.type(screen.getByLabelText('密码'), 'demo123456')
      await user.type(screen.getByLabelText('确认密码'), 'demo123456')
      await user.click(screen.getByRole('checkbox'))
      await user.click(screen.getByRole('button', { name: '发送验证码' }))
      await waitFor(() => expect(screen.getByLabelText('邮箱验证码')).toBeTruthy())
      const text = screen.getByText(/如果该邮箱/).textContent ?? ''
      view.unmount()
      return text
    }

    // euan@example.com is already registered in the stand-in.
    expect(await noticeFor('free@example.com')).toBe(await noticeFor('euan@example.com'))
  })

  it('refuses a reserved username before any request goes out', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText('用户名'), 'admin')
    await waitFor(() => expect(screen.getByText('该用户名已被系统保留，请换一个')).toBeTruthy())
  })

  it('rejects a wrong code', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText('用户名'), 'newbie')
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'demo123456')
    await user.type(screen.getByLabelText('确认密码'), 'demo123456')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => expect(screen.getByLabelText('邮箱验证码')).toBeTruthy())
    await user.type(screen.getByLabelText('邮箱验证码'), '000000')
    await user.click(screen.getByRole('button', { name: '创建账号' }))

    await waitFor(() => expect(screen.getByText('验证码不正确或已过期')).toBeTruthy())
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('creates the account with the right code', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText('用户名'), 'newbie')
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'demo123456')
    await user.type(screen.getByLabelText('确认密码'), 'demo123456')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => expect(screen.getByLabelText('邮箱验证码')).toBeTruthy())
    await user.type(screen.getByLabelText('邮箱验证码'), '123456')
    await user.click(screen.getByRole('button', { name: '创建账号' }))

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/login?registered=1'))
  })

  it('will not submit without agreeing to the terms', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText('用户名'), 'newbie')
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'demo123456')
    await user.type(screen.getByLabelText('确认密码'), 'demo123456')
    await user.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => expect(screen.getByText('请同意用户协议和隐私政策')).toBeTruthy())
  })
})

describe('forgot password', () => {
  // Stopping here with "no such account" would make this page an oracle.
  it('advances identically for a known and an unknown address', async () => {
    const user = userEvent.setup()

    async function noticeFor(email: string): Promise<string> {
      const view = renderForgot()
      await user.type(screen.getByLabelText('邮箱'), email)
      await user.click(screen.getByRole('button', { name: '发送验证码' }))
      await waitFor(() => expect(screen.getByLabelText('邮箱验证码')).toBeTruthy())
      const text = screen.getByText(/如果该邮箱/).textContent ?? ''
      view.unmount()
      return text
    }

    expect(await noticeFor('euan@example.com')).toBe(await noticeFor('nobody@example.com'))
  })

  it('resets the password with a valid code', async () => {
    const user = userEvent.setup()
    renderForgot()

    await user.type(screen.getByLabelText('邮箱'), 'euan@example.com')
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => expect(screen.getByLabelText('邮箱验证码')).toBeTruthy())

    await user.type(screen.getByLabelText('邮箱验证码'), '123456')
    await user.type(screen.getByLabelText('新密码'), 'brandnew12345')
    await user.type(screen.getByLabelText('确认新密码'), 'brandnew12345')
    await user.click(screen.getByRole('button', { name: '重置密码' }))

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/login?reset=1'))
  })

  it('refuses mismatched passwords', async () => {
    const user = userEvent.setup()
    renderForgot()

    await user.type(screen.getByLabelText('邮箱'), 'euan@example.com')
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => expect(screen.getByLabelText('邮箱验证码')).toBeTruthy())

    await user.type(screen.getByLabelText('邮箱验证码'), '123456')
    await user.type(screen.getByLabelText('新密码'), 'brandnew12345')
    await user.type(screen.getByLabelText('确认新密码'), 'somethingelse')
    await user.click(screen.getByRole('button', { name: '重置密码' }))

    await waitFor(() => expect(screen.getByText('两次密码不一致')).toBeTruthy())
    expect(navigateSpy).not.toHaveBeenCalled()
  })
})

describe('security settings', () => {
  function renderSecurity() {
    return render(<MemoryRouter><SecuritySettings /></MemoryRouter>)
  }

  /** Labels like 「当前密码」 repeat across sections, so queries are scoped. */
  function section(heading: string) {
    return within(screen.getByRole('heading', { name: heading }).closest('section')!)
  }

  it('will not change a password on the current one alone', async () => {
    const user = userEvent.setup()
    renderSecurity()
    await waitFor(() => expect(screen.getByText('未开启')).toBeTruthy())

    const pw = section('修改密码')
    await user.type(pw.getByLabelText('当前密码'), 'demo123456')
    await user.type(pw.getByLabelText('新密码'), 'brandnew12345')
    await user.type(pw.getByLabelText('确认新密码'), 'brandnew12345')
    await user.click(pw.getByRole('button', { name: '修改密码' }))

    await waitFor(() => expect(pw.getByText('需要邮箱验证码或两步验证码')).toBeTruthy())
  })

  it('changes the password with an emailed code', async () => {
    const user = userEvent.setup()
    renderSecurity()
    await waitFor(() => expect(screen.getByText('未开启')).toBeTruthy())

    const pw = section('修改密码')
    await user.type(pw.getByLabelText('当前密码'), 'demo123456')
    await user.type(pw.getByLabelText('新密码'), 'brandnew12345')
    await user.type(pw.getByLabelText('确认新密码'), 'brandnew12345')
    await user.click(pw.getByRole('button', { name: '发送到主邮箱' }))
    await user.type(pw.getByLabelText('邮箱验证码'), '123456')
    await user.click(pw.getByRole('button', { name: '修改密码' }))

    await waitFor(() => expect(pw.getByText('密码已修改')).toBeTruthy())
  })

  it('shows recovery codes exactly once when enabling 2FA', async () => {
    const user = userEvent.setup()
    renderSecurity()
    await waitFor(() => expect(screen.getByText('未开启')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: '开启两步验证' }))
    await waitFor(() => expect(screen.getByLabelText('输入验证器显示的 6 位数字')).toBeTruthy())

    await user.type(screen.getByLabelText('输入验证器显示的 6 位数字'), '123456')
    await user.click(screen.getByRole('button', { name: '开启两步验证' }))

    await waitFor(() => expect(screen.getByText('恢复码')).toBeTruthy())
    expect(screen.getByText('ABCDE-00000')).toBeTruthy()

    // Dismissed and gone — nothing can bring them back.
    await user.click(screen.getByRole('button', { name: '我已保存' }))
    expect(screen.queryByText('ABCDE-00000')).toBeNull()
  })

  it('does not enable 2FA until a code is verified', async () => {
    const user = userEvent.setup()
    renderSecurity()
    await waitFor(() => expect(screen.getByText('未开启')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: '开启两步验证' }))
    await waitFor(() => expect(screen.getByLabelText('输入验证器显示的 6 位数字')).toBeTruthy())

    // Setup alone must not flip the switch — a mis-scanned code would lock
    // the user out of their own account the moment they signed out.
    const tf = section('两步验证')
    expect(tf.queryByText('已开启')).toBeNull()
    expect(tf.queryByText(/剩余恢复码/)).toBeNull()
  })
})

describe('reserved username list', () => {
  // The server is the authority; this copy exists so the form can answer
  // before a round trip. If they drift, the form promises something the
  // server will refuse.
  it('covers the routes the app actually serves', () => {
    for (const name of ['me', 'admin', 'about', 'login', 'register', 'trash', 'search', 'pkm']) {
      expect(RESERVED_USERNAMES.has(name)).toBe(true)
    }
  })
})
