import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleMiddleware({ allowedRoles = [] }) {
  const { userData } = useAuth()

  if (!userData) {
    return <Navigate to="/login" replace />
  }

  // Admin tiene acceso total
  if (userData.rol === 'Admin') {
    return <Outlet />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userData.rol)) {
    return <Navigate to="/404" replace />
  }

  return <Outlet />
}
