import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'

export default function GuestGate({ children, requireRole = null }) {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const role = auth?.role || 'guest'

  const ROLE_LEVEL = { guest: 0, member: 1, dfs: 2, admin: 3 }
  const REQUIRED = ROLE_LEVEL[requireRole] ?? 0

  const handleSignIn = async () => {
    await logout()
    navigate('/login')
  }

  if (requireRole && ROLE_LEVEL[role] < REQUIRED) {
    if (role === 'guest') {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '320px', gap: '16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px' }}>🔐</div>
          <div style={{ fontWeight: 700, fontSize: '20px' }}>Sign in required</div>
          <div style={{ fontSize: '14px', color: 'var(--ss-text-muted)', maxWidth: '340px' }}>
            Create a free account or sign in to access this feature.
          </div>
          <button
            onClick={handleSignIn}
            style={{
              padding: '10px 24px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--ss-teal), #0369a1)',
              color: '#fff', fontWeight: 700, fontSize: '14px',
              border: 'none', cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </div>
      )
    }
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '320px', gap: '16px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px' }}>🚫</div>
        <div style={{ fontWeight: 700, fontSize: '20px' }}>Access Restricted</div>
        <div style={{ fontSize: '14px', color: 'var(--ss-text-muted)', maxWidth: '340px' }}>
          Your account ({role}) does not have access to this section. Contact an admin to upgrade.
        </div>
      </div>
    )
  }

  return children
}
