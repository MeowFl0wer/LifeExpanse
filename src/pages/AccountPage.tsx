import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { euanProfile, deviceSessions, adminAccessRecords, storageStats } from '../mockData'
import { useCurrentUser, clearCurrentUser } from '../auth'

type Tab = 'profile' | 'security' | 'data'

const tabs: { key: Tab; label: string }[] = [
  { key: 'profile', label: '个人资料' },
  { key: 'security', label: '账号安全' },
  { key: 'data', label: '数据与备份' },
]

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{title}</h2>
      {desc && <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">{desc}</p>}
    </div>
  )
}

export default function AccountPage() {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const [tab, setTab] = useState<Tab>('profile')

  const [displayName, setDisplayName] = useState(euanProfile.displayName)
  const [bio, setBio] = useState(euanProfile.bio)
  const [timezone, setTimezone] = useState('Asia/Shanghai')
  const [language, setLanguage] = useState('zh-CN')
  const [publicHomepage, setPublicHomepage] = useState(true)
  const [showPv, setShowPv] = useState(true)
  const [showUv, setShowUv] = useState(true)

  const [sessions, setSessions] = useState(deviceSessions)
  const [importMode] = useState<'merge'>('merge')

  const storagePct = Math.round((storageStats.usedMb / storageStats.limitMb) * 100)

  function handleLogout() {
    clearCurrentUser()
    navigate('/')
  }

  function handleRevokeSession(id: string) {
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="life-page flex min-h-screen flex-col">
      <AppHeader />

      <main className="life-shell max-w-4xl flex-1 py-10">
        <div className="mb-8 border-b border-[color:var(--border)] pb-8">
          <p className="life-kicker mb-2">账号</p>
          <h1 className="text-3xl font-light text-[color:var(--foreground)]">
            {euanProfile.displayName}
            <span className="ml-3 text-base text-[color:var(--muted-foreground)]">@{currentUser}</span>
          </h1>
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

        {tab === 'profile' && (
          <div className="space-y-10">
            <section>
              <SectionTitle title="基本资料" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">用户名</label>
                  <input value={currentUser ?? ''} disabled className="life-input w-full px-3 py-2 text-sm opacity-60" />
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    用户名是你的主页地址，修改后旧地址会保留一段时间并重定向。
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">显示名称</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="life-input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">时区</label>
                  <select value={timezone} onChange={e => setTimezone(e.target.value)} className="life-input w-full px-3 py-2 text-sm">
                    <option value="Asia/Shanghai">Asia/Shanghai</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">默认语言</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="life-input w-full px-3 py-2 text-sm">
                    <option value="zh-CN">简体中文</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--foreground)]">个人简介</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="一句话介绍自己" className="life-input w-full px-3 py-2 text-sm leading-7" />
                </div>
              </div>
              <button type="button" onClick={() => alert('前端原型：资料保存需要真实后端支持。')} className="life-button life-button-primary mt-4 text-sm">
                保存资料
              </button>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle title="公开主页" desc="控制别人访问 /{username} 时能看到什么。" />
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
                  <input type="checkbox" checked={publicHomepage} onChange={e => setPublicHomepage(e.target.checked)} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                  开启公开个人主页
                </label>
                <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
                  <input type="checkbox" checked={showPv} onChange={e => setShowPv(e.target.checked)} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                  在页脚展示主页访问量（PV）
                </label>
                <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
                  <input type="checkbox" checked={showUv} onChange={e => setShowUv(e.target.checked)} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                  同时展示独立访客数（UV）
                </label>
              </div>
            </section>
          </div>
        )}

        {tab === 'security' && (
          <div className="space-y-10">
            <section>
              <SectionTitle title="密码" />
              <div className="grid gap-3 sm:max-w-md">
                <input type="password" placeholder="当前密码" className="life-input px-3 py-2 text-sm" autoComplete="current-password" />
                <input type="password" placeholder="新密码（至少 8 位）" className="life-input px-3 py-2 text-sm" autoComplete="new-password" />
                <input type="password" placeholder="确认新密码" className="life-input px-3 py-2 text-sm" autoComplete="new-password" />
              </div>
              <button type="button" onClick={() => alert('前端原型：修改密码需要真实后端支持（Argon2id 哈希）。')} className="life-button life-button-primary mt-4 text-sm">
                修改密码
              </button>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle title="登录设备" desc="可以退出其他设备上的会话。" />
              <div className="border-t border-[color:var(--border)]">
                {sessions.map(s => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[color:var(--foreground)]">{s.device}</p>
                        {s.current && (
                          <span className="rounded-full bg-[#EEF8F0] px-2 py-0.5 text-[10px] text-[#3F744D]">当前设备</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{s.location} · 最近活动 {s.lastActive}</p>
                    </div>
                    {!s.current && (
                      <button type="button" onClick={() => handleRevokeSession(s.id)} className="life-button text-xs">
                        退出
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleLogout} className="life-button mt-5 text-sm">
                退出当前登录
              </button>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle
                title="管理员访问记录"
                desc="管理员默认无法查看你的私密内容。任何破窗访问都会记录在这里并通知你。"
              />
              {adminAccessRecords.length === 0 ? (
                <p className="text-sm text-[color:var(--muted-foreground)]">目前没有任何管理员访问过你的私密数据。</p>
              ) : (
                <div className="border-t border-[color:var(--border)]">
                  {adminAccessRecords.map(r => (
                    <div key={r.id} className="border-b border-[color:var(--border)] py-4">
                      <p className="text-sm text-[color:var(--foreground)]">{r.scope}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                        {r.admin} · 工单 {r.ticket} · {r.occurredAt}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">原因：{r.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-10">
            <section>
              <SectionTitle title="存储用量" />
              <div className="life-surface p-5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-[color:var(--muted-foreground)]">已使用</span>
                  <span className="text-[color:var(--foreground)]">
                    {storageStats.usedMb} MB / {storageStats.limitMb} MB
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--muted)]">
                  <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${storagePct}%` }} />
                </div>
                <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                  图片 {storageStats.imageCount} 张 · 小视频 {storageStats.videoCount} 个
                </p>
              </div>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle
                title="导出数据"
                desc="导出包含全部内容、图片、小视频、标签、轨迹、飞行记录、独立空间及回复。空间密码不会以明文写入导出包。"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => alert('前端原型：将生成包含 manifest.json、Markdown/JSON 内容、CSV 和媒体文件的数据包。')} className="life-button life-button-primary text-sm">
                  导出完整数据包
                </button>
                <button type="button" onClick={() => alert('前端原型：仅导出 Markdown 文本内容。')} className="life-button text-sm">
                  仅导出 Markdown
                </button>
              </div>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle
                title="导入数据"
                desc="导入只会合并，不会覆盖或清空现有内容。重复数据跳过，冲突数据生成副本。"
              />
              <div className="life-surface p-5">
                <div className="mb-4 flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                  <span className="rounded-full bg-[#EEF8F0] px-2 py-0.5 text-[#3F744D]">合并模式</span>
                  <span>当前版本不提供覆盖导入。</span>
                </div>
                <button
                  type="button"
                  onClick={() => alert(`前端原型（${importMode} 模式）：\n\n导入前会展示新增、重复、冲突和错误数量；\n相同 UUID 且内容一致的数据直接跳过；\nUUID 相同但内容不同的会创建冲突副本；\n导入失败会整体回滚，不影响现有数据。`)}
                  className="life-button w-full border-2 border-dashed py-6 text-xs"
                >
                  选择数据包文件（.zip）
                </button>
              </div>
            </section>

            <section className="border-t border-[color:var(--border)] pt-8">
              <SectionTitle title="删除账号" desc="删除前请先导出数据。此操作需要二次确认。" />
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('删除账号会移除你的全部内容、媒体和加密空间。\n\n建议先导出数据。确定继续吗？')) {
                    alert('前端原型：真实删除需要后端二次确认和保留期处理。')
                  }
                }}
                className="life-button text-sm text-[#B23B3B] hover:border-[#B23B3B] hover:text-[#B23B3B]"
              >
                删除账号
              </button>
            </section>
          </div>
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
