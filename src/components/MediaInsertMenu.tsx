import { useEffect, useRef, useState } from 'react'
import { fetchQuota, formatBytes, uploadMedia, type MediaQuota } from '../api/media'

interface MediaInsertMenuProps {
  onInsert: (markdown: string) => void
  /** Public content needs publicly readable media; drafts and private notes do not. */
  visibility?: 'public' | 'private'
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']

const SUPPORTED_VIDEO_PATTERNS = [
  { name: 'YouTube', re: /youtube\.com\/watch\?v=([A-Za-z0-9_-]+)|youtu\.be\/([A-Za-z0-9_-]+)/, platform: 'youtube' },
  { name: '哔哩哔哩', re: /bilibili\.com\/video\/(BV[A-Za-z0-9]+|av\d+)/, platform: 'bilibili' },
  { name: 'Google Drive', re: /drive\.google\.com\/(file\/d\/|open\?id=)([A-Za-z0-9_-]+)/, platform: 'gdrive' },
]

type Panel = 'none' | 'image' | 'video' | 'link' | 'videolink'

function validateExternalUrl(url: string): string | null {
  if (!url.startsWith('https://')) return '只允许 https:// 链接'
  try {
    new URL(url)
    return null
  } catch {
    return '请输入有效的 URL'
  }
}

export default function MediaInsertMenu({
  onInsert, visibility = 'private',
}: MediaInsertMenuProps) {
  const [panel, setPanel] = useState<Panel>('none')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [quota, setQuota] = useState<MediaQuota | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Tells the user what they may upload before they pick a file, rather than
  // after the server refuses it.
  useEffect(() => {
    let cancelled = false
    fetchQuota()
      .then(q => { if (!cancelled) setQuota(q) })
      .catch(() => { /* the server decides anyway; the hint is optional */ })
    return () => { cancelled = true }
  }, [])

  function close() {
    setPanel('none')
    setError('')
    setLinkUrl('')
    setLinkTitle('')
    setVideoUrl('')
  }

  /** Uploads and inserts. The server re-checks everything asserted here. */
  async function upload(file: File, build: (url: string, name: string) => string) {
    setUploading(true)
    setError('')
    try {
      const media = await uploadMedia(file, { visibility })
      onInsert(build(media.url, file.name))
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请稍后重试')
    } finally {
      setUploading(false)
      // Clearing lets the same file be picked again after a failure.
      if (imgInputRef.current) imgInputRef.current.value = ''
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('只允许 JPEG、PNG、WebP 或 GIF 图片')
      return
    }
    if (quota && file.size > quota.maxImageBytes) {
      setError(`图片不能超过 ${formatBytes(quota.maxImageBytes)}（当前 ${formatBytes(file.size)}）`)
      return
    }
    void upload(file, (url, name) => `![${name}](${url})`)
  }

  function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setError('只允许 MP4 或 WebM 格式的视频')
      return
    }
    if (quota && file.size > quota.maxVideoBytes) {
      setError(`视频不能超过 ${formatBytes(quota.maxVideoBytes)}（当前 ${formatBytes(file.size)}）`)
      return
    }
    void upload(file, url => `<video src="${url}" controls style="max-width:100%"></video>`)
  }

  function handleInsertLink() {
    const urlErr = validateExternalUrl(linkUrl)
    if (urlErr) { setError(urlErr); return }
    const title = linkTitle || linkUrl
    onInsert(`[${title}](${linkUrl})`)
    close()
  }

  function handleInsertVideoLink() {
    const urlErr = validateExternalUrl(videoUrl)
    if (urlErr) { setError(urlErr); return }

    const matched = SUPPORTED_VIDEO_PATTERNS.find(p => p.re.test(videoUrl))
    if (matched) {
      onInsert(`[▶ 播放视频（${matched.name}）](${videoUrl})`)
    } else {
      onInsert(`[外部视频链接](${videoUrl})`)
    }
    close()
  }

  const menuButtons = [
    { label: '上传图片', icon: '🖼', panel: 'image' as Panel },
    { label: '上传视频', icon: '🎬', panel: 'video' as Panel },
    { label: '插入外部链接', icon: '🔗', panel: 'link' as Panel },
    { label: '插入视频平台链接', icon: '▶', panel: 'videolink' as Panel },
  ]

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="life-button text-xs"
        onClick={() => setPanel(panel === 'none' ? 'image' : 'none')}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="1" y="1" width="11" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
          <path d="M1 9l3-3 2 2 2-2.5L12 9" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        插入媒体
      </button>

      {panel !== 'none' && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-[var(--radius)] border border-[color:var(--border)] bg-white shadow-sm"
        >
          {/* Tabs */}
          <div className="flex border-b border-[color:var(--border)]">
            {menuButtons.map(btn => (
              <button
                key={btn.panel}
                type="button"
                className={`flex-1 py-2 text-xs transition-colors ${
                  panel === btn.panel
                    ? 'bg-[color:var(--secondary)] text-[color:var(--foreground)] font-medium'
                    : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
                }`}
                onClick={() => { setPanel(btn.panel); setError('') }}
              >
                {btn.icon}
              </button>
            ))}
          </div>

          <div className="p-4">
            <p className="text-xs font-medium text-[color:var(--foreground)] mb-3">
              {menuButtons.find(b => b.panel === panel)?.label}
            </p>

            {error && (
              <div className="mb-3 rounded-[var(--radius)] border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                {error}
              </div>
            )}

            {panel === 'image' && (
              <>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageFile}
                />
                {quota && !quota.canUploadImage ? (
                  <p className="rounded-[var(--radius)] bg-[color:var(--secondary)] p-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    你的账号未开通图片上传权限。请联系管理员开通。
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={uploading}
                    className="w-full rounded-[var(--radius)] border-2 border-dashed border-[color:var(--border)] py-6 text-xs text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] disabled:opacity-60"
                    onClick={() => imgInputRef.current?.click()}
                  >
                    {uploading ? '上传中…' : (
                      <>
                        点击选择图片<br />
                        <span className="opacity-60">
                          JPEG · PNG · WebP · GIF
                          {quota && ` · 最大 ${formatBytes(quota.maxImageBytes)}`}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {panel === 'video' && (
              <>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={handleVideoFile}
                />
                {quota && !quota.canUploadVideo ? (
                  <p className="rounded-[var(--radius)] bg-[color:var(--secondary)] p-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    你的账号未开通视频上传权限。请联系管理员开通。
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={uploading}
                    className="w-full rounded-[var(--radius)] border-2 border-dashed border-[color:var(--border)] py-6 text-xs text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] disabled:opacity-60"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    {uploading ? '上传中…' : (
                      <>
                        点击选择视频<br />
                        <span className="opacity-60">
                          MP4 · WebM
                          {quota && ` · 最大 ${formatBytes(quota.maxVideoBytes)}`}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {panel === 'link' && (
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  className="life-input w-full px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="链接标题（可选）"
                  value={linkTitle}
                  onChange={e => setLinkTitle(e.target.value)}
                  className="life-input w-full px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={handleInsertLink}
                  className="life-button life-button-primary w-full text-xs font-medium"
                >
                  插入链接
                </button>
              </div>
            )}

            {panel === 'videolink' && (
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="YouTube · 哔哩哔哩 · Google Drive 链接"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  className="life-input w-full px-3 py-2 text-xs"
                />
                <p className="text-[10px] text-[color:var(--muted-foreground)]">
                  支持：YouTube、哔哩哔哩、Google Drive
                </p>
                <button
                  type="button"
                  onClick={handleInsertVideoLink}
                  className="life-button life-button-primary w-full text-xs font-medium"
                >
                  插入链接
                </button>
              </div>
            )}
          </div>

          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={close}
              className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
