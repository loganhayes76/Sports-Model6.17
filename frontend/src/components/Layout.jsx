import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import './Layout.css'

const ROLE_LEVEL = { guest: 0, member: 1, dfs: 2, admin: 3 }

const NAV_GROUPS = [
  {
    label: 'SPORTS',
    items: [
      { to: '/', label: 'Home', icon: '🏠', exact: true },
      { to: '/mlb', label: 'MLB', icon: '⚾' },
      { to: '/nba', label: 'NBA', icon: '🏀' },
      { to: '/ncaa', label: 'NCAA', icon: '🎓' },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { to: '/dfs', label: 'DFS Tools', icon: '🎯', minRole: 'dfs' },
      { to: '/parlay-grader', label: 'Parlay Grader', icon: '🎲' },
      { to: '/master-board', label: 'Master Board', icon: '📋', minRole: 'member' },
      { to: '/tracker', label: 'Tracker', icon: '📈', minRole: 'member' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { to: '/admin', label: 'Admin', icon: '⚙️', minRole: 'admin' },
    ],
  },
]

const ROLE_COLORS = {
  admin: '#f87171',
  dfs: '#84cc16',
  member: 'var(--ss-teal)',
  guest: 'var(--ss-text-muted)',
}

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: '🏠', exact: true },
  { to: '/mlb', label: 'MLB', icon: '⚾' },
  { to: '/nba', label: 'NBA', icon: '🏀' },
  { to: '/ncaa', label: 'NCAA', icon: '🎓' },
  { to: '/parlay-grader', label: 'Grader', icon: '🎲' },
]

export default function Layout() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const role = auth?.role || 'guest'
  const userLevel = ROLE_LEVEL[role] ?? 0

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const canSee = (item) => {
    if (!item.minRole) return true
    return userLevel >= (ROLE_LEVEL[item.minRole] ?? 0)
  }

  return (
    <div className="ss-shell">
      {/* ── Header ── */}
      <header className="ss-header">
        <NavLink to="/" className="ss-header-logo">
          <img src="/SSLogo.png" alt="SpreadSlayer" />
        </NavLink>
        <div className="ss-header-right">
          <span className="ss-version-badge">v0.20.0</span>
          {auth && role !== 'guest' ? (
            <div className="ss-user-pill">
              <span className="ss-user-name">{auth.username}</span>
              <span className="ss-user-role" style={{ color: ROLE_COLORS[role] || 'var(--ss-text-muted)' }}>
                {role}
              </span>
              <button className="ss-signout-btn" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          ) : auth && role === 'guest' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--ss-text-muted)', fontWeight: 600 }}>Guest</span>
              <button className="ss-header-signin-btn" onClick={handleLogout}>
                Sign In
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="ss-body">
        {/* Desktop Sidebar */}
        <nav className="ss-sidebar">
          {NAV_GROUPS.map((group) => {
            const visible = group.items.filter(canSee)
            if (!visible.length) return null
            return (
              <div key={group.label} className="ss-nav-group">
                <div className="ss-nav-group-label">{group.label}</div>
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      'ss-nav-link' + (isActive ? ' active' : '')
                    }
                  >
                    <span className="ss-nav-icon">{item.icon}</span>
                    <span className="ss-nav-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )
          })}

          {/* Sidebar sign in prompt for guests */}
          {role === 'guest' && (
            <div style={{ padding: '20px 12px', marginTop: 'auto' }}>
              <button onClick={handleLogout} style={{
                display: 'block', width: '100%', textAlign: 'center', padding: '10px',
                borderRadius: '10px', border: '1px solid var(--ss-teal)', cursor: 'pointer',
                color: 'var(--ss-teal)', fontWeight: 700, fontSize: '13px',
                background: 'transparent',
              }}>
                Sign In
              </button>
            </div>
          )}
        </nav>

        {/* Page Content */}
        <main className="ss-main">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="ss-bottom-nav">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              'ss-bottom-link' + (isActive ? ' active' : '')
            }
          >
            <span className="ss-nav-icon">{item.icon}</span>
            <span className="ss-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
