import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { isAdmin } from '../auth'

const navLinks = [
  { label: '总览', to: '/app' },
  { label: '随想', to: '/euan/thoughts' },
  { label: '日记', to: '/euan/diary' },
  { label: '笔记与文章', to: '/euan/pkm' },
  { label: '人生轨迹', to: '/euan/trajectory' },
  { label: '足迹地图', to: '/euan/map' },
  { label: '飞行日志', to: '/euan/flights' },
  { label: '独立空间', to: '/euan/space' },
]

const createOptions = [
  { label: '记随想', to: '/new/thought' },
  { label: '新建日记', to: '/new/diary' },
  { label: '新建笔记', to: '/new/note' },
  { label: '写文章', to: '/new/article' },
  { label: '记录人生轨迹', to: '/new/trajectory' },
  { label: '发布加密空间内容', to: '/euan/space' },
]

export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const createRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header
      className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-white/84 backdrop-blur-xl"
    >
      <div className="life-shell">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link to="/app" className="flex items-center text-[color:var(--foreground)] no-underline shrink-0">
            <Logo size="sm" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1" aria-label="工作台导航">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="px-3 py-1.5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--secondary)] transition-colors rounded-full"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Create button */}
            <div className="relative" ref={createRef}>
              <button
                onClick={() => setCreateOpen(!createOpen)}
                className="life-button life-button-primary text-sm font-medium cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="hidden sm:inline">新建</span>
              </button>

              {createOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 border border-[color:var(--border)] shadow-sm rounded-[var(--radius)] overflow-hidden z-50 bg-white"
                >
                  {createOptions.map(opt => (
                    <Link
                      key={opt.label}
                      to={opt.to}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[color:var(--foreground)] no-underline transition-colors hover:bg-[color:var(--secondary)]"
                      onClick={() => setCreateOpen(false)}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                      {opt.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <Link
              to="/search"
              className="p-1.5 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
              aria-label="搜索"
            >
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <circle cx="7.5" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.4" />
                <line x1="11.2" y1="11.2" x2="15" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </Link>

            {/* User avatar */}
            <button
              className="flex items-center gap-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
              onClick={() => navigate('/account')}
              aria-label="账号设置"
            >
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&auto=format"
                alt="euan"
                className="w-7 h-7 rounded-full object-cover"
              />
              <span className="hidden md:inline text-xs">euan</span>
            </button>

            {/* Mobile menu */}
            <button
              className="lg:hidden p-1.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="导航菜单"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                {menuOpen ? (
                  <>
                    <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden py-3 border-t border-[color:var(--border)]" aria-label="移动端工作台导航">
            {navLinks.map(link => (
              <Link
                key={link.to + 'mob'}
                to={link.to}
                className="block px-2 py-2.5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/search"
              className="block px-2 py-2.5 text-sm text-[color:var(--muted-foreground)] no-underline hover:text-[color:var(--foreground)]"
              onClick={() => setMenuOpen(false)}
            >
              搜索
            </Link>
            <Link
              to="/account"
              className="block px-2 py-2.5 text-sm text-[color:var(--muted-foreground)] no-underline hover:text-[color:var(--foreground)]"
              onClick={() => setMenuOpen(false)}
            >
              账号与备份
            </Link>
            {isAdmin() && (
              <Link
                to="/admin"
                className="block px-2 py-2.5 text-sm text-[color:var(--muted-foreground)] no-underline hover:text-[color:var(--foreground)]"
                onClick={() => setMenuOpen(false)}
              >
                管理后台
              </Link>
            )}
            <button
              className="block w-full text-left px-2 py-2.5 text-sm text-[color:var(--muted-foreground)]"
              onClick={() => { setMenuOpen(false); navigate('/') }}
            >
              公开主页
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
