import { useRef, useState } from 'react'
import LibraryCover from './LibraryCover'
import type { Series } from '../types'

export interface LibraryItemDraft {
  name: string
  description: string
  cover?: string
  seriesId?: string
}

interface LibraryItemFormProps {
  kind: 'folder' | 'series'
  /** Series options, shown only for folders so they can be filed under one. */
  seriesOptions?: Series[]
  initial?: Partial<LibraryItemDraft>
  submitLabel: string
  onCancel: () => void
  onSubmit: (draft: LibraryItemDraft) => void
}

export default function LibraryItemForm({
  kind, seriesOptions = [], initial, submitLabel, onCancel, onSubmit,
}: LibraryItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [cover, setCover] = useState<string | undefined>(initial?.cover)
  const [seriesId, setSeriesId] = useState(initial?.seriesId ?? '')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const label = kind === 'folder' ? '文件夹' : '系列'

  function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('封面只支持 JPEG、PNG、WebP 或 GIF')
      return
    }
    setError('')
    setCover(URL.createObjectURL(file))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError(`请填写${label}名称`)
      return
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      cover,
      seriesId: seriesId || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="life-surface mb-8 p-6">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{submitLabel}</h2>

      <div className="mt-5 flex flex-wrap gap-6">
        <div className="shrink-0">
          <LibraryCover name={name || label} kind={kind} cover={cover} className="h-28 w-28" />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleCover}
          />
          <div className="mt-2 flex flex-col items-center gap-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="life-button px-2.5 py-1 text-xs">
              上传封面
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
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
                归入系列（可选）
              </label>
              <select
                value={seriesId}
                onChange={e => setSeriesId(e.target.value)}
                className="life-input w-full px-3 py-2 text-sm"
              >
                <option value="">不归入系列</option>
                {seriesOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                文件夹归入系列后，它里面的笔记会跟着一起进入该系列。
              </p>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-[#B23B3B]">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="life-button text-sm">取消</button>
        <button type="submit" className="life-button life-button-primary text-sm">{submitLabel}</button>
      </div>
    </form>
  )
}
