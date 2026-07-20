import { useState } from 'react'
import { normaliseMembership } from '../lib/library'
import type { Folder, Series } from '../types'

interface LibraryPickerProps {
  folders: Folder[]
  series: Series[]
  folderIds: string[]
  seriesIds: string[]
  onChange: (next: { folderIds: string[]; seriesIds: string[] }) => void
  /** Creating goes through the data layer, so these are async. */
  onCreateFolder: (name: string) => Promise<string>
  onCreateSeries: (name: string) => Promise<string>
}

/**
 * Folder + series selection for the editor.
 *
 * Membership is many-to-many, so both are checkbox lists. A series already
 * covered by a chosen folder is shown as inherited and locked: the note
 * reaches that series through its folder, and ticking it separately would put
 * the same note both inside the folder and loose beside it.
 */
export default function LibraryPicker({
  folders, series, folderIds, seriesIds, onChange, onCreateFolder, onCreateSeries,
}: LibraryPickerProps) {
  const [creating, setCreating] = useState<'folder' | 'series' | null>(null)
  const [draftName, setDraftName] = useState('')

  const chosenFolders = folders.filter(f => folderIds.includes(f.id))
  const inheritedSeriesIds = new Set(chosenFolders.flatMap(f => f.seriesIds ?? []))

  function apply(next: { folderIds: string[]; seriesIds: string[] }) {
    onChange(normaliseMembership(next, folders))
  }

  function toggleFolder(id: string) {
    const next = folderIds.includes(id) ? folderIds.filter(f => f !== id) : [...folderIds, id]
    apply({ folderIds: next, seriesIds })
  }

  function toggleSeries(id: string) {
    if (inheritedSeriesIds.has(id)) return
    const next = seriesIds.includes(id) ? seriesIds.filter(s => s !== id) : [...seriesIds, id]
    apply({ folderIds, seriesIds: next })
  }

  const [creatingBusy, setCreatingBusy] = useState(false)

  async function confirmCreate() {
    const name = draftName.trim()
    if (!name || creatingBusy) return
    setCreatingBusy(true)
    try {
      if (creating === 'folder') {
        const id = await onCreateFolder(name)
        apply({ folderIds: [...folderIds, id], seriesIds })
      } else {
        const id = await onCreateSeries(name)
        apply({ folderIds, seriesIds: [...seriesIds, id] })
      }
      setCreating(null)
      setDraftName('')
    } catch {
      // Leave the box open with the name intact so the attempt is not lost.
    } finally {
      setCreatingBusy(false)
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-[color:var(--foreground)]">
          文件夹
          {folderIds.length > 0 && (
            <span className="ml-1.5 font-normal text-[color:var(--muted-foreground)]">
              已选 {folderIds.length}
            </span>
          )}
        </legend>

        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
          {folders.length === 0 && (
            <p className="text-xs text-[color:var(--muted-foreground)]">还没有文件夹</p>
          )}
          {folders.map(f => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--foreground)]">
              <input
                type="checkbox"
                checked={folderIds.includes(f.id)}
                onChange={() => toggleFolder(f.id)}
                className="h-3.5 w-3.5 shrink-0 accent-[color:var(--primary)]"
              />
              <span className="truncate">{f.name}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => { setCreating('folder'); setDraftName('') }}
          className="mt-2 text-xs text-[color:var(--primary)] hover:underline"
        >
          + 新建文件夹
        </button>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-[color:var(--foreground)]">
          系列
          {(seriesIds.length + inheritedSeriesIds.size) > 0 && (
            <span className="ml-1.5 font-normal text-[color:var(--muted-foreground)]">
              已选 {seriesIds.length + inheritedSeriesIds.size}
            </span>
          )}
        </legend>

        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
          {series.length === 0 && (
            <p className="text-xs text-[color:var(--muted-foreground)]">还没有系列</p>
          )}
          {series.map(s => {
            const inherited = inheritedSeriesIds.has(s.id)
            return (
              <label
                key={s.id}
                className={`flex items-center gap-2 text-sm ${
                  inherited
                    ? 'cursor-default text-[color:var(--muted-foreground)]'
                    : 'cursor-pointer text-[color:var(--foreground)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={inherited || seriesIds.includes(s.id)}
                  disabled={inherited}
                  onChange={() => toggleSeries(s.id)}
                  className="h-3.5 w-3.5 shrink-0 accent-[color:var(--primary)]"
                />
                <span className="truncate">{s.name}</span>
                {inherited && (
                  <span className="shrink-0 rounded-full bg-[color:var(--secondary)] px-1.5 py-0.5 text-[10px]">
                    随文件夹
                  </span>
                )}
              </label>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => { setCreating('series'); setDraftName('') }}
          className="mt-2 text-xs text-[color:var(--primary)] hover:underline"
        >
          + 新建系列
        </button>
      </fieldset>

      {creating && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] bg-[color:var(--secondary)] px-3 py-2.5 sm:col-span-2">
          <span className="text-xs text-[color:var(--muted-foreground)]">
            新建{creating === 'folder' ? '文件夹' : '系列'}
          </span>
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); void confirmCreate() }
              if (e.key === 'Escape') setCreating(null)
            }}
            placeholder="名称"
            className="life-input min-w-40 flex-1 px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void confirmCreate()}
            disabled={creatingBusy}
            className="life-button life-button-primary px-3 py-1 text-xs disabled:opacity-60"
          >
            {creatingBusy ? '创建中…' : '创建'}
          </button>
          <button type="button" onClick={() => setCreating(null)} className="life-button px-3 py-1 text-xs">
            取消
          </button>
        </div>
      )}

      {inheritedSeriesIds.size > 0 && (
        <p className="text-xs leading-6 text-[color:var(--muted-foreground)] sm:col-span-2">
          标为「随文件夹」的系列是通过所选文件夹进入的，笔记会显示在该系列下对应的文件夹里。
        </p>
      )}
    </div>
  )
}
