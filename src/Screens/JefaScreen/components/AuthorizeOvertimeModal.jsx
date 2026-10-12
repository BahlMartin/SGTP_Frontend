import React, { useState } from 'react'
import { CalendarDays, Clock3, X, Zap } from 'lucide-react'
import MonthlyPlanningTab from './MonthlyPlanningTab/MonthlyPlanningTab'
import SingleExceptionTab from './SingleExceptionTab/SingleExceptionTab'
import { formatDiasLaborales } from '../../../utils/shiftValidation.utils'
import './AuthorizeOvertimeModal.css'

export default function AuthorizeOvertimeModal({
  staffMember,
  isOpen,
  onClose,
  onSubmit,
  onRevoke
}) {
  const [activeTab, setActiveTab] = useState('monthly') // 'monthly' | 'single'

  if (!isOpen || !staffMember) return null

  const diasLaboralesTexto = formatDiasLaborales(staffMember?.dias_laborales_detalle)
  const turnoRegularTexto = `${String(staffMember?.inicio_turno || '08:00').slice(0, 5)} - ${String(staffMember?.fin_turno || '16:00').slice(0, 5)}`

  return (
    <div className="jefa-screen__modal-overlay">
      <div
        className="jefa-screen__modal-card jefa-screen__modal-card--overtime"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overtime-modal-title"
      >
        <button
          type="button"
          className="jefa-screen__modal-close"
          onClick={onClose}
          aria-label="Cerrar modal de horario excepcional"
        >
          <X className="jefa-screen__modal-close-icon" />
        </button>

        {/* Encabezado */}
        <div className="overtime-modal__header">
          <Clock3 className="overtime-modal__header-icon" />
          <div>
            <h3 id="overtime-modal-title" className="jefa-screen__modal-title">
              Planificación y Autorización de Horas Extras
            </h3>
            <p className="jefa-screen__modal-desc">
              Asignación extraordinaria y cómputo de turnos adicionales fuera del horario habitual.
            </p>
          </div>
        </div>

        {/* Ficha contextual del personal */}
        <div className="overtime-modal__staff-card">
          <div className="overtime-modal__staff-main">
            <span className="overtime-modal__staff-name">{staffMember.nombre}</span>
            <span className="overtime-modal__staff-role">{staffMember.rol}</span>
          </div>
          <div className="overtime-modal__staff-sub">
            <span>Matrícula: {staffMember.matricula || 'No informada'}</span>
            <span className="overtime-modal__staff-shift">
              Turno habitual: <strong>{turnoRegularTexto}</strong> ({diasLaboralesTexto})
            </span>
          </div>
        </div>

        {/* Selector de modo por pestañas */}
        <div className="overtime-modal__mode-tabs">
          <button
            type="button"
            className={`overtime-modal__tab-btn ${
              activeTab === 'monthly' ? 'overtime-modal__tab-btn--active' : ''
            }`}
            onClick={() => setActiveTab('monthly')}
          >
            <CalendarDays className="overtime-modal__tab-icon" />
            Planificación Mensual (Calendario)
          </button>
          <button
            type="button"
            className={`overtime-modal__tab-btn ${
              activeTab === 'single' ? 'overtime-modal__tab-btn--active' : ''
            }`}
            onClick={() => setActiveTab('single')}
          >
            <Zap className="overtime-modal__tab-icon" />
            Excepción de 1 Día
          </button>
        </div>

        {/* Renderizado condicional del subcomponente según pestaña */}
        {activeTab === 'monthly' ? (
          <MonthlyPlanningTab
            staffMember={staffMember}
            diasLaboralesTexto={diasLaboralesTexto}
            onSubmit={onSubmit}
            onClose={onClose}
          />
        ) : (
          <SingleExceptionTab
            staffMember={staffMember}
            onSubmit={onSubmit}
            onRevoke={onRevoke}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
