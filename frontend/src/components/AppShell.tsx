import { ComponentType, FormEvent, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { isAuthenticated, login, logout } from '../api'
import { AdminIcon, ContinuingIcon, DashboardIcon, EnrollmentIcon, ProspectusIcon, TORIcon } from './Icons'

const MOBILE_BREAKPOINT = 1024
const SIDEBAR_STATE_KEY = 'ccb_sidebar_collapsed'
const RECENT_MENU_KEY = 'ccb_recent_menus'

const navItems: { path: string; label: string; icon: ComponentType }[] = [
  { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { path: '/admin', label: 'Admin', icon: AdminIcon },
  { path: '/prospectus', label: 'Prospectus', icon: ProspectusIcon },
  { path: '/enrollment', label: 'Enrollment', icon: EnrollmentIcon },
  { path: '/continuing', label: 'Continuing', icon: ContinuingIcon },
  { path: '/transcript', label: 'Transcript', icon: TORIcon },
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
        <path d="M9 8l-4 4 4 4M5 12h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'login') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 16l4-4-4-4M19 12H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return null
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

  if (!authed) {
    return (
      <div className="auth-layout">
        <section className="auth-card">
          <img src="/ccb_registrar_logo.png" alt="CCB Registrar" className="auth-logo" />
          <h1 style={{ textAlign: 'center' }}>Office of the Registrar System</h1>
          <p>Please log in using your Django superuser/staff account.</p>
          <form onSubmit={handleLogin} className="login-form auth-form">
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button type="submit" className="auth-login-btn">
              <Icon name="login" />
              <span>Login</span>
            </button>
            {authError && <p className="error-text">{authError}</p>}
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className={layoutClasses}>
      {isMobile && isMobileMenuOpen && <button className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu" />}

      <aside className={sidebarClasses}>
        <div className="sidebar-header">
          <img src="/ccb_registrar_logo.png" alt="CCB Registrar" className="brand-logo" />
          {!isMobile && (
            <button type="button" onClick={toggleSidebar} className="sidebar-toggle" aria-label="Toggle sidebar">
              <Icon name={isSidebarCollapsed ? 'chevronRight' : 'chevronLeft'} />
            </button>
          )}
        </div>

        <div className="sidebar-content">
          <nav className="sidebar-nav">
            {navItems.map(({ path, label, icon: ItemIcon }) => (
              <div key={path} className="nav-item-wrapper">
                <NavLink
                  to={path}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => {
                    recordRecentMenu(path, label)
                    if (isMobile) {
                      setIsMobileMenuOpen(false)
                    }
                  }}
                  title={isSidebarCollapsed && !isMobile ? label : ''}
                >
                  <span className="nav-icon">
                    <ItemIcon />
                  </span>
                  <span className="nav-label">{label}</span>
                </NavLink>
              </div>
            ))}
          </nav>
          <button type="button" onClick={handleLogout} className="logout-btn" title={isSidebarCollapsed && !isMobile ? 'Logout' : ''}>
            <span className="nav-icon icon-inline">
              <Icon name="logout" />
            </span>
            <span className="nav-label">{isSidebarCollapsed && !isMobile ? '' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-toolbar">
          {isMobile && (
            <button type="button" onClick={toggleSidebar} className="hamburger-btn" aria-label="Open menu">
              <Icon name="menu" />
            </button>
          )}
        </div>
        <Outlet />
      </main>
    </div>
  )
}
