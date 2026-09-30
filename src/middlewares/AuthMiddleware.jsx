import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthMiddleware() {
  const { isLogged, userData } = useAuth()

  // Si no está logueado, redirige a login.
  if (!isLogged) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
