import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import {
  getTrash, restoreContentItem, purgeContentItem, emptyTrash, purgeExpiredTrash,
} from '../mockData'
import { retentionLabel, isExpired, TRASH_RETENTION_DAYS } from '../lib/trash'
import { useCurrentUser } from '../auth'
import type { ContentItem } from '../types'

const typeLabels: Record<string, string> = {
  thought: '随想',
  diary: '日记',
  pkm: '笔记与文章',
}

function kindLabel(item: ContentItem): string {
  if (item.type === 'pkm') return item.contentKind === 'article' ? '文章' : '笔记'
  return typeLabels[item.type] ?? '内容'
}

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function TrashPage() {
  const currentUser = useCurrentUser()
  const [, bump] = useState(0)
  const [notice, setNotice] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmingEmpty, setConfirmingEmpty] = useState(false)

  // Anything past its window is gone on arrival, so the bin never shows an
  // item the retention policy says should already have been cleared.
  useEffect(() => {
    purgeExpiredTrash()
    bump(n => n + 1)
  }, [])

  const entries = currentUser ? getTrash(currentUser) : []

  function handleRestore(id: string, title: string) {
    restoreContentItem(id)
    setNotice(`已恢复「${title}」。`)
    bump(n => n + 1)
  }

  function handlePurge(id: string, title: string) {
    if (!window.confirm(`彻底删除「${title}」？\n\n这一步无法撤销，内容不会再出现在回收站里。`)) {
      setConfirmingId(null)
      return
    }
    purgeContentItem(id)
    setConfirmingId(null)
    setNotice(`已彻底删除「${title}」。`)
    bump(n => n + 1)
  }

  function handleEmpty() {
    if (!currentUser) return
    if (!window.confirm(`清空回收站会彻底删除 ${entries.length} 条内容。\n\n这一步无法撤销。`)) {
      setConfirmingEmpty(false)
      return
    }
    emptyTrash(currentUser)
    setConfirmingEmpty(false)
    setNotice('回收站已清空。')
    bump(n => n + 1)
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <AppHeader />

      <main className="life-shell max-w-4xl flex-1 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--border)] pb-8">
          <div>
            <p className="life-kicker mb-2">回收站</p>
            <h1 className="text-3xl font-light text-[color:var(--foreground)]">已删除的内容</h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              删除的内容会在回收站保留 {TRASH_RETENTION_DAYS} 天，期间可以随时恢复；
              超过期限后会被自动清理。
            </p>
          </div>

          {entries.length > 0 && (
            confirmingEmpty ? (
              <span className="flex flex-wrap items-center gap-2 rounded-full bg-[#FDEEEE] px-3 py-1.5">
                <span className="text-xs text-[#B23B3B]">确定清空？</span>
                <button
                  type="button"
                  onClick={() => setConfirmingEmpty(false)}
                  className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                >
                  取消
                </button>
                <button type="button" onClick={handleEmpty} className="text-xs font-medium text-[#B23B3B] hover:underline">
                  确认清空
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingEmpty(true)}
                className="life-button text-sm hover:border-[#B23B3B] hover:text-[#B23B3B]"
              >
                清空回收站
              </button>
            )
          )}
        </div>

        {notice && (
          <p className="mb-6 rounded-[var(--radius)] border border-[#D5EBD9] bg-[#EEF8F0] px-3 py-2 text-xs text-[#3F744D]">
            {notice}
          </p>
        )}

        {entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[color:var(--muted-foreground)]">回收站是空的。</p>
            <Link to="/app" className="life-button mt-4 text-sm">返回工作台</Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-[color:var(--muted-foreground)]">{entries.length} 条已删除内容</p>
            <div className="border-t border-[color:var(--border)]">
              {entries.map(({ item, deletedAt }) => {
                const expiring = isExpired(deletedAt)
                return (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--border)] py-5">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[color:var(--secondary)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                          {kindLabel(item)}
                        </span>
                        <span
                          className={`text-xs ${expiring ? 'text-[#B23B3B]' : 'text-[color:var(--muted-foreground)]'}`}
                        >
                          {retentionLabel(deletedAt)}
                        </span>
                      </div>
                      <p className="truncate text-base font-medium text-[color:var(--foreground)]">{item.title}</p>
                      {item.summary && (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {item.summary}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-[color:var(--muted-foreground)]">
                        删除于 {formatDate(deletedAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(item.id, item.title)}
                        className="life-button text-xs"
                      >
                        恢复
                      </button>

                      {confirmingId === item.id ? (
                        <span className="flex items-center gap-2 rounded-full bg-[#FDEEEE] px-3 py-1">
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePurge(item.id, item.title)}
                            className="text-xs font-medium text-[#B23B3B] hover:underline"
                          >
                            确认彻底删除
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(item.id)}
                          className="life-button text-xs hover:border-[#B23B3B] hover:text-[#B23B3B]"
                        >
                          彻底删除
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <p className="mt-8 text-xs leading-6 text-[color:var(--muted-foreground)]">
          回收站里的内容不会出现在列表、搜索、公开主页或所属文件夹中。
          恢复后如果原有链接已被占用，系统会自动分配一个新的链接地址。
        </p>

        <div className="mt-8 border-t border-[color:var(--border)] pt-6">
          <Link to="/account" className="text-sm text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary)]">
            ← 返回账号设置
          </Link>
        </div>
      </main>
    </div>
  )
}
