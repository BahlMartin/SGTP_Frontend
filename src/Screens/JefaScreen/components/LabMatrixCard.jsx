import React from 'react'
import './LabMatrixCard.css'

export default function LabMatrixCard({ labStudies = [] }) {
  return (
    <div className="jefa-screen__matrix-card">
      <div className="jefa-screen__matrix-header">
        <h3 className="jefa-screen__section-title">Estudios de laboratorio</h3>
        <span className="jefa-screen__matrix-count">Top 5</span>
      </div>
      <ul className="jefa-screen__matrix-table">
        {labStudies.map((study) => (
          <li key={study.nombre} className="jefa-screen__matrix-row">
            <div className="jefa-screen__matrix-cat">
              <span className="jefa-screen__matrix-cat-name">{study.nombre}</span>
            </div>
            <div className="jefa-screen__matrix-stat">
              <span className="jefa-screen__matrix-total">{study.total}</span>
              <span className="jefa-screen__matrix-total-label">estudios</span>
            </div>
          </li>
        ))}
      </ul>
      {labStudies.length === 0 && (
        <p className="jefa-screen__matrix-empty">No hay estudios registrados.</p>
      )}
    </div>
  )
}
