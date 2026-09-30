import React from 'react'
import { Tv } from 'lucide-react'
import './BoxControlCard.css'

export default function BoxControlCard({
  currentBoxNumber,
  onSelectBox,
  currentStatus,
  onStatusChange,
  disabled = false
}) {
  return (
    <div className="box-control-card">
      <div className="box-control-card__header">
        <Tv className="box-control-card__header-icon" />
        <h2 className="box-control-card__title">Panel de control de box</h2>
      </div>

      <div className="box-control-card__select-group">
        <label htmlFor="box-assigned-select" className="box-control-card__select-label">
          Box asignado
        </label>
        <select
          id="box-assigned-select"
          className="box-control-card__select-input"
          value={currentBoxNumber}
          onChange={(event) => onSelectBox(Number(event.target.value))}
          disabled={disabled}
        >
          <option value={1}>Box 1</option>
          <option value={2}>Box 2</option>
          <option value={3}>Box 3</option>
          <option value={4}>Box 4</option>
        </select>
      </div>

      <div className="box-control-card__status-buttons">
        <button
          type="button"
          className={`box-control-card__status-btn box-control-card__status-btn--disponible ${
            currentStatus === 'Disponible' ? 'box-control-card__status-btn--disponible-active' : ''
          }`}
          onClick={() => onStatusChange('Disponible')}
          disabled={disabled}
        >
          Disponible
        </button>
        <button
          type="button"
          className={`box-control-card__status-btn box-control-card__status-btn--atencion ${
            currentStatus === 'En atencion' ? 'box-control-card__status-btn--atencion-active' : ''
          }`}
          onClick={() => onStatusChange('En atencion')}
          disabled={disabled}
        >
          En atencion
        </button>
        <button
          type="button"
          className={`box-control-card__status-btn box-control-card__status-btn--fuera ${
            currentStatus === 'Fuera de servicio' ? 'box-control-card__status-btn--fuera-active' : ''
          }`}
          onClick={() => onStatusChange('Fuera de servicio')}
          disabled={disabled}
        >
          Fuera de servicio
        </button>
      </div>
    </div>
  )
}
