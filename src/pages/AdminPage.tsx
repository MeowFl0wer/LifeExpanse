import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import AdminBackupPanel from '../components/AdminBackupPanel'
import SecuritySettings from '../components/SecuritySettings'
import {
  createInvite, fetchAudit, fetchInvites, fetchStatus, fetchUserDetail, fetchUsers,
  revokeInvite, setPermissions, setRegistrationMode,
  type AdminUser, type AdminUserDetail, type AuditEntry, type Invite,
  type RegistrationMode, type SystemStatus, type UserSort,
} from '../api/admin'

/**
 * The administration console.
 *
 * It manages accounts and site settings. It is deliberately not a reader: the
 * per-user view shows counts, never titles or bodies — the backend does not
 * return them, so this page could not display them even if it tried.
 *
 * The route sits behind an admin guard and every endpoint re-checks the role.
 * What is rendered here is a convenience, not the security boundary.
 */

type Tab = 'status' | 'users' | 'settings' | 'audit' | 'security' | 'backup'

const tabs: { key: Tab; label: string }[] = [
  { key: 'status', label: '系统状况' },
  { key: 'users', label: '用户' },
  { key: 'settings', label: '注册与邀请' },
  { key: 'audit', label: '审计日志' },
  { key: 'security', label: '管理员账号' },
  { key: 'backup', label: '备份与恢复' },
]

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d} 天 ${h} 小时 ${m} 分`
}

function formatTime(iso: string | null): string {
  if (!iso) return '从未'
  const d = new Date(iso)
  return `${d.toLocaleDateString('zh-CN')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[color:var(--border)] py-3 last:border-0">
      <span className="text-sm text-[color:var(--muted-foreground)]">{label}</span>
      <span className="text-sm text-[color:var(--foreground)]">{value}</span>
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('status')

  return (
    <div className="life-page flex min-h-screen flex-col">
      <AppHeader />

      <main className="life-shell max-w-4xl flex-1 py-10">
        <div className="mb-8 border-b border-[color:var(--border)] pb-8">
          <p className="life-kicker mb-2">管理后台</p>
          <h1 className="text-3xl font-light text-[color:var(--foreground)]">站点管理</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
            这里管理账号与站点设置。用户的内容只统计数量，不展示标题或正文。
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                tab === t.key
                  ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                  : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'status' && <StatusTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'security' && (
          <section>
            <p className="mb-6 text-sm leading-6 text-[color:var(--muted-foreground)]">
              管理员账号的密码与两步验证。两步验证一旦开启就不能关闭——
              管理员账号是这个站点上最值钱的目标。
            </p>
            <SecuritySettings />
          </section>
        )}
        {tab === 'backup' && <AdminBackupPanel />}

        <div className="mt-12 border-t border-[color:var(--border)] pt-6">
          <Link to="/app" className="text-sm text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary)]">
            ← 返回工作台
          </Link>
        </div>
      </main>
    </div>
  )
}

/* ---------------- system status ---------------- */

function StatusTab() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchStatus()
      .then(s => { if (!cancelled) setStatus(s) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败') })
    return () => { cancelled = true }
  }, [])

  if (error) return <p className="text-sm text-[#B23B3B]">{error}</p>
  if (!status) return <p className="text-sm text-[color:var(--muted-foreground)]">加载中…</p>

  const modeLabel: Record<RegistrationMode, string> = {
    closed: '关闭注册', invite: '邀请码注册', open: '公开注册',
  }

  return (
    <section>
      <div className="life-surface mb-6 flex flex-wrap divide-x divide-[color:var(--border)]">
        <Stat value={status.onlineUsers} label="在线用户" />
        <Stat value={status.liveSessions} label="活跃会话" />
        <Stat value={status.totalUsers} label="注册用户" />
        <Stat value={status.totalContents} label="内容总数" />
      </div>

      <div>
        <Row label="运行时间" value={formatDuration(status.uptimeSeconds)} />
        <Row label="系统负载" value={status.loadAverage.map(n => n.toFixed(2)).join(' / ')} />
        <Row label="CPU 核心" value={`${status.cpuCount} 核`} />
        <Row label="注册模式" value={modeLabel[status.registrationMode]} />
        <Row label="服务器时间" value={formatTime(status.serverTime)} />
        <Row label="运行环境" value={status.platform} />
        <Row label="Python" value={status.pythonVersion} />
      </div>

      <p className="mt-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
        「在线用户」指 15 分钟内建立过会话的人数；「活跃会话」是尚未过期的全部会话，两者不同。
      </p>
    </section>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 px-5 py-4 text-center">
      <div className="text-2xl font-light text-[color:var(--foreground)]">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">{label}</div>
    </div>
  )
}

/* ---------------- users ---------------- */

const sortLabels: { key: UserSort; label: string }[] = [
  { key: 'created', label: '注册时间' },
  { key: 'last_login', label: '最近登录' },
  { key: 'login_count', label: '登录次数' },
]

function UsersTab() {
  const [sort, setSort] = useState<UserSort>('created')
  const [keyword, setKeyword] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchUsers(sort, keyword)
      .then(rows => { if (!cancelled) setUsers(rows) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败') })
    return () => { cancelled = true }
  }, [sort, keyword, reloadTick])

  if (openId) {
    return (
      <UserDetail
        id={openId}
        onBack={() => setOpenId(null)}
        onChanged={() => setReloadTick(n => n + 1)}
      />
    )
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[color:var(--muted-foreground)]">排序</span>
          {sortLabels.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                sort === s.key
                  ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                  : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="搜索用户名..."
          aria-label="搜索用户"
          className="life-input w-44 px-3 py-1.5 text-xs sm:w-56"
        />
      </div>

      {error && <p className="mb-4 text-sm text-[#B23B3B]">{error}</p>}

      {users.length === 0 ? (
        <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">没有匹配的用户。</p>
      ) : (
        <div className="border-t border-[color:var(--border)]">
          {users.map(u => (
            <div key={u.id} className="flex flex-wrap items-center gap-4 border-b border-[color:var(--border)] py-4">
              <div className="min-w-40 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[color:var(--foreground)]">
                    {u.displayName || u.username}
                  </span>
                  <span className="text-xs text-[color:var(--muted-foreground)]">@{u.username}</span>
                  {!u.isActive && (
                    <span className="rounded-full bg-[#FBEAEA] px-2 py-0.5 text-[10px] text-[#B23B3B]">已停用</span>
                  )}
                  {u.totpEnabled && (
                    <span className="rounded-full bg-[#EEF8F0] px-2 py-0.5 text-[10px] text-[#3F744D]">2FA</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {u.emailMasked} · 登录 {u.loginCount} 次 · 最近 {formatTime(u.lastLoginAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(u.id)}
                className="life-button shrink-0 text-xs"
              >
                详情
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function UserDetail({
  id, onBack, onChanged,
}: { id: string; onBack: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchUserDetail(id)
      .then(d => { if (!cancelled) setDetail(d) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败') })
    return () => { cancelled = true }
  }, [id])

  async function toggle(changes: Parameters<typeof setPermissions>[1]) {
    if (!detail || busy) return
    setBusy(true)
    setError('')
    try {
      await setPermissions(id, changes)
      setDetail(await fetchUserDetail(id))
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败')
    } finally {
      setBusy(false)
    }
  }

  if (error && !detail) return <p className="text-sm text-[#B23B3B]">{error}</p>
  if (!detail) return <p className="text-sm text-[color:var(--muted-foreground)]">加载中…</p>

  return (
    <section>
      <button type="button" onClick={onBack} className="mb-5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]">
        ← 返回用户列表
      </button>

      <h2 className="text-xl font-medium text-[color:var(--foreground)]">
        {detail.displayName || detail.username}
        <span className="ml-2 text-sm text-[color:var(--muted-foreground)]">@{detail.username}</span>
      </h2>

      <div className="mt-5">
        <Row label="主邮箱" value={detail.emailMasked} />
        <Row label="备用邮箱" value={detail.backupEmailMasked || '未设置'} />
        <Row label="邮箱已验证" value={detail.emailVerified ? '是' : '否'} />
        <Row label="两步验证" value={detail.totpEnabled ? '已开启' : '未开启'} />
        <Row label="注册时间" value={formatTime(detail.createdAt)} />
        <Row label="最近登录" value={formatTime(detail.lastLoginAt)} />
        <Row label="登录次数" value={`${detail.loginCount} 次`} />
      </div>

      <h3 className="mt-8 text-base font-medium text-[color:var(--foreground)]">数据量</h3>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        只统计数量。管理后台不展示用户内容的标题或正文。
      </p>
      <div className="mt-3">
        <Row label="内容总数" value={`${detail.contentCounts.total} 条`} />
        <Row
          label="随想 / 日记 / 笔记"
          value={`${detail.contentCounts.thought} / ${detail.contentCounts.diary} / ${detail.contentCounts.pkm}`}
        />
        <Row label="其中公开" value={`${detail.contentCounts.public} 条`} />
        <Row
          label="图片 / 视频"
          value={`${detail.mediaCounts.images} 张 / ${detail.mediaCounts.videos} 个`}
        />
      </div>

      <h3 className="mt-8 text-base font-medium text-[color:var(--foreground)]">权限</h3>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        上传权限由管理员授予。每次改动都会写入审计日志。
      </p>
      <div className="mt-3 space-y-3">
        <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
          <input
            type="checkbox"
            checked={detail.canUploadImage}
            disabled={busy}
            onChange={e => void toggle({ canUploadImage: e.target.checked })}
            className="h-3.5 w-3.5 accent-[color:var(--primary)]"
          />
          允许上传图片
        </label>
        <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
          <input
            type="checkbox"
            checked={detail.canUploadVideo}
            disabled={busy}
            onChange={e => void toggle({ canUploadVideo: e.target.checked })}
            className="h-3.5 w-3.5 accent-[color:var(--primary)]"
          />
          允许上传视频
        </label>
        <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
          <input
            type="checkbox"
            checked={detail.isActive}
            disabled={busy}
            onChange={e => void toggle({ isActive: e.target.checked })}
            className="h-3.5 w-3.5 accent-[color:var(--primary)]"
          />
          账号启用（取消后无法登录）
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-[#B23B3B]">{error}</p>}

      <p className="mt-8 text-xs leading-6 text-[color:var(--muted-foreground)]">
        文件上传功能尚未实现，图片与视频计数目前恒为 0。权限位可以提前授予。
      </p>
    </section>
  )
}

/* ---------------- registration & invites ---------------- */

const modes: { key: RegistrationMode; label: string; desc: string }[] = [
  { key: 'closed', label: '关闭注册', desc: '只有管理员手动创建账号。' },
  { key: 'invite', label: '邀请码注册', desc: '需要一个未使用过的邀请码。' },
  { key: 'open', label: '公开注册', desc: '任何人可注册，仍需通过邮箱验证。' },
]

function SettingsTab() {
  const [mode, setMode] = useState<RegistrationMode | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    const [status, list] = await Promise.all([fetchStatus(), fetchInvites()])
    setMode(status.registrationMode)
    setInvites(list)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [status, list] = await Promise.all([fetchStatus(), fetchInvites()])
        if (cancelled) return
        setMode(status.registrationMode)
        setInvites(list)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true)
    setError('')
    try {
      await action()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="text-base font-medium text-[color:var(--foreground)]">注册模式</h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">切换后立即生效。</p>

      <div className="mt-4 space-y-2">
        {modes.map(m => (
          <label
            key={m.key}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[color:var(--border)] p-4 transition-colors hover:border-[color:var(--accent)]"
          >
            <input
              type="radio"
              name="registration-mode"
              checked={mode === m.key}
              disabled={busy || mode === null}
              onChange={() => void run(() => setRegistrationMode(m.key), '切换失败')}
              className="mt-1 h-3.5 w-3.5 accent-[color:var(--primary)]"
            />
            <span>
              <span className="block text-sm text-[color:var(--foreground)]">{m.label}</span>
              <span className="mt-0.5 block text-xs text-[color:var(--muted-foreground)]">{m.desc}</span>
            </span>
          </label>
        ))}
      </div>

      <h2 className="mt-10 text-base font-medium text-[color:var(--foreground)]">邀请码</h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        每个邀请码只能使用一次。未使用的可以撤销；已使用的不能。
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor="invite-note" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
            备注 <span className="font-normal text-[color:var(--muted-foreground)]">（可选，只有你看得到）</span>
          </label>
          <input
            id="invite-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="给谁用的"
            className="life-input w-full px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void run(async () => { await createInvite(note.trim()); setNote('') }, '生成失败')}
          disabled={busy}
          className="life-button life-button-primary shrink-0 text-sm disabled:opacity-60"
        >
          {busy ? '处理中…' : '生成邀请码'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[#B23B3B]">{error}</p>}

      {invites.length === 0 ? (
        <p className="py-10 text-center text-sm text-[color:var(--muted-foreground)]">还没有邀请码。</p>
      ) : (
        <div className="mt-5 border-t border-[color:var(--border)]">
          {invites.map(inv => (
            <div key={inv.id} className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border)] py-3">
              <code className="font-mono text-sm text-[color:var(--foreground)]">{inv.code}</code>
              {inv.note && <span className="text-xs text-[color:var(--muted-foreground)]">{inv.note}</span>}
              <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">
                {inv.usedBy ? `已被 @${inv.usedBy} 使用` : inv.revokedAt ? '已撤销' : '未使用'}
              </span>
              {!inv.spent && (
                <button
                  type="button"
                  onClick={() => void run(() => revokeInvite(inv.id), '撤销失败')}
                  disabled={busy}
                  className="life-button text-xs disabled:opacity-60"
                >
                  撤销
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ---------------- audit ---------------- */

const auditLabels: Record<string, string> = {
  login: '登录',
  login_failed: '登录失败',
  login_2fa_failed: '两步验证失败',
  register: '注册',
  password_changed: '修改密码',
  password_reset: '重置密码',
  password_change_failed: '修改密码失败',
  email_changed: '更换邮箱',
  '2fa_enabled': '开启两步验证',
  '2fa_disabled': '关闭两步验证',
  permissions_changed: '权限变更',
  registration_mode_changed: '注册模式变更',
  invite_created: '生成邀请码',
  invite_revoked: '撤销邀请码',
}

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchAudit(filter)
      .then(rows => { if (!cancelled) setEntries(rows) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败') })
    return () => { cancelled = true }
  }, [filter])

  return (
    <section>
      <h2 className="text-base font-medium text-[color:var(--foreground)]">审计日志</h2>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        记录登录、账号变更、权限授予和站点设置改动。最新的在最上面。
      </p>

      <div className="mt-4">
        <label htmlFor="audit-filter" className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">
          按事件筛选
        </label>
        <select
          id="audit-filter"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="life-input px-3 py-2 text-sm"
        >
          <option value="">全部事件</option>
          {Object.entries(auditLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {error && <p className="mt-3 text-sm text-[#B23B3B]">{error}</p>}

      {entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-[color:var(--muted-foreground)]">没有记录。</p>
      ) : (
        <div className="mt-5 border-t border-[color:var(--border)]">
          {entries.map(e => (
            <div key={e.id} className="border-b border-[color:var(--border)] py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[color:var(--foreground)]">
                  {auditLabels[e.event] ?? e.event}
                </span>
                <span className="text-xs text-[color:var(--muted-foreground)]">@{e.actor}</span>
                <time className="ml-auto text-xs text-[color:var(--muted-foreground)]">
                  {formatTime(e.createdAt)}
                </time>
              </div>
              {e.detail && (
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{e.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
