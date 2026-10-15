import React from 'react'
import { DIAS_SEMANA_LETRAS } from '../../../utils/shiftValidation.utils'
import './OvertimeMonthCalendar.css'

export default function OvertimeMonthCalendar({
  anio,
  mes,
  diasActivosSet,
  onToggleDia,
  horasDiarias = 0,
  diasLaborales = [0, 1, 2, 3, 4]
}) {
  const primerDiaMes = new Date(anio, mes - 1, 1)
  const totalDias = new Date(anio, mes, 0).getDate()

  // 0 = Lunes, 1 = Martes, ..., 6 = Domingo
  const diaInicioSemana = primerDiaMes.getDay() === 0 ? 6 : primerDiaMes.getDay() - 1

  const celdas = []
  // Celdas vacías al inicio para alinear con el día de la semana correspondiente
  for (let i = 0; i < diaInicioSemana; i++) {
    celdas.push({ dia: null, fechaStr: null, esFinDeSemana: false })
  }

  for (let d = 1; d <= totalDias; d++) {
    const mesStr = String(mes).padStart(2, '0')
    const diaStr = String(d).padStart(2, '0')
    const fechaStr = `${anio}-${mesStr}-${diaStr}`

    const fechaObj = new Date(anio, mes - 1, d)
    const diaSemanaNum = fechaObj.getDay() === 0 ? 6 : fechaObj.getDay() - 1
    const esLaboral = diasLaborales.includes(diaSemanaNum)
    const esFinDeSemana = diaSemanaNum >= 5 // Sábado o Domingo

    celdas.push({
      dia: d,
      fechaStr,
      esLaboral,
      esFinDeSemana
    })
  }

  return (
    <div className="overtime-calendar">
      <div className="overtime-calendar__weekdays">
        {DIAS_SEMANA_LETRAS.map((letra, idx) => {
          const isWeekend = idx >= 5
          return (
            <span
              key={idx}
              className={`overtime-calendar__weekday-head ${
                isWeekend ? 'overtime-calendar__weekday-head--weekend' : ''
              }`}
            >
              {letra}
            </span>
          )
        })}
      </div>

      <div className="overtime-calendar__grid">
        {celdas.map((celda, idx) => {
          if (!celda.dia) {
            return (
              <div
                key={`empty-${idx}`}
                className="overtime-calendar__cell overtime-calendar__cell--empty"
              />
            )
          }

          const isActivo = diasActivosSet.has(celda.fechaStr)
          let cellModifier = ''
          if (isActivo) {
            cellModifier = 'overtime-calendar__cell--active'
          } else if (celda.esFinDeSemana) {
            cellModifier = 'overtime-calendar__cell--weekend'
          }

          return (
            <button
              key={celda.fechaStr}
              type="button"
              className={`overtime-calendar__cell ${cellModifier}`}
              onClick={() => onToggleDia(celda.fechaStr)}
              title={
                isActivo
                  ? `Día ${celda.dia}: Habilitado (+${horasDiarias}h extra). Clic para desmarcar.`
                  : `Día ${celda.dia} (${celda.esLaboral ? 'Turno regular' : 'Franco/Fin de semana'}): Clic para habilitar horas extras.`
              }
            >
              <span className="overtime-calendar__day-number">{celda.dia}</span>
              {isActivo ? (
                <span className="overtime-calendar__day-pill">+{horasDiarias}h</span>
              ) : (
                <span className="overtime-calendar__day-indicator">
                  {celda.esLaboral ? 'R' : 'F'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="overtime-calendar__legend">
        <div className="overtime-calendar__legend-item">
          <span className="overtime-calendar__legend-badge overtime-calendar__legend-badge--active">+h</span>
          <span>Día con Horas Extras</span>
        </div>
        <div className="overtime-calendar__legend-item">
          <span className="overtime-calendar__legend-badge overtime-calendar__legend-badge--regular">R</span>
          <span>Turno Regular</span>
        </div>
        <div className="overtime-calendar__legend-item">
          <span className="overtime-calendar__legend-badge overtime-calendar__legend-badge--off">F</span>
          <span>Franco / Fin de Semana</span>
        </div>
      </div>
    </div>
  )
}
