import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MediaInsertMenu from './MediaInsertMenu'
import { formatBytes } from '../api/media'

const uploadMock = vi.fn()
const quotaMock = vi.fn()

vi.mock('../api/media', async () => {
  const actual = await vi.importActual<typeof import('../api/media')>('../api/media')
  return {
    ...actual,
    uploadMedia: (...args: unknown[]) => uploadMock(...args),
    fetchQuota: () => quotaMock(),
  }
})

const FULL_QUOTA = {
  usedBytes: 0, quotaBytes: 1024 ** 3, images: 0, videos: 0,
  canUploadImage: true, canUploadVideo: true,
  maxImageBytes: 10 * 1024 * 1024, maxVideoBytes: 200 * 1024 * 1024,
}

beforeEach(() => {
  uploadMock.mockReset()
  quotaMock.mockReset()
  quotaMock.mockResolvedValue(FULL_QUOTA)
})

function pngFile(name = 'photo.png', size = 1024) {
  return new File([new Uint8Array(size)], name, { type: 'image/png' })
}

describe('inserting an uploaded image', () => {
  it('uploads and inserts the returned URL, not a blob URL', async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    uploadMock.mockResolvedValue({
      id: 'm1', url: '/api/v1/media/m1', kind: 'image', mime: 'image/png',
      sizeBytes: 1024, visibility: 'private', originalName: 'photo.png',
    })

    render(<MediaInsertMenu onInsert={onInsert} />)
    await user.click(screen.getByRole('button', { name: /插入媒体/ }))
    await waitFor(() => expect(screen.getByText(/点击选择图片/)).toBeTruthy())

    const input = document.querySelector('input[type=file]') as HTMLInputElement
    await user.upload(input, pngFile())

    // A blob: URL dies with the page — that is exactly what this replaced.
    await waitFor(() => expect(onInsert).toHaveBeenCalledWith('![photo.png](/api/v1/media/m1)'))
  })

  it('passes the requested visibility through to the upload', async () => {
    const user = userEvent.setup()
    uploadMock.mockResolvedValue({
      id: 'm1', url: '/api/v1/media/m1', kind: 'image', mime: 'image/png',
      sizeBytes: 1024, visibility: 'public', originalName: 'photo.png',
    })

    render(<MediaInsertMenu onInsert={vi.fn()} visibility="public" />)
    await user.click(screen.getByRole('button', { name: /插入媒体/ }))
    await waitFor(() => expect(screen.getByText(/点击选择图片/)).toBeTruthy())

    const input = document.querySelector('input[type=file]') as HTMLInputElement
    await user.upload(input, pngFile())

    await waitFor(() =>
      expect(uploadMock).toHaveBeenCalledWith(expect.anything(), { visibility: 'public' }))
  })

  it('shows the server message when the upload is refused', async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    uploadMock.mockRejectedValue(new Error('你的账号未开通图片上传权限'))

    render(<MediaInsertMenu onInsert={onInsert} />)
    await user.click(screen.getByRole('button', { name: /插入媒体/ }))
    await waitFor(() => expect(screen.getByText(/点击选择图片/)).toBeTruthy())

    const input = document.querySelector('input[type=file]') as HTMLInputElement
    await user.upload(input, pngFile())

    await waitFor(() => expect(screen.getByText('你的账号未开通图片上传权限')).toBeTruthy())
    expect(onInsert).not.toHaveBeenCalled()
  })

  // Better to say so before the file dialog than after the server refuses.
  it('says so up front when image upload is not permitted', async () => {
    const user = userEvent.setup()
    quotaMock.mockResolvedValue({ ...FULL_QUOTA, canUploadImage: false })

    render(<MediaInsertMenu onInsert={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /插入媒体/ }))

    await waitFor(() => expect(screen.getByText(/未开通图片上传权限/)).toBeTruthy())
    expect(screen.queryByText(/点击选择图片/)).toBeNull()
  })

  it('says so up front when video upload is not permitted', async () => {
    const user = userEvent.setup()
    quotaMock.mockResolvedValue({ ...FULL_QUOTA, canUploadVideo: false })

    render(<MediaInsertMenu onInsert={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /插入媒体/ }))
    await user.click(screen.getByRole('button', { name: '🎬' }))

    await waitFor(() => expect(screen.getByText(/未开通视频上传权限/)).toBeTruthy())
  })

  it('refuses a file bigger than the limit without contacting the server', async () => {
    const user = userEvent.setup()
    quotaMock.mockResolvedValue({ ...FULL_QUOTA, maxImageBytes: 512 })

    render(<MediaInsertMenu onInsert={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /插入媒体/ }))
    await waitFor(() => expect(screen.getByText(/点击选择图片/)).toBeTruthy())

    const input = document.querySelector('input[type=file]') as HTMLInputElement
    await user.upload(input, pngFile('big.png', 2048))

    await waitFor(() => expect(screen.getByText(/图片不能超过/)).toBeTruthy())
    expect(uploadMock).not.toHaveBeenCalled()
  })
})

describe('formatBytes', () => {
  it('scales the unit to the size', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB')
  })
})
