import React from 'react'
import './ActiveStaffCard.css'

export default function ActiveStaffCard({ staffList = [] }) {
  const activeStaffCount = staffList.filter(
    (staffMember) => staffMember.estado === 'En turno'
  ).length

  return (
    <div className="jefa-screen__staff-card">
      <div className="jefa-screen__staff-header">
        <span className="jefa-screen__section-title">Personal activo y carga</span>
        <span className="jefa-screen__staff-count">
          {activeStaffCount} en turno
        </span>
      </div>

      <ul className="jefa-screen__staff-list">
        {staffList.slice(0, 4).map((staffMember) => (
          <li key={staffMember.id} className="jefa-screen__staff-item">
            <div className="jefa-screen__staff-info">
              <span
                className={`jefa-screen__staff-dot ${
                  staffMember.estado === 'En turno'
                    ? 'jefa-screen__staff-dot--active'
                    : 'jefa-screen__staff-dot--offline'
                }`}
              />
              <div className="jefa-screen__staff-titles">
                <span className="jefa-screen__staff-name">{staffMember.nombre}</span>
                <span className="jefa-screen__staff-subarea">
                  {staffMember.area} - {staffMember.estado}
                </span>
              </div>
            </div>
            <div className="jefa-screen__staff-stat">
              <span className="jefa-screen__staff-load-num">
                {staffMember.pacientesAtendidos}
              </span>
              <span className="jefa-screen__staff-load-lbl">atendidos</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
