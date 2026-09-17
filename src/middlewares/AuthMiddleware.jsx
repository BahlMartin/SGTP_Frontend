import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthMiddleware() {
  const { isLogged } = useAuth()

  if (!isLogged) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
