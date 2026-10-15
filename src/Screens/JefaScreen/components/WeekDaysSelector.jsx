import React from 'react'
import { DIAS_SEMANA_CORTO, formatDiasLaborales } from '../../../utils/shiftValidation.utils'
import './WeekDaysSelector.css'

export default function WeekDaysSelector({
  selectedDays = [],
  onChange,
  label = 'Días que trabaja en la semana:',
  disabled = false,
  required = false
}) {
  const toggleDay = (dayIndex) => {
    if (disabled) return
    const isSelected = selectedDays.includes(dayIndex)
    let updated
    if (isSelected) {
      updated = selectedDays.filter((d) => d !== dayIndex)
    } else {
      updated = [...selectedDays, dayIndex].sort((a, b) => a - b)
    }
    onChange(updated)
  }

  const setPreset = (presetDays) => {
    if (disabled) return
    onChange([...presetDays])
  }

  const summary = formatDiasLaborales(selectedDays)

  return (
    <div className="jefa-screen__days-field">
      <div className="jefa-screen__days-header">
        <label className="jefa-screen__days-label">
          {label} {required && <span className="jefa-screen__required">*</span>}
        </label>
        <span className="jefa-screen__days-summary" title={summary}>
          {summary}
        </span>
      </div>

      <div className="jefa-screen__days-selector" role="group" aria-label="Seleccionar días laborales">
        {DIAS_SEMANA_CORTO.map((diaNombre, idx) => {
          const isSelected = selectedDays.includes(idx)
          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              className={`jefa-screen__day-btn ${isSelected ? 'jefa-screen__day-btn--selected' : ''}`}
              onClick={() => toggleDay(idx)}
              aria-pressed={isSelected}
              title={`Alternar ${diaNombre}`}
            >
              {diaNombre}
            </button>
          )
        })}
      </div>

      <div className="jefa-screen__days-shortcuts">
        <button
          type="button"
          disabled={disabled}
          className="jefa-screen__days-shortcut-btn"
          onClick={() => setPreset([0, 1, 2, 3, 4])}
        >
          Lun a Vie
        </button>
        <button
          type="button"
          disabled={disabled}
          className="jefa-screen__days-shortcut-btn"
          onClick={() => setPreset([0, 1, 2, 3, 4, 5])}
        >
          Lun a Sáb
        </button>
        <button
          type="button"
          disabled={disabled}
          className="jefa-screen__days-shortcut-btn"
          onClick={() => setPreset([0, 1, 2, 3, 4, 5, 6])}
        >
          Toda la semana
        </button>
        <button
          type="button"
          disabled={disabled}
          className="jefa-screen__days-shortcut-btn jefa-screen__days-shortcut-btn--clear"
          onClick={() => setPreset([])}
        >
          Desmarcar
        </button>
      </div>
    </div>
  )
}
