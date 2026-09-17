import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ShiftLockModal from '../components/ShiftLockModal/ShiftLockModal'

export default function ShiftTimeMiddleware() {
  const { userData } = useAuth()

  // Admin y Jefa no tienen restricción por turno laboral
  if (!userData || userData.rol === 'Admin' || userData.rol === 'Jefa') {
    return <Outlet />
  }

  // Si los roles Admisión, Box o Secretaria están fuera de su horario asignado
  if (userData.dentro_horario === false) {
    return <ShiftLockModal user={userData} />
  }

  return <Outlet />
}
