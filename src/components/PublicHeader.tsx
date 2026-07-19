import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { useCurrentUser, clearCurrentUser } from '../auth'

const navLinks = [
  { label: '主页', to: '/euan' },
  { label: '笔记与文章', to: '/euan/pkm' },
  { label: '随想', to: '/euan/thoughts' },
  { label: '日记', to: '/euan/diary' },
  { label: '人生轨迹', to: '/euan/trajectory' },
  { label: '足迹地图', to: '/euan/map' },
  { label: '飞行轨迹', to: '/euan/flights' },
  { label: '独立空间', to: '/euan/space' },
  { label: '关于', to: '/about' },
]

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const currentUser = useCurrentUser()

  function handleLogout() {
    clearCurrentUser()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-white/82 backdrop-blur-xl"
    >
      <div className="life-shell max-w-5xl">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center text-[color:var(--foreground)] no-underline">
            <Logo size="sm" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="主导航">
            {navLinks.map(link => {
              const active = location.pathname === link.to
              return (
                <Link
                  key={link.to + link.label}
                  to={link.to}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    active
                      ? 'text-[color:var(--foreground)] bg-[color:var(--secondary)] font-medium'
                      : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            {currentUser ? (
              <button type="button" onClick={handleLogout} className="life-button ml-2 text-sm">
                登出
              </button>
            ) : (
              <Link to="/login" className="life-button ml-2 text-sm">
                登录
              </Link>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="菜单"
            aria-expanded={menuOpen}
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

        {/* Mobile nav */}
        {menuOpen && (
          <nav
            className="md:hidden py-3 border-t border-[color:var(--border)]"
            aria-label="移动端主导航"
          >
            {navLinks.map(link => (
              <Link
                key={link.to + link.label + 'mobile'}
                to={link.to}
                className="block px-2 py-2.5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {currentUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 block w-full px-2 py-2.5 text-left text-sm text-[color:var(--muted-foreground)]"
              >
                登出 @{currentUser}
              </button>
            ) : (
              <Link
                to="/login"
                className="mt-2 block px-2 py-2.5 text-sm font-medium text-[color:var(--primary)]"
                onClick={() => setMenuOpen(false)}
              >
                登录 →
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
