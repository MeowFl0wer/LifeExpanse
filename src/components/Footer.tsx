import RunningClock from './RunningClock'
import { siteStats } from '../mockData'

type FooterProps = {
  variant?: 'plain' | 'expanse'
}

export default function Footer({ variant = 'plain' }: FooterProps) {
  const expanse = variant === 'expanse'
  const footerClass = expanse
    ? 'border-t border-white/35 bg-white/64 backdrop-blur-md'
    : 'border-t border-white/50 bg-white/78 backdrop-blur-sm'
  const textClass = expanse ? 'text-[#24323A]' : 'text-[color:var(--muted-foreground)]'
  const dividerClass = expanse ? 'text-[#8FA1A8]' : 'text-[color:var(--border)]'

  return (
    <footer className={footerClass}>
      <div className="life-shell max-w-5xl py-8">
        <div className={`flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between ${textClass}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              本站已运行{' '}
              <RunningClock launchedAt={siteStats.launchedAt} />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>总访问量 {siteStats.totalPV.toLocaleString()} 次</span>
            <span className={`hidden sm:inline ${dividerClass}`}>·</span>
            <span>独立访客 {siteStats.totalUV.toLocaleString()} 人</span>
          </div>
        </div>
        <div className={`mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-5 text-xs ${expanse ? 'border-white/42' : 'border-[color:var(--border)]'} ${textClass}`}>
          <span>© 2024 LifeExpanse · life.555978.xyz</span>
          <span>
            Notes, thoughts, places.
          </span>
        </div>
      </div>
    </footer>
  )
}
