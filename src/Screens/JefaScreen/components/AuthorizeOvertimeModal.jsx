import React from 'react'
import { AlertCircle, Clock3, X, Trash2 } from 'lucide-react'
import ShiftTimeInput from './ShiftTimeInput'
import { useOvertimeAuthorization, MOTIVOS_FRECUENTES } from '../hooks/useOvertimeAuthorization'
import './AuthorizeOvertimeModal.css'

export default function AuthorizeOvertimeModal({
  staffMember,
  isOpen,
  onClose,
  onSubmit,
  onRevoke
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

  if (!isOpen || !staffMember) return null

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

        <div className="overtime-modal__header">
          <Clock3 className="overtime-modal__header-icon" />
          <div>
            <h3 id="overtime-modal-title" className="jefa-screen__modal-title">
              Autorizar Horario Excepcional / Horas Extras
            </h3>
            <p className="jefa-screen__modal-desc">
              Habilitación extraordinaria para cobertura asistencial fuera del horario habitual.
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
              Turno regular: <strong>{turnoInicio} - {turnoFin}</strong>
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="jefa-screen__modal-error" role="alert">
            <AlertCircle className="jefa-screen__modal-error-icon" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="jefa-screen__staff-form">
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

          {/* Selector de Tipo de Extensión */}
          <div className="overtime-modal__type-selector">
            <label className="overtime-modal__type-label">Tipo de Extensión:</label>
            <div className="overtime-modal__type-pills">
              <button
                type="button"
                className={`overtime-pill ${tipoExtension === 'post' ? 'overtime-pill--active' : ''}`}
                onClick={() => handleSelectTipo('post')}
              >
                Post-Turno (desde {turnoFin})
              </button>
              <button
                type="button"
                className={`overtime-pill ${tipoExtension === 'pre' ? 'overtime-pill--active' : ''}`}
                onClick={() => handleSelectTipo('pre')}
              >
                Pre-Turno (hasta {turnoInicio})
              </button>
              <button
                type="button"
                className={`overtime-pill ${tipoExtension === 'libre' ? 'overtime-pill--active' : ''}`}
                onClick={() => handleSelectTipo('libre')}
              >
                Guardia / Franco
              </button>
            </div>
          </div>

          <div className="jefa-screen__modal-field--shift">
            <ShiftTimeInput
              id="overtime-inicio"
              label="Hora de Inicio:"
              value={horaInicio}
              onChange={setHoraInicio}
            />
            <ShiftTimeInput
              id="overtime-fin"
              label="Hora de Fin:"
              value={horaFin}
              onChange={setHoraFin}
            />
          </div>

          {/* Accesos rápidos de duración */}
          <div className="overtime-modal__quick-durations">
            <span>Duración rápida:</span>
            <button type="button" onClick={() => handlePresetDuracion(60)}>+1 Hora</button>
            <button type="button" onClick={() => handlePresetDuracion(120)}>+2 Horas</button>
            <button type="button" onClick={() => handlePresetDuracion(240)}>+4 Horas</button>
          </div>

          <div className="jefa-screen__modal-field">
            <label htmlFor="overtime-motivo">Motivo de la Extensión:</label>
            <select
              id="overtime-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="jefa-screen__modal-select"
            >
              {MOTIVOS_FRECUENTES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="OTRO">Otro motivo personalizado...</option>
            </select>
          </div>

          {motivo === 'OTRO' && (
            <div className="jefa-screen__modal-field">
              <input
                type="text"
                maxLength={255}
                required
                placeholder="Especifique el motivo de la habilitación..."
                value={motivoPersonalizado}
                onChange={(e) => setMotivoPersonalizado(e.target.value)}
              />
            </div>
          )}

          {/* Lista de Habilitaciones Activas para esta fecha */}
          {habilitacionesPrevias.length > 0 && (
            <div className="overtime-modal__previas">
              <h4 className="overtime-modal__previas-title">Habilitaciones registradas para el {fecha}:</h4>
              <ul className="overtime-modal__previas-list">
                {habilitacionesPrevias.map((hab) => (
                  <li key={hab.id} className="overtime-modal__previas-item">
                    <div>
                      <strong>{String(hab.hora_inicio).slice(0, 5)} a {String(hab.hora_fin).slice(0, 5)}</strong> — {hab.motivo}
                    </div>
                    <button
                      type="button"
                      className="overtime-modal__btn-revoke"
                      title="Revocar esta extensión"
                      onClick={() => handleRevocarItem(hab.id)}
                    >
                      <Trash2 size={13} />
                      <span>Revocar</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="jefa-screen__modal-actions">
            <button type="button" className="jefa-screen__btn-cancel" onClick={onClose} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="jefa-screen__btn-save" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Autorizar Horas Extras'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
