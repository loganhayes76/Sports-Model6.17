import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'ss_session_token'
const USER_KEY = 'ss_user'

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tryRestore = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      const sessionToken = sessionStorage.getItem(TOKEN_KEY)

      const activeToken = token || sessionToken

      if (activeToken) {
        try {
          const res = await fetch('/api/auth/validate-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: activeToken }),
          })
          const json = await res.json()
          if (json.status === 'success') {
            setAuth({ username: json.username, role: json.role, token: activeToken })
            setLoading(false)
            return
          } else {
            localStorage.removeItem(TOKEN_KEY)
            sessionStorage.removeItem(TOKEN_KEY)
          }
        } catch {}
      }

      const cached = sessionStorage.getItem(USER_KEY)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed && parsed.username && parsed.role === 'guest') {
            setAuth(parsed)
            setLoading(false)
            return
          }
        } catch {}
      }

      setLoading(false)
    }
    tryRestore()
  }, [])

  const login = (user, rememberMe = false) => {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)

    if (user.token) {
      if (rememberMe) {
        localStorage.setItem(TOKEN_KEY, user.token)
      } else {
        sessionStorage.setItem(TOKEN_KEY, user.token)
      }
    }
    sessionStorage.setItem(USER_KEY, JSON.stringify(user))
    setAuth(user)
  }

  const loginAsGuest = () => {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    const guest = { username: 'Guest', role: 'guest', token: null }
    sessionStorage.setItem(USER_KEY, JSON.stringify(guest))
    setAuth(guest)
  }

  const logout = async () => {
    const token = auth?.token
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      } catch {}
    }
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    setAuth(null)
  }

  return (
    <AuthContext.Provider value={{ auth, loading, login, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
