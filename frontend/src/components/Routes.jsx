import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth() {
  const { loading, isAuthenticated } = useAuth()
  if (loading) return <div className="loading-screen">Loading</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { user } = useAuth()
  if (!user?.is_staff) return <Navigate to="/" replace />
  return <Outlet />
}
