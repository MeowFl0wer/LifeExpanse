import { Link } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import RunningClock from '../components/RunningClock'
import { siteStats, allContent } from '../mockData'

const APP_VERSION = 'v0.1.0'

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 px-5 py-4 text-center first:pl-0 last:pr-0">
      <div className="text-2xl font-light text-[color:var(--foreground)]">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">{label}</div>
    </div>
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

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8">
      <h2 className="text-base font-medium text-[color:var(--foreground)]">{title}</h2>
      {desc && <p className="mt-1 text-sm leading-7 text-[color:var(--muted-foreground)]">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const modules = [
  { name: '随想', to: '/euan/thoughts', desc: '一句话的原创短记，以及从书、文章、播客里摘录下来的句子。' },
  { name: '日记', to: '/euan/diary', desc: '按日期记录的长短文，同一天可以写多篇。' },
  { name: '笔记与文章', to: '/euan/pkm', desc: '笔记和公开文章共用一套内容系统，笔记整理成熟后可直接发布为文章。' },
  { name: '人生轨迹', to: '/euan/trajectory', desc: '按天记录去过的城市和当天做了什么，支持热力图、时间线和月历。' },
  { name: '城市足迹', to: '/euan/map', desc: '只记录到城市级别，不保存精确地址或 GPS 轨迹。' },
  { name: '飞行记录', to: '/euan/flights', desc: '航段、里程、航线图，支持手动录入和 CSV 导入。' },
  { name: '独立空间', to: '/euan/space', desc: '多个互相隔离的加密空间，密码本身决定进入哪一个。' },
]

export default function AboutPage() {
  const publicCount = allContent.filter(c => c.visibility === 'public').length

  return (
    <div className="life-page flex min-h-screen flex-col">
      <PublicHeader />

      <main className="life-shell max-w-3xl flex-1 py-12">
        <div className="mb-10 border-b border-[color:var(--border)] pb-8">
          <p className="life-kicker mb-2">关于</p>
          <h1 className="text-3xl font-light text-[color:var(--foreground)]">LifeExpanse</h1>
          <p className="mt-4 text-base leading-8 text-[color:var(--foreground)]">
            一个人的记录平台。写下来的东西默认只属于自己，
            愿意公开的那部分才会出现在这里。
          </p>
          <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">
            Life is an expanse, not a track. ——
            人生不是一条既定的轨道，而是一片可以走开去的旷野。
          </p>
        </div>

        {/* Live site stats */}
        <div className="life-surface mb-10">
          <div className="border-b border-[color:var(--border)] px-5 py-4 text-center">
            <p className="text-xs text-[color:var(--muted-foreground)]">本站已运行</p>
            <p className="mt-1.5 text-lg font-light text-[color:var(--foreground)]">
              <RunningClock launchedAt={siteStats.launchedAt} />
            </p>
          </div>
          <div className="flex flex-wrap divide-x divide-[color:var(--border)]">
            <Stat value={siteStats.totalPV.toLocaleString()} label="总访问量" />
            <Stat value={siteStats.totalUV.toLocaleString()} label="独立访客" />
            <Stat value={publicCount} label="公开内容" />
          </div>
        </div>

        <div className="space-y-10">
          <Section title="站点说明" desc="这里记录什么，以及内容如何被看到。">
            <div className="space-y-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
              <p>
                每条内容有三种状态：<strong className="font-medium text-[color:var(--foreground)]">公开</strong>（任何人可见）、
                <strong className="font-medium text-[color:var(--foreground)]">私密</strong>（只有作者本人登录后可见）、
                <strong className="font-medium text-[color:var(--foreground)]">草稿</strong>（未完成，不进入时间线）。
                未登录访问时，各个板块只会显示公开的那部分。
              </p>
              <p>
                已保存的内容默认以只读方式展示。只有作者点击「编辑」后才会进入编辑模式，
                避免浏览、滚动或触屏操作时误改已有记录。
              </p>
              <p>
                独立空间是一个例外：它不出现在公开主页和搜索里，
                需要知道对应的密码才能进入，密码本身决定进入哪一个空间。
              </p>
            </div>
          </Section>

          <Section title="板块">
            <div className="border-t border-[color:var(--border)]">
              {modules.map(m => (
                <Link
                  key={m.to}
                  to={m.to}
                  className="block border-b border-[color:var(--border)] py-4 no-underline transition-colors hover:border-[color:var(--accent)]"
                >
                  <p className="text-sm font-medium text-[color:var(--foreground)]">{m.name}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">{m.desc}</p>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="版本与实现" desc="这是一个仍在建设中的前端原型。">
            <div>
              <Row label="当前版本" value={APP_VERSION} />
              <Row label="需求规格" value="PRD v1.8" />
              <Row label="前端" value="React 19 · TypeScript · Vite · Tailwind CSS v4" />
              <Row label="数据" value="全部为演示数据，刷新页面即还原" />
              <Row
                label="源码"
                value={
                  <a
                    href="https://github.com/MeowFl0wer/LifeExpanse"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[color:var(--primary)] hover:underline"
                  >
                    GitHub
                  </a>
                }
              />
            </div>
            <p className="mt-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
              当前阶段没有后端，登录、保存、上传和备份都是前端模拟。
              运行时长按站点上线时间累计，服务重启后不会归零。
            </p>
          </Section>

          <Section title="联系">
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              这是一个私人项目，暂不提供公开的联系方式。
              如果你是通过某个空间密码来到这里的，直接在那个空间里回复就好。
            </p>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
