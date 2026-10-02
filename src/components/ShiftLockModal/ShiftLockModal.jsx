import React from 'react'
import { Clock, AlertTriangle, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './ShiftLockModal.css'

export default function ShiftLockModal({ user }) {
  const { logout } = useAuth()

  return (
    <div className="shift-lock">
      <div className="shift-lock__card">
        <div className="shift-lock__icon-wrap">
          <Clock className="shift-lock__icon" />
        </div>
        <h2 className="shift-lock__title">Acceso Restringido por Horario</h2>
        <p className="shift-lock__desc">
          Estimado/a <strong>{user?.nombre}</strong> (Rol: <strong>{user?.rol}</strong>), su acceso al sistema se encuentra restringido fuera de su franja laboral asignada:
        </p>

        <div className="shift-lock__info-box">
          <AlertTriangle className="shift-lock__info-icon" />
          <span className="shift-lock__info-text">
            Turno registrado: <strong>{user?.turno || `${user?.inicio_turno || '07:00'} a ${user?.fin_turno || '15:00'}`}</strong>
          </span>
        </div>

        <p className="shift-lock__note">
          Las extensiones por horas extras o rotación de turno deben ser habilitadas y validadas mediante una habilitación horaria autorizada por la <strong>Jefa de Laboratorio</strong> o el <strong>Administrador</strong>.
        </p>

        <div className="shift-lock__actions">
          <button className="shift-lock__btn-logout" onClick={logout}>
            <LogOut className="shift-lock__btn-icon" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  )
}
