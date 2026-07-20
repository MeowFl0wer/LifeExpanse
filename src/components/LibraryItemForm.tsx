import { useRef, useState } from 'react'
import { uploadMedia } from '../api/media'
import LibraryCover from './LibraryCover'
import type { Series } from '../types'

export interface LibraryItemDraft {
  name: string
  description: string
  cover?: string
  /** Folders may belong to several series. */
  seriesIds: string[]
}

interface LibraryItemFormProps {
  kind: 'folder' | 'series'
  /** Series options, shown only for folders so they can be filed under one. */
  seriesOptions?: Series[]
  initial?: Partial<LibraryItemDraft>
  submitLabel: string
  onCancel: () => void
  /** May be async — the form waits and shows the failure rather than dropping it. */
  onSubmit: (draft: LibraryItemDraft) => void | Promise<void>
}

export default function LibraryItemForm({
  kind, seriesOptions = [], initial, submitLabel, onCancel, onSubmit,
}: LibraryItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [cover, setCover] = useState<string | undefined>(initial?.cover)
  const [seriesIds, setSeriesIds] = useState<string[]>(initial?.seriesIds ?? [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const label = kind === 'folder' ? '文件夹' : '系列'

  const [uploadingCover, setUploadingCover] = useState(false)

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('封面只支持 JPEG、PNG、WebP 或 GIF')
      return
    }

    setError('')
    setUploadingCover(true)
    try {
      // Covers appear wherever the folder does, including to visitors, so the
      // file has to be public. An object URL would not survive a reload.
      const media = await uploadMedia(file, { visibility: 'public' })
      setCover(media.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '封面上传失败')
    } finally {
      setUploadingCover(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError(`请填写${label}名称`)
      return
    }
    if (saving) return
    setSaving(true)
    try {
      // Saving can reach the network, so a rejection has to land somewhere the
      // user can see it — otherwise the panel just sits there looking fine.
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        cover,
        seriesIds,
      })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : `保存${label}失败，请稍后重试`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={e => void handleSubmit(e)} className="life-surface mb-8 p-6">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{submitLabel}</h2>

      <div className="mt-5 flex flex-wrap gap-6">
        <div className="shrink-0">
          <LibraryCover name={name || label} kind={kind} cover={cover} className="h-28 w-28" />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => void handleCover(e)}
          />
          <div className="mt-2 flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingCover}
              className="life-button px-2.5 py-1 text-xs disabled:opacity-60"
            >
              {uploadingCover ? '上传中…' : '上传封面'}
            </button>
            {cover && (
              <button
                type="button"
                onClick={() => setCover(undefined)}
                className="text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                用默认封面
              </button>
            )}
          </div>
        </div>

        <div className="min-w-56 flex-1 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
              {label}名称
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder={kind === 'folder' ? '例如：前端 / React' : '例如：LifeExpanse 构建札记'}
              className="life-input w-full px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">说明</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder={`这个${label}用来放什么`}
              className="life-input w-full px-3 py-2 text-sm leading-7"
            />
          </div>

          {kind === 'folder' && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-[color:var(--foreground)]">
                归入系列（可多选）
              </p>
              {seriesOptions.length === 0 ? (
                <p className="text-xs text-[color:var(--muted-foreground)]">还没有系列</p>
              ) : (
                <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
                  {seriesOptions.map(s => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={seriesIds.includes(s.id)}
                        onChange={() =>
                          setSeriesIds(prev =>
                            prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                          )
                        }
                        className="h-3.5 w-3.5 shrink-0 accent-[color:var(--primary)]"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-xs text-[color:var(--muted-foreground)]">
                文件夹归入系列后，它里面的笔记会跟着一起进入该系列。
              </p>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-[#B23B3B]">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="life-button text-sm">取消</button>
        <button
          type="submit"
          disabled={saving}
          className="life-button life-button-primary text-sm disabled:opacity-60"
        >
          {saving ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
