import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHomePathByRole } from '../utils/navigation'

export default function AlreadyAuthMiddleware() {
  const { isLogged, userData } = useAuth()

  if (isLogged && userData) {
    return <Navigate to={getHomePathByRole(userData.rol)} replace />
  }

  return <Outlet />
}
