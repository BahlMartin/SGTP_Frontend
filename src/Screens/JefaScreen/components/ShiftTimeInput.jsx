import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { adjustTime } from '../../../utils/shiftTime.utils'

export default function ShiftTimeInput({ id, label, value, onChange }) {
  return (
    <div className="jefa-screen__modal-field">
      <label htmlFor={id}>{label}</label>
      <div className="jefa-screen__time-input">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          pattern="([01][0-9]|2[0-3]):(00|30)"
          placeholder="HH:MM"
          title="Ingresá una hora válida en intervalos de 30 minutos, por ejemplo 07:30."
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="jefa-screen__time-stepper">
          <button
            type="button"
            aria-label={`Avanzar 30 minutos: ${label.toLowerCase()}`}
            onClick={() => onChange(adjustTime(value, 30))}
          >
            <ChevronUp aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Retroceder 30 minutos: ${label.toLowerCase()}`}
            onClick={() => onChange(adjustTime(value, -30))}
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </div>
      <span className="jefa-screen__time-hint">Formato 24 h; podés escribirlo o ajustarlo de a 30 minutos.</span>
    </div>
  )
}
