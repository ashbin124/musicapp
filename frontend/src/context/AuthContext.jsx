import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearTokens, getAccessToken, setTokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      if (!getAccessToken()) {
        setLoading(false)
        return
      }
      try {
        const response = await api.get('/auth/me/')
        if (!cancelled) setUser(response.data)
      } catch {
        clearTokens()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadUser()

    const expire = () => {
      setUser(null)
      clearTokens()
    }
    window.addEventListener('wavebox:auth-expired', expire)
    return () => {
      cancelled = true
      window.removeEventListener('wavebox:auth-expired', expire)
    }
  }, [])

  async function login(username, password) {
    const response = await api.post('/auth/login/', { username, password })
    setTokens(response.data)
    const me = await api.get('/auth/me/')
    setUser(me.data)
  }

  async function register(username, password) {
    await api.post('/auth/register/', { username, password })
    await login(username, password)
  }

  function logout() {
    clearTokens()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      register,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
