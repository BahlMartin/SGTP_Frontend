import React from 'react'
import { Calendar } from 'lucide-react'
import { getTodayLocalDateString } from '../../../utils/formatters'
import './ActiveStaffCard.css'

export default function ActiveStaffCard({
  staffList = [],
  selectedDate = '',
  onDateChange = () => {},
  workloadByStaff = { ticketsIssuedByStaff: {}, patientsAttendedByBoxStaff: {} },
  isLoading = false
}) {
  const todayStr = getTodayLocalDateString()
  const isToday = !selectedDate || selectedDate === todayStr
  const visibleStaff = staffList.filter((staffMember) => staffMember.rol !== 'Admin')
  const activeStaffCount = visibleStaff.filter((staffMember) =>
    staffMember.disponible ?? staffMember.activo
  ).length

  return (
    <div className="jefa-screen__staff-card">
      <div className="jefa-screen__staff-header">
        <div className="jefa-screen__staff-header-left">
          <span className="jefa-screen__section-title">Personal y carga</span>
          <span className="jefa-screen__staff-count">
            {activeStaffCount} disponibles / {visibleStaff.length} integrantes
          </span>
        </div>
        <div className="jefa-screen__date-controls">
          <div className="jefa-screen__date-picker-wrap" title="Seleccionar fecha de atención">
            <Calendar size={13} className="jefa-screen__date-icon" />
            <input
              type="date"
              className="jefa-screen__date-input"
              value={selectedDate || todayStr}
              onChange={(e) => onDateChange(e.target.value)}
              max={todayStr}
              aria-label="Filtrar personal por fecha"
            />
          </div>
          {!isToday && (
            <button
              type="button"
              className="jefa-screen__date-today-btn"
              onClick={() => onDateChange(todayStr)}
              title="Volver a la fecha de hoy"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="jefa-screen__staff-loading">
          <span className="jefa-screen__mini-spinner" />
          <span>Cargando atención del día...</span>
        </div>
      ) : (
        <ul className="jefa-screen__staff-list">
          {visibleStaff.map((staffMember) => {
            const statusLabel = !staffMember.activo
              ? (staffMember.cant_intentos >= 3 ? 'Cuenta bloqueada' : 'Cuenta inactiva')
              : staffMember.dentro_horario === false
                ? 'Fuera de horario'
                : 'En horario'
            const statusClass = !staffMember.activo
              ? 'jefa-screen__staff-dot--blocked'
              : staffMember.dentro_horario === false
                ? 'jefa-screen__staff-dot--outside'
                : 'jefa-screen__staff-dot--active'
            const attendsPatients = !['Jefa', 'Secretaria'].includes(staffMember.rol)
            const isAdmissionStaff = staffMember.rol === 'Admision'
            const workload = isAdmissionStaff
              ? (workloadByStaff.ticketsIssuedByStaff?.[staffMember.id] ?? workloadByStaff.ticketsIssuedByStaff?.[String(staffMember.id)] ?? 0)
              : (workloadByStaff.patientsAttendedByBoxStaff?.[staffMember.id] ?? workloadByStaff.patientsAttendedByBoxStaff?.[String(staffMember.id)] ?? 0)
            const workloadLabel = isAdmissionStaff ? 'tickets emitidos' : 'pacientes atendidos'

          return (
            <li key={staffMember.id} className="jefa-screen__staff-item">
                <div className="jefa-screen__staff-info">
                  <span
                    className={`jefa-screen__staff-dot ${statusClass}`}
                    role="img"
                    aria-label={statusLabel}
                  />
                  <div className="jefa-screen__staff-titles">
                    <span className="jefa-screen__staff-name">{staffMember.nombre}</span>
                    <span className="jefa-screen__staff-subarea">
                      {staffMember.rol} · {statusLabel}
                    </span>
                  </div>
                </div>
                {attendsPatients && (
                  <div className="jefa-screen__staff-stat">
                    <span className="jefa-screen__staff-load-num">
                      {workload}
                    </span>
                    <span className="jefa-screen__staff-load-lbl">{workloadLabel}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {visibleStaff.length === 0 && !isLoading && (
        <p className="jefa-screen__staff-empty">No hay personal registrado.</p>
      )}
    </div>
  )
}
