import React from 'react'
import { Clock, AlertTriangle, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './ShiftLockModal.css'

export default function ShiftLockModal({ user }) {
  const { logout, toggleShiftLockSimulation } = useAuth()

  return (
    <div className="shift-lock-overlay">
      <div className="shift-lock-card">
        <div className="shift-lock-icon-wrap">
          <Clock size={42} className="shift-lock-icon" />
        </div>
        <h2>Acceso Restringido por Horario</h2>
        <p className="shift-lock-desc">
          Estimado/a <strong>{user?.nombre}</strong> (Rol: <strong>{user?.rol}</strong>), su acceso al sistema se encuentra restringido fuera de su turno laboral asignado:
        </p>

        <div className="shift-info-box">
          <AlertTriangle size={18} className="warn-icon" />
          <span>Turno registrado: <strong>{user?.turno || 'No asignado'}</strong></span>
        </div>

        <p className="shift-note">
          Las extensiones por horas extras o rotación de turno deben ser habilitadas y validadas por el rol de <strong>Jefa</strong> o <strong>Admin</strong>.
        </p>

        <div className="shift-actions">
          <button className="btn-shift-toggle" onClick={toggleShiftLockSimulation}>
            <RefreshCw size={16} />
            Simular ingreso dentro de turno (Demo)
          </button>
          <button className="btn-shift-logout" onClick={logout}>
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  )
}
