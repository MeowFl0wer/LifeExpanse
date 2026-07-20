import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { maskEmail } from '../lib/mask'
import { useCurrentUser } from '../auth'
import {
  euanProfile, allContent, trajectoryEntries,
  footprintCities, flightRecords, encryptedSpaces, storageStats,
} from '../mockData'

/**
 * 「我的」 — the signed-in hub.
 *
 * Order follows the spec: 个人信息 → 设置 → 记录概况 → 数据导出 → About.
 * Anything that needs a form of its own is an entry point rather than an
 * inline editor, so this page stays a place you can scan.
 */

function Section({
  title, desc, children,
}: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{title}</h2>
      {desc && <p className="mt-1 text-sm leading-7 text-[color:var(--muted-foreground)]">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[color:var(--border)] py-3 last:border-0">
      <span className="text-sm text-[color:var(--muted-foreground)]">{label}</span>
      <span className="text-sm text-[color:var(--foreground)]">{value}</span>
    </div>
  )
}

export default function MePage() {
  const currentUser = useCurrentUser()
  const profile = euanProfile

  const publicCount = allContent.filter(c => c.visibility === 'public').length
  const totalDistance = flightRecords.reduce((s, f) => s + f.distance, 0)
  const countryCount = new Set(footprintCities.map(c => c.country)).size
  const storagePct = Math.round((storageStats.usedMb / storageStats.limitMb) * 100)

  return (
    <div className="life-page flex min-h-screen flex-col">
      <AppHeader />

      <main className="life-shell max-w-3xl flex-1 py-12">
        <div className="mb-10 border-b border-[color:var(--border)] pb-8">
          <p className="life-kicker mb-2">我的</p>
          <h1 className="text-3xl font-light text-[color:var(--foreground)]">账号与记录</h1>
        </div>

        <div className="space-y-10">
          {/* ---- 1. 个人信息 ---- */}
          <section>
            <div className="flex flex-wrap items-start gap-5">
              <img
                src={profile.avatar}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-48 flex-1">
                <p className="text-xl font-medium text-[color:var(--foreground)]">
                  {profile.displayName}
                </p>
                <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
                  @{currentUser ?? profile.username}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {profile.bio || '还没有填写签名。'}
                </p>
              </div>
              <Link to="/account" className="life-button shrink-0 text-xs">
                修改个人信息
              </Link>
            </div>

            <div className="mt-6">
              {/* Masked so a shoulder-surfer or a screenshot does not carry the
                  address away. The full value lives in the settings form. */}
              <Row label="主邮箱" value={maskEmail(profile.email) || '未设置'} />
              <Row
                label="备用邮箱"
                value={
                  profile.backupEmail
                    ? maskEmail(profile.backupEmail)
                    : <span className="text-[color:var(--muted-foreground)]">未设置</span>
                }
              />
              <Row label="公开主页开放于" value={profile.publicSince} />
            </div>
          </section>

          {/* ---- 2. 设置 ---- */}
          <Section title="设置" desc="个人资料、密码、登录设备与账号安全。">
            <Link to="/account" className="life-button text-sm">打开设置</Link>
          </Section>

          {/* ---- 3. 记录概况 ---- */}
          <Section title="记录概况" desc="目前累计的记录量。">
            <div>
              <Row label="公开内容" value={`${publicCount} 条`} />
              <Row label="人生轨迹" value={`${trajectoryEntries.length} 天`} />
              <Row label="去过的城市" value={`${footprintCities.length} 座 · ${countryCount} 个国家或地区`} />
              <Row label="飞行记录" value={`${flightRecords.length} 段 · ${totalDistance.toLocaleString()} km`} />
              <Row label="独立空间" value={`${encryptedSpaces.length} 个`} />
            </div>

            <div className="life-surface mt-5 p-5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-[color:var(--muted-foreground)]">存储用量</span>
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
          </Section>

          {/* ---- 4. 数据导出 ---- */}
          <Section
            title="数据导出"
            desc="导出包含全部内容、图片、小视频、标签、轨迹、飞行记录、独立空间及回复。空间密码不会以明文写入导出包。"
          >
            <Link to="/account" className="life-button text-sm">前往导出</Link>
            <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
              删除账号前请先导出数据。回收站里的内容保留 30 天。
            </p>
          </Section>

          {/* ---- 5. About ---- */}
          <Section title="About" desc="站点说明、板块介绍、版本与实现。">
            <Link to="/about" className="life-button text-sm">查看 About</Link>
          </Section>
        </div>

        <div className="mt-12 border-t border-[color:var(--border)] pt-6">
          <Link to="/app" className="text-sm text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary)]">
            ← 返回工作台
          </Link>
        </div>
      </main>
    </div>
  )
}
