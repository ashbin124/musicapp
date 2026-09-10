import { Music2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { BRAND_NAME } from '../config'
import { useAuth } from '../context/AuthContext'

function AuthCard({ mode }) {
  const isRegister = mode === 'register'
  const { login, register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isRegister) await register(username, password)
      else await login(username, password)
      navigate('/')
    } catch (err) {
      setError(getErrorMessage(err, 'Authentication failed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand auth-card__brand">
          <span className="brand__mark"><Music2 size={24} /></span>
          <span>{BRAND_NAME}</span>
        </div>
        <h1>{isRegister ? 'Create account' : 'Sign in'}</h1>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>
          {isRegister ? 'Register' : 'Login'}
        </button>
        <p className="auth-card__switch">
          {isRegister ? 'Already registered?' : 'Need an account?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Login' : 'Register'}
          </Link>
        </p>
      </form>
    </main>
  )
}

export function LoginPage() {
  return <AuthCard mode="login" />
}

export function RegisterPage() {
  return <AuthCard mode="register" />
}
