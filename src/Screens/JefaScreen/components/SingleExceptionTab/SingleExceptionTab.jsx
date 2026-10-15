import React from 'react'
import { AlertCircle, Trash2 } from 'lucide-react'
import ShiftTimeInput from '../ShiftTimeInput'
import {
  useOvertimeAuthorization,
  MOTIVOS_FRECUENTES
} from '../../hooks/useOvertimeAuthorization'
import './SingleExceptionTab.css'

export default function SingleExceptionTab({
  staffMember,
  onSubmit,
  onRevoke,
  onClose
}) {
  const {
    fecha,
    setFecha,
    turnoInicio,
    turnoFin,
    tipoExtension,
    horaInicio,
    setHoraInicio,
    horaFin,
    setHoraFin,
    motivo,
    setMotivo,
    motivoPersonalizado,
    setMotivoPersonalizado,
    errorMsg,
    isSaving,
    habilitacionesPrevias,
    handleSelectTipo,
    handlePresetDuracion,
    handleSubmit,
    handleRevocarItem
  } = useOvertimeAuthorization(staffMember, { onSubmit, onRevoke, onClose })

  return (
    <form onSubmit={handleSubmit} className="jefa-screen__staff-form">
      {errorMsg && (
        <div className="jefa-screen__modal-error" role="alert">
          <AlertCircle className="jefa-screen__modal-error-icon" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="jefa-screen__modal-field">
        <label htmlFor="overtime-fecha">Fecha de Extensión:</label>
        <input
          id="overtime-fecha"
          type="date"
          required
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      <div className="overtime-modal__type-selector">
        <span className="overtime-modal__type-label">Tipo de Extensión:</span>
        <div className="overtime-modal__type-pills">
          <button
            type="button"
            className={`overtime-pill ${
              tipoExtension === 'post' ? 'overtime-pill--active' : ''
            }`}
            onClick={() => handleSelectTipo('post')}
          >
            Post-Turno ({turnoFin})
          </button>
          <button
            type="button"
            className={`overtime-pill ${
              tipoExtension === 'pre' ? 'overtime-pill--active' : ''
            }`}
            onClick={() => handleSelectTipo('pre')}
          >
            Pre-Turno ({turnoInicio})
          </button>
          <button
            type="button"
            className={`overtime-pill ${
              tipoExtension === 'libre' ? 'overtime-pill--active' : ''
            }`}
            onClick={() => handleSelectTipo('libre')}
          >
            Horario Libre
          </button>
        </div>
      </div>

      <div className="jefa-screen__modal-row">
        <ShiftTimeInput
          id="overtime-hora-inicio"
          label="Hora Inicio"
          value={horaInicio}
          onChange={setHoraInicio}
        />
        <ShiftTimeInput
          id="overtime-hora-fin"
          label="Hora Fin"
          value={horaFin}
          onChange={setHoraFin}
        />
      </div>

      <div className="overtime-modal__quick-durations">
        <span>Duración rápida:</span>
        <button type="button" onClick={() => handlePresetDuracion(60)}>
          +1 hora
        </button>
        <button type="button" onClick={() => handlePresetDuracion(120)}>
          +2 horas
        </button>
        <button type="button" onClick={() => handlePresetDuracion(240)}>
          +4 horas
        </button>
      </div>

      <div className="jefa-screen__modal-field">
        <label htmlFor="overtime-motivo">Motivo de la Extensión:</label>
        <select
          id="overtime-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        >
          {MOTIVOS_FRECUENTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value="OTRO">Otro motivo personalizado...</option>
        </select>
      </div>

      {motivo === 'OTRO' && (
        <div className="jefa-screen__modal-field">
          <label htmlFor="overtime-motivo-custom">Especificar Motivo:</label>
          <input
            id="overtime-motivo-custom"
            type="text"
            placeholder="Detallá la causa de la excepción"
            required
            value={motivoPersonalizado}
            onChange={(e) => setMotivoPersonalizado(e.target.value)}
          />
        </div>
      )}

      {/* Listado de habilitaciones activas previas para este día */}
      {habilitacionesPrevias?.length > 0 && (
        <div className="overtime-modal__previas">
          <span className="overtime-modal__previas-title">
            Habilitaciones registradas para el {fecha}:
          </span>
          <ul className="overtime-modal__previas-list">
            {habilitacionesPrevias.map((hab) => (
              <li key={hab.id} className="overtime-modal__previas-item">
                <span>
                  {String(hab.hora_inicio).slice(0, 5)} a{' '}
                  {String(hab.hora_fin).slice(0, 5)} - {hab.motivo}
                </span>
                {onRevoke && (
                  <button
                    type="button"
                    className="overtime-modal__btn-revoke"
                    onClick={() => handleRevocarItem(hab.id)}
                    title="Revocar esta extensión"
                  >
                    <Trash2 className="jefa-screen__btn-delete-icon" />
                    <span>Revocar</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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
          disabled={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Autorizar Excepción'}
        </button>
      </div>
    </form>
  )
}
