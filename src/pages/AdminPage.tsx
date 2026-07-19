import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import {
  adminUsers, invitationCodes, securityLogs, registrationMode as defaultMode,
  backupJobs, siteStats, SPACE_LIMIT, nextId } from '../mockData'
import type { RegistrationMode } from '../types'

type Tab = 'overview' | 'users' | 'invites' | 'backup' | 'logs'

const tabs: { key: Tab; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'users', label: '用户' },
  { key: 'invites', label: '邀请码' },
  { key: 'backup', label: '备份与恢复' },
  { key: 'logs', label: '安全日志' },
]

const modeLabels: Record<RegistrationMode, string> = {
  closed: '关闭注册',
  invite: '邀请码注册',
  open: '公开注册',
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{title}</h2>
      {desc && <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">{desc}</p>}
    </div>
  )
}

function StatBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 px-5 py-4 text-center first:pl-0 last:pr-0">
      <div className="text-2xl font-light text-[color:var(--foreground)]">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">{label}</div>
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [mode, setMode] = useState<RegistrationMode>(defaultMode)
  const [users, setUsers] = useState(adminUsers)
  const [codes, setCodes] = useState(invitationCodes)
  const [announcement, setAnnouncement] = useState('')

  const activeUsers = users.filter(u => u.status === 'active').length
  const totalStorage = users.reduce((s, u) => s + u.storageUsedMb, 0)

  function toggleUserStatus(id: string) {
    setUsers(prev =>
      prev.map(u =>
        u.id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u
      )
    )
  }

  function generateCode() {
    const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase()
    setCodes(prev => [
      {
        id: nextId('ic'),
        code: `LIFE-${seg()}-${seg()}`,
        createdAt: new Date().toISOString().slice(0, 10),
        expiresAt: new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10),
      },
      ...prev,
    ])
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <AppHeader />

      <main className="life-shell flex-1 py-10">
        <div className="mb-8 border-b border-[color:var(--border)] pb-8">
          <p className="life-kicker mb-2">管理后台</p>
          <h1 className="text-3xl font-light text-[color:var(--foreground)]">站点管理</h1>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            管理员默认看不到用户的私密内容。这里只展示账号状态、用量和系统运行数据。
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

        {tab === 'overview' && (
          <div className="space-y-10">
            <div className="life-surface flex flex-wrap divide-x divide-[color:var(--border)]">
              <StatBlock value={users.length} label="注册用户" />
              <StatBlock value={activeUsers} label="正常账号" />
              <StatBlock value={`${totalStorage} MB`} label="存储用量" />
              <StatBlock value={siteStats.totalPV.toLocaleString()} label="全站 PV" />
              <StatBlock value={siteStats.totalUV.toLocaleString()} label="全站 UV" />
            </div>

            <section>
              <SectionTitle title="注册模式" desc="控制新用户能否创建账号。" />
              <div className="flex flex-wrap gap-2">
                {(['closed', 'invite', 'open'] as RegistrationMode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                      mode === m
                        ? 'border-[color:var(--primary)] bg-[#EEF8F0] text-[color:var(--primary)]'
                        : 'border-[color:var(--border)] bg-white/70 text-[color:var(--muted-foreground)] hover:border-[color:var(--accent)]'
                    }`}
                  >
                    {modeLabels[m]}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                当前：{modeLabels[mode]}
                {mode === 'open' && '（公开注册需要邮箱验证和反滥用校验）'}
              </p>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle title="系统公告" />
              <textarea
                value={announcement}
                onChange={e => setAnnouncement(e.target.value)}
                rows={3}
                placeholder="发布一条全站公告..."
                className="life-input w-full px-4 py-3 text-sm leading-7"
              />
              <button type="button" onClick={() => alert('前端原型：公告发布需要真实后端支持。')} className="life-button life-button-primary mt-3 text-sm">
                发布公告
              </button>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle title="数据版本" />
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between border-b border-[color:var(--border)] pb-3">
                  <span className="text-[color:var(--muted-foreground)]">机场坐标库</span>
                  <span className="text-[color:var(--foreground)]">2024.10 · 4 条</span>
                </div>
                <div className="flex justify-between border-b border-[color:var(--border)] pb-3">
                  <span className="text-[color:var(--muted-foreground)]">城市地理数据</span>
                  <span className="text-[color:var(--foreground)]">2024.09</span>
                </div>
                <div className="flex justify-between border-b border-[color:var(--border)] pb-3">
                  <span className="text-[color:var(--muted-foreground)]">任务队列</span>
                  <span className="text-[color:var(--foreground)]">0 待处理 · 0 失败</span>
                </div>
                <div className="flex justify-between border-b border-[color:var(--border)] pb-3">
                  <span className="text-[color:var(--muted-foreground)]">邮件服务</span>
                  <span className="text-[color:var(--foreground)]">未配置</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 'users' && (
          <section>
            <SectionTitle title="用户列表" desc="只显示账号状态和用量等必要元数据。" />
            <div className="overflow-x-auto">
              <div className="min-w-[760px] border-t border-[color:var(--border)]">
                <div className="grid grid-cols-[1.3fr_1.6fr_5rem_5rem_7rem_6rem_5rem] gap-3 border-b border-[color:var(--border)] py-2.5 text-xs text-[color:var(--muted-foreground)]">
                  <span>用户</span>
                  <span>邮箱</span>
                  <span>状态</span>
                  <span>内容数</span>
                  <span>存储</span>
                  <span>空间配额</span>
                  <span>操作</span>
                </div>
                {users.map(u => (
                  <div key={u.id} className="grid grid-cols-[1.3fr_1.6fr_5rem_5rem_7rem_6rem_5rem] items-center gap-3 border-b border-[color:var(--border)] py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[color:var(--foreground)]">{u.displayName}</p>
                      <p className="truncate text-xs text-[color:var(--muted-foreground)]">@{u.username}</p>
                    </div>
                    <span className="truncate text-xs text-[color:var(--muted-foreground)]">{u.email}</span>
                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] ${
                        u.status === 'active'
                          ? 'border-[#D5EBD9] bg-[#EEF8F0] text-[#3F744D]'
                          : 'border-[#F3D3D3] bg-[#FDEEEE] text-[#B23B3B]'
                      }`}
                    >
                      {u.status === 'active' ? '正常' : '已冻结'}
                    </span>
                    <span className="text-xs text-[color:var(--muted-foreground)]">{u.contentCount}</span>
                    <span className="text-xs text-[color:var(--muted-foreground)]">
                      {u.storageUsedMb} / {u.storageLimitMb} MB
                    </span>
                    <span className="text-xs text-[color:var(--muted-foreground)]">
                      {u.spacesUsed} / {u.spaceLimit}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleUserStatus(u.id)}
                      className="text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
                    >
                      {u.status === 'active' ? '冻结' : '恢复'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
              默认加密空间上限为 {SPACE_LIMIT} 个，可按用户单独调整。降低上限不会删除已有空间，只会禁止继续创建。
            </p>
          </section>
        )}

        {tab === 'invites' && (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="邀请码" />
              <button type="button" onClick={generateCode} className="life-button life-button-primary text-sm">
                生成邀请码
              </button>
            </div>
            <div className="border-t border-[color:var(--border)]">
              {codes.map(c => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] py-4">
                  <div>
                    <p className="text-sm font-medium text-[color:var(--foreground)]">{c.code}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                      创建于 {c.createdAt} · 有效期至 {c.expiresAt}
                    </p>
                  </div>
                  {c.usedBy ? (
                    <span className="rounded-full bg-[color:var(--secondary)] px-2.5 py-0.5 text-xs text-[color:var(--muted-foreground)]">
                      已被 @{c.usedBy} 使用
                    </span>
                  ) : (
                    <span className="rounded-full border border-[#D5EBD9] bg-[#EEF8F0] px-2.5 py-0.5 text-xs text-[#3F744D]">
                      未使用
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'backup' && (
          <div className="space-y-10">
            <section>
              <SectionTitle title="系统备份" desc="备份包含数据库、媒体文件、系统配置和校验值。" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => alert('前端原型：将创建一份完整系统备份并生成校验值。')} className="life-button life-button-primary text-sm">
                  立即备份
                </button>
                <button type="button" onClick={() => alert('前端原型：自动备份计划配置。')} className="life-button text-sm">
                  自动备份设置
                </button>
              </div>
              <div className="mt-6 border-t border-[color:var(--border)]">
                {backupJobs.map(b => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] py-4">
                    <div>
                      <p className="text-sm text-[color:var(--foreground)]">{b.createdAt}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{b.kind}备份 · {b.sizeMb} MB</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-[#D5EBD9] bg-[#EEF8F0] px-2.5 py-0.5 text-xs text-[#3F744D]">
                        {b.status}
                      </span>
                      <button type="button" onClick={() => alert('前端原型：下载备份包。')} className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
                        下载
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle
                title="系统恢复"
                desc="完整恢复会进入维护模式并停止写入，恢复前自动创建快照。与用户级的合并导入不同，这是覆盖式恢复。"
              />
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('系统恢复会覆盖当前全部数据。\n\n流程：校验备份 → 进入维护模式 → 创建恢复前快照 → 执行恢复 → 完整性检查。\n\n确定继续吗？')) {
                    alert('前端原型：真实恢复需要后端支持。')
                  }
                }}
                className="life-button text-sm text-[#B23B3B] hover:border-[#B23B3B] hover:text-[#B23B3B]"
              >
                从备份恢复
              </button>
            </section>
          </div>
        )}

        {tab === 'logs' && (
          <section>
            <SectionTitle title="安全日志" desc="不记录密码、令牌和完整 IP 地址。" />
            <div className="border-t border-[color:var(--border)]">
              {securityLogs.map(log => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        log.level === 'warning' ? 'bg-[#D9A441]' : 'bg-[color:var(--accent)]'
                      }`}
                    />
                    <div>
                      <p className="text-sm text-[color:var(--foreground)]">{log.event}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                        {log.actor} · {log.ip}
                      </p>
                    </div>
                  </div>
                  <time className="text-xs text-[color:var(--muted-foreground)]">{log.occurredAt}</time>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 border-t border-[color:var(--border)] pt-6">
          <Link to="/app" className="text-sm text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary)]">
            ← 返回工作台
          </Link>
        </div>
      </main>
    </div>
  )
}
