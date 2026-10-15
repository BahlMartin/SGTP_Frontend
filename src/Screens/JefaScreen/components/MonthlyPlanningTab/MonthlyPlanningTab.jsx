import React from 'react'
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from 'lucide-react'
import ShiftTimeInput from '../ShiftTimeInput'
import OvertimeMonthCalendar from '../OvertimeMonthCalendar'
import {
  useMonthlyOvertimePlanning,
  MESES_NOMBRES,
  MOTIVOS_PLANIFICACION
} from '../../hooks/useMonthlyOvertimePlanning'
import './MonthlyPlanningTab.css'

export default function MonthlyPlanningTab({
  staffMember,
  diasLaboralesTexto,
  onSubmit,
  onClose
}) {
  const {
    anio,
    mes,
    cambiarMes,
    tipoExtension,
    horaInicio,
    setHoraInicio,
    horaFin,
    setHoraFin,
    horasDiarias,
    totalHorasMes,
    diasActivos,
    toggleDia,
    aplicarPatron,
    motivo,
    setMotivo,
    motivoPersonalizado,
    setMotivoPersonalizado,
    errorMsg,
    isSaving,
    handleSubmit,
    diasLaborales
  } = useMonthlyOvertimePlanning(staffMember, { onSubmit, onClose })

  return (
    <form onSubmit={handleSubmit} className="jefa-screen__staff-form">
      {errorMsg && (
        <div className="jefa-screen__modal-error" role="alert">
          <AlertCircle className="jefa-screen__modal-error-icon" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Navegación de Mes y Año */}
      <div className="overtime-modal__month-nav">
        <button
          type="button"
          className="overtime-modal__month-nav-btn"
          onClick={() => cambiarMes(-1)}
          title="Mes anterior"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="overtime-modal__nav-icon" />
        </button>
        <div className="overtime-modal__month-nav-title">
          <Calendar className="overtime-modal__month-icon" />
          <span>
            {MESES_NOMBRES[mes - 1]} {anio}
          </span>
        </div>
        <button
          type="button"
          className="overtime-modal__month-nav-btn"
          onClick={() => cambiarMes(1)}
          title="Mes siguiente"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="overtime-modal__nav-icon" />
        </button>
      </div>

      {/* Franja Horaria Extraordinaria */}
      <div className="jefa-screen__modal-row">
        <ShiftTimeInput
          id="monthly-hora-inicio"
          label="Inicio Extensión"
          value={horaInicio}
          onChange={setHoraInicio}
        />
        <ShiftTimeInput
          id="monthly-hora-fin"
          label="Fin Extensión"
          value={horaFin}
          onChange={setHoraFin}
        />
      </div>

      <div className="overtime-modal__duration-indicator">
        Duración por jornada extraordinaria:{' '}
        <strong>{horasDiarias} horas/día</strong>
        {horaInicio && horaFin && horaInicio >= horaFin && (
          <span style={{ marginLeft: '8px', color: '#1e40af', fontWeight: 600 }}>
            🌙 Franja nocturna (cruza medianoche a 00:00)
          </span>
        )}
      </div>

      {/* Patrones Rápidos (Presets) */}
      <div className="overtime-modal__presets">
        <span className="overtime-modal__presets-label">Patrones rápidos para el mes:</span>
        <div className="overtime-modal__preset-buttons">
          <button
            type="button"
            className={`overtime-pill ${
              tipoExtension === 'POST_TURNO' ? 'overtime-pill--active' : ''
            }`}
            onClick={() => aplicarPatron('POST_TURNO')}
          >
            Post-Turno ({diasLaboralesTexto})
          </button>
          <button
            type="button"
            className={`overtime-pill ${
              tipoExtension === 'PRE_TURNO' ? 'overtime-pill--active' : ''
            }`}
            onClick={() => aplicarPatron('PRE_TURNO')}
          >
            Pre-Turno ({diasLaboralesTexto})
          </button>
          <button
            type="button"
            className={`overtime-pill ${
              tipoExtension === 'GUARDIA' ? 'overtime-pill--active' : ''
            }`}
            onClick={() => aplicarPatron('GUARDIA')}
          >
            Fines de Semana / Francos
          </button>
          <button
            type="button"
            className="overtime-pill overtime-pill--clear"
            onClick={() => aplicarPatron('DESMARCAR')}
          >
            Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Calendario Interactivo */}
      <div className="overtime-modal__calendar-container">
        <OvertimeMonthCalendar
          anio={anio}
          mes={mes}
          diasActivosSet={diasActivos}
          onToggleDia={toggleDia}
          horasDiarias={horasDiarias}
          diasLaborales={diasLaborales}
        />
      </div>

      {/* Selector de Motivo */}
      <div className="jefa-screen__modal-field">
        <label htmlFor="monthly-motivo">Motivo de la Planificación:</label>
        <select
          id="monthly-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        >
          {MOTIVOS_PLANIFICACION.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {motivo === 'OTRO' && (
        <div className="jefa-screen__modal-field">
          <label htmlFor="monthly-motivo-custom">Especificar Motivo:</label>
          <input
            id="monthly-motivo-custom"
            type="text"
            placeholder="Ej: Cobertura de congreso o refuerzo epidemiológico"
            required
            value={motivoPersonalizado}
            onChange={(e) => setMotivoPersonalizado(e.target.value)}
          />
        </div>
      )}

      {/* Tarjeta de Resumen y Cómputo en Tiempo Real */}
      <div className="overtime-modal__summary-card">
        <div className="overtime-modal__summary-row">
          <div className="overtime-modal__summary-item">
            <span className="overtime-modal__summary-label">Días activos</span>
            <span className="overtime-modal__summary-val">{diasActivos.size} días</span>
          </div>
          <div className="overtime-modal__summary-item">
            <span className="overtime-modal__summary-label">Horas diarias</span>
            <span className="overtime-modal__summary-val">{horasDiarias} hs</span>
          </div>
          <div className="overtime-modal__summary-item overtime-modal__summary-item--total">
            <span className="overtime-modal__summary-label">TOTAL MES</span>
            <span className="overtime-modal__summary-val">
              {totalHorasMes} hs
            </span>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="jefa-screen__modal-actions">
        <button
          type="button"
          className="jefa-screen__btn-modal-cancel"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="jefa-screen__btn-modal-submit"
          disabled={isSaving || diasActivos.size === 0}
        >
          <CheckCircle2 className="overtime-modal__btn-submit-icon" />
          {isSaving ? 'Guardando...' : `Guardar Planificación (${totalHorasMes} hs)`}
        </button>
      </div>
    </form>
  )
}
