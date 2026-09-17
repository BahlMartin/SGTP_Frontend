import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AlreadyAuthMiddleware() {
  const { isLogged, userData } = useAuth()

  if (isLogged && userData) {
    switch (userData.rol) {
      case 'Admision':
        return <Navigate to="/admision" replace />
      case 'Box':
        return <Navigate to="/box" replace />
      case 'Jefa':
      case 'Admin':
        return <Navigate to="/supervision" replace />
      case 'Secretaria':
        return <Navigate to="/reportes" replace />
      default:
        return <Navigate to="/admision" replace />
    }
  }

  return <Outlet />
}
