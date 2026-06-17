import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import './LoginPage.css'

export default function LoginPage() {
  const { login, loginAsGuest } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('signin')

  const [signIn, setSignIn] = useState({ username: '', password: '', rememberMe: false })
  const [signUp, setSignUp] = useState({
    passkey: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    emailUpdates: false,
    agreed: false,
  })

  const [siError, setSiError] = useState('')
  const [siLoading, setSiLoading] = useState(false)
  const [suError, setSuError] = useState('')
  const [suLoading, setSuLoading] = useState(false)

  const handleSignIn = async (e) => {
    e.preventDefault()
    setSiError('')
    if (!signIn.username || !signIn.password) { setSiError('Username/email and password are required.'); return }
    setSiLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signIn.username.trim().toLowerCase(),
          password: signIn.password,
          remember_me: signIn.rememberMe,
        }),
      })
      const json = await res.json()
      if (json.status === 'success') {
        login({ username: json.username, role: json.role, token: json.token || null }, signIn.rememberMe)
        navigate('/')
      } else {
        setSiError(json.message || 'Sign in failed.')
      }
    } catch (err) {
      setSiError('Connection error. Please try again.')
    } finally {
      setSiLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setSuError('')
    if (!signUp.passkey || !signUp.username || !signUp.email || !signUp.password || !signUp.confirmPassword) {
      setSuError('All fields are required.'); return
    }
    if (signUp.password !== signUp.confirmPassword) {
      setSuError('Passwords do not match.'); return
    }
    if (!signUp.agreed) { setSuError('You must agree to the Terms & Conditions.'); return }
    setSuLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passkey_code: signUp.passkey.trim().toUpperCase(),
          username: signUp.username.trim().toLowerCase(),
          email: signUp.email.trim().toLowerCase(),
          password: signUp.password,
          email_updates: signUp.emailUpdates,
          accepted_terms: signUp.agreed,
        }),
      })
      const json = await res.json()
      if (json.status === 'success') {
        login({ username: json.username, role: json.role, token: json.token || null }, false)
        navigate('/')
      } else {
        setSuError(json.message || 'Account creation failed.')
      }
    } catch (err) {
      setSuError('Connection error. Please try again.')
    } finally {
      setSuLoading(false)
    }
  }

  return (
    <div className="lp-shell">
      <div className="lp-card">
        <div className="lp-logo">
          <img src="/SSLogo.png" alt="SpreadSlayer" className="lp-logo-img" />
        </div>
        <h1 className="lp-title">SpreadSlayer</h1>
        <p className="lp-sub">Multi-sport analytics platform</p>

        {/* Tab switcher */}
        <div className="lp-tabs">
          <button
            className={`lp-tab${tab === 'signin' ? ' active' : ''}`}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            className={`lp-tab${tab === 'signup' ? ' active' : ''}`}
            onClick={() => setTab('signup')}
          >
            Create Account
          </button>
        </div>

        {/* Sign In */}
        {tab === 'signin' && (
          <form className="lp-form" onSubmit={handleSignIn}>
            <div className="lp-field">
              <label className="lp-label">Username or Email</label>
              <input
                type="text"
                className="lp-input"
                placeholder="Enter your username or email"
                value={signIn.username}
                onChange={e => setSignIn(s => ({ ...s, username: e.target.value }))}
                autoComplete="username"
              />
            </div>
            <div className="lp-field">
              <label className="lp-label">Password</label>
              <input
                type="password"
                className="lp-input"
                placeholder="Enter your password"
                value={signIn.password}
                onChange={e => setSignIn(s => ({ ...s, password: e.target.value }))}
                autoComplete="current-password"
              />
            </div>
            <label className="lp-checkbox-row">
              <input
                type="checkbox"
                checked={signIn.rememberMe}
                onChange={e => setSignIn(s => ({ ...s, rememberMe: e.target.checked }))}
              />
              <span>Remember me for 30 days</span>
            </label>
            {siError && <div className="lp-error">{siError}</div>}
            <button type="submit" className="lp-btn-primary" disabled={siLoading}>
              {siLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Create Account */}
        {tab === 'signup' && (
          <form className="lp-form" onSubmit={handleSignUp}>
            <div className="lp-field">
              <label className="lp-label">Invite Code</label>
              <input
                type="text"
                className="lp-input lp-input-mono"
                placeholder="Enter your passkey code"
                value={signUp.passkey}
                onChange={e => setSignUp(s => ({ ...s, passkey: e.target.value }))}
                autoComplete="off"
              />
              <span className="lp-hint">Contact an admin to receive an invite code</span>
            </div>
            <div className="lp-field">
              <label className="lp-label">Username</label>
              <input
                type="text"
                className="lp-input"
                placeholder="Choose a username (3+ chars)"
                value={signUp.username}
                onChange={e => setSignUp(s => ({ ...s, username: e.target.value }))}
                autoComplete="username"
              />
            </div>
            <div className="lp-field">
              <label className="lp-label">Email</label>
              <input
                type="email"
                className="lp-input"
                placeholder="Enter your email address"
                value={signUp.email}
                onChange={e => setSignUp(s => ({ ...s, email: e.target.value }))}
                autoComplete="email"
              />
            </div>
            <div className="lp-field">
              <label className="lp-label">Password</label>
              <input
                type="password"
                className="lp-input"
                placeholder="Choose a password (6+ chars)"
                value={signUp.password}
                onChange={e => setSignUp(s => ({ ...s, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="lp-field">
              <label className="lp-label">Confirm Password</label>
              <input
                type="password"
                className="lp-input"
                placeholder="Confirm your password"
                value={signUp.confirmPassword}
                onChange={e => setSignUp(s => ({ ...s, confirmPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <label className="lp-checkbox-row">
              <input
                type="checkbox"
                checked={signUp.emailUpdates}
                onChange={e => setSignUp(s => ({ ...s, emailUpdates: e.target.checked }))}
              />
              <span>Send me picks updates and platform news</span>
            </label>
            <label className="lp-checkbox-row">
              <input
                type="checkbox"
                checked={signUp.agreed}
                onChange={e => setSignUp(s => ({ ...s, agreed: e.target.checked }))}
              />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noreferrer" className="lp-link">
                  Terms &amp; Conditions
                </a>
              </span>
            </label>
            {suError && <div className="lp-error">{suError}</div>}
            <button type="submit" className="lp-btn-primary" disabled={suLoading || !signUp.agreed}>
              {suLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Guest divider */}
        <div className="lp-divider">
          <span>or</span>
        </div>
        <button className="lp-btn-ghost" onClick={() => { loginAsGuest(); navigate('/') }}>
          View as Guest
          <span className="lp-guest-note"> — limited access</span>
        </button>
      </div>
    </div>
  )
}
