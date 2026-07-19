import { useState } from 'react'
import type { Folder, Series } from '../types'

interface LibraryPickerProps {
  folders: Folder[]
  series: Series[]
  folderId: string
  seriesId: string
  onChange: (next: { folderId: string; seriesId: string }) => void
  onCreateFolder: (name: string) => string
  onCreateSeries: (name: string) => string
}

const NEW = '__new__'

/**
 * Folder + series selection for the editor.
 *
 * Picking a folder disables the series select and shows the series inherited
 * from that folder, because a foldered note travels with its folder (rule 2.8)
 * and must not be filed into a different series independently.
 */
export default function LibraryPicker({
  folders, series, folderId, seriesId, onChange, onCreateFolder, onCreateSeries,
}: LibraryPickerProps) {
  const [creating, setCreating] = useState<'folder' | 'series' | null>(null)
  const [draftName, setDraftName] = useState('')

  const selectedFolder = folders.find(f => f.id === folderId)
  const inheritedSeries = selectedFolder?.seriesId
    ? series.find(s => s.id === selectedFolder.seriesId)
    : undefined

  function handleFolderChange(value: string) {
    if (value === NEW) {
      setCreating('folder')
      setDraftName('')
      return
    }
    // Choosing a folder clears any direct series link.
    onChange({ folderId: value, seriesId: value ? '' : seriesId })
  }

  function handleSeriesChange(value: string) {
    if (value === NEW) {
      setCreating('series')
      setDraftName('')
      return
    }
    onChange({ folderId, seriesId: value })
  }

  function confirmCreate() {
    const name = draftName.trim()
    if (!name) return
    if (creating === 'folder') {
      const id = onCreateFolder(name)
      onChange({ folderId: id, seriesId: '' })
    } else if (creating === 'series') {
      const id = onCreateSeries(name)
      onChange({ folderId, seriesId: id })
    }
    setCreating(null)
    setDraftName('')
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">文件夹</label>
          <select
            value={folderId}
            onChange={e => handleFolderChange(e.target.value)}
            className="life-input w-full px-3 py-2 text-sm"
          >
            <option value="">不归入文件夹</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
            <option value={NEW}>+ 新建文件夹…</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">系列</label>
          <select
            value={folderId ? (inheritedSeries?.id ?? '') : seriesId}
            onChange={e => handleSeriesChange(e.target.value)}
            disabled={Boolean(folderId)}
            className="life-input w-full px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="">不归入系列</option>
            {series.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {!folderId && <option value={NEW}>+ 新建系列…</option>}
          </select>
        </div>
      </div>

      {folderId && (
        <p className="text-xs text-[color:var(--muted-foreground)]">
          {inheritedSeries
            ? `已归入文件夹「${selectedFolder?.name}」，会跟随该文件夹进入系列「${inheritedSeries.name}」。`
            : `已归入文件夹「${selectedFolder?.name}」。该文件夹目前不属于任何系列。`}
        </p>
      )}

      {creating && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] bg-[color:var(--secondary)] px-3 py-2.5">
          <span className="text-xs text-[color:var(--muted-foreground)]">
            新建{creating === 'folder' ? '文件夹' : '系列'}
          </span>
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmCreate() }
              if (e.key === 'Escape') setCreating(null)
            }}
            placeholder="名称"
            className="life-input min-w-40 flex-1 px-2.5 py-1.5 text-xs"
          />
          <button type="button" onClick={confirmCreate} className="life-button life-button-primary px-3 py-1 text-xs">
            创建
          </button>
          <button type="button" onClick={() => setCreating(null)} className="life-button px-3 py-1 text-xs">
            取消
          </button>
        </div>
      )}
    </div>
  )
}
