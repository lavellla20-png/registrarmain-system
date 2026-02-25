import { FormEvent, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { isAuthenticated, login, logout } from '../api'

const MOBILE_BREAKPOINT = 1024
const SIDEBAR_STATE_KEY = 'ccb_sidebar_collapsed'
const RECENT_MENU_KEY = 'ccb_recent_menus'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/admin', label: 'Admin', icon: 'grid' },
  { path: '/prospectus', label: 'Prospectus', icon: 'book' },
  { path: '/enrollment', label: 'Enrollment', icon: 'userPlus' },
  { path: '/continuing', label: 'Continuing', icon: 'trendUp' },
]

function Icon({ name }: { name: string }) {
  if (name === 'menu') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'chevronLeft') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'chevronRight') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'logout') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 16l4-4-4-4M19 12H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'grid') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (name === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 13h7v7H4zM4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7z" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (name === 'book') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5a3 3 0 0 1 3-3h13v18H7a3 3 0 0 0-3 3z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M7 2v18" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (name === 'userPlus') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 19a5 5 0 0 0-10 0" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M19 8v6M16 11h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16l5-5 4 4 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AppShell() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authed, setAuthed] = useState(isAuthenticated())
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_STATE_KEY) === 'true')
  const navigate = useNavigate()

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT
      setIsMobile(mobile)
      if (!mobile) {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    try {
      await login(username, password)
      setAuthed(true)
      setIsMobileMenuOpen(false)
      navigate('/dashboard')
    } catch {
      setAuthError('Login failed. Check username/password.')
    }
  }

  const handleLogout = () => {
    logout()
    setAuthed(false)
    setUsername('')
    setPassword('')
    setIsMobileMenuOpen(false)
  }

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen((current) => !current)
      return
    }
    setIsSidebarCollapsed((current) => {
      const next = !current
      localStorage.setItem(SIDEBAR_STATE_KEY, String(next))
      return next
    })
  }

  const layoutClasses = `layout${!isMobile && isSidebarCollapsed ? ' layout-collapsed' : ''}`
  const sidebarClasses = `sidebar${isMobile && isMobileMenuOpen ? ' sidebar-mobile-open' : ''}`

  const recordRecentMenu = (path: string, label: string) => {
    try {
      const existingRaw = localStorage.getItem(RECENT_MENU_KEY)
      const existing = existingRaw ? (JSON.parse(existingRaw) as Array<{ path: string; label: string }>) : []
      const filtered = existing.filter((item) => item.path !== path)
      const updated = [{ path, label }, ...filtered].slice(0, 5)
      localStorage.setItem(RECENT_MENU_KEY, JSON.stringify(updated))
    } catch {
      // no-op for storage parsing issues
    }
  }

  return (
    <div className={layoutClasses}>
      {isMobile && isMobileMenuOpen && <button className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu" />}

      <aside className={sidebarClasses}>
        <div className="sidebar-header">
          <h2 className="brand-text">CCB Registrar</h2>
          {!isMobile && authed && (
            <button type="button" onClick={toggleSidebar} className="sidebar-toggle" aria-label="Toggle sidebar">
              <Icon name={isSidebarCollapsed ? 'chevronRight' : 'chevronLeft'} />
            </button>
          )}
        </div>

        {!authed ? (
          <form onSubmit={handleLogin} className="login-form">
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button type="submit">Login</button>
            {authError && <p className="error-text">{authError}</p>}
          </form>
        ) : (
          <div className="sidebar-content">
            <nav className="sidebar-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => {
                    recordRecentMenu(item.path, item.label)
                    if (isMobile) {
                      setIsMobileMenuOpen(false)
                    }
                  }}
                >
                  <span className="nav-icon">
                    <Icon name={item.icon} />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <button type="button" onClick={handleLogout} className="logout-btn">
              <span className="nav-icon icon-inline">
                <Icon name="logout" />
              </span>
              <span className="nav-label">{isSidebarCollapsed && !isMobile ? '' : 'Logout'}</span>
            </button>
          </div>
        )}
      </aside>

      <main className="main">
        {authed && (
          <div className="main-toolbar">
            {isMobile && (
              <button type="button" onClick={toggleSidebar} className="hamburger-btn" aria-label="Open menu">
                <Icon name="menu" />
              </button>
            )}
          </div>
        )}

        {authed ? (
          <Outlet />
        ) : (
          <section className="card">
            <h1>Local Registrar System</h1>
            <p>Please log in using your Django superuser/staff account.</p>
          </section>
        )}
      </main>
    </div>
  )
}
