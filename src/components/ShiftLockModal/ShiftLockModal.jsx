import React from 'react'
import { Clock, AlertTriangle, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './ShiftLockModal.css'

export default function ShiftLockModal({ user }) {
  const { logout, toggleShiftLockSimulation } = useAuth()

  return (
    <div className="shift-lock">
      <div className="shift-lock__card">
        <div className="shift-lock__icon-wrap">
          <Clock size={42} className="shift-lock__icon" />
        </div>
        <h2 className="shift-lock__title">Acceso Restringido por Horario</h2>
        <p className="shift-lock__desc">
          Estimado/a <strong>{user?.nombre}</strong> (Rol: <strong>{user?.rol}</strong>), su acceso al sistema se encuentra restringido fuera de su turno laboral asignado:
        </p>

        <div className="shift-lock__info-box">
          <AlertTriangle size={18} className="shift-lock__info-icon" />
          <span className="shift-lock__info-text">Turno registrado: <strong>{user?.turno || 'No asignado'}</strong></span>
        </div>

        <p className="shift-lock__note">
          Las extensiones por horas extras o rotación de turno deben ser habilitadas y validadas por el rol de <strong>Jefa</strong> o <strong>Admin</strong>.
        </p>

        <div className="shift-lock__actions">
          <button className="shift-lock__btn-toggle" onClick={toggleShiftLockSimulation}>
            <RefreshCw size={16} />
            Simular ingreso dentro de turno (Demo)
          </button>
          <button className="shift-lock__btn-logout" onClick={logout}>
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  )
}
