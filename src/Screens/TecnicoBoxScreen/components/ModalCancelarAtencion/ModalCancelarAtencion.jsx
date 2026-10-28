import React, { useState, useEffect } from 'react'
import { X, UserX, AlertTriangle, CheckCircle2 } from 'lucide-react'
import './ModalCancelarAtencion.css'

const SUGERENCIAS_AUSENCIA = [
  'No respondió al llamado reiterado en sala de espera',
  'Se retiró del establecimiento antes de ingresar al box',
  'Posterga extracción por falta de ayuno / indicación previa'
]

export default function ModalCancelarAtencion({
  isOpen = false,
  onClose = () => {},
  patientInBox = null,
  currentBoxKey = 'Box 1',
  onConfirm = async () => {},
  isProcessing = false
}) {
  const [observaciones, setObservaciones] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      setObservaciones('')
      setErrorMessage('')
    }
  }, [isOpen, patientInBox])

  useEffect(() => {
    if (!isOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isProcessing) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isProcessing, onClose])

  if (!isOpen || !patientInBox) return null

  const turnoDisplay = patientInBox.num_llamado || patientInBox.num_totem || 'S/N'
  const nombreCompleto = `${patientInBox.paciente_nombre || ''} ${patientInBox.paciente_apellido || ''}`.trim()

  const handleConfirm = async () => {
    setErrorMessage('')
    try {
      await onConfirm(observaciones.trim())
      onClose()
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo cancelar el turno.')
    }
  }

  return (
    <div
      className="modal-cancelar-atencion__backdrop"
      onClick={() => !isProcessing && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cancelar-atencion-title"
    >
      <div className="modal-cancelar-atencion__card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-cancelar-atencion__header">
          <div className="modal-cancelar-atencion__title-box">
            <div className="modal-cancelar-atencion__icon-wrap">
              <UserX className="modal-cancelar-atencion__icon" size={22} />
            </div>
            <div>
              <h3 id="modal-cancelar-atencion-title" className="modal-cancelar-atencion__title">
                Confirmar Paciente Ausente
              </h3>
              <p className="modal-cancelar-atencion__subtitle">
                Cancelación definitiva de atención en {currentBoxKey}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-cancelar-atencion__close-btn"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </header>

        <div className="modal-cancelar-atencion__body">
          {errorMessage && (
            <div className="modal-cancelar-atencion__error" role="alert">
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="modal-cancelar-atencion__patient-summary">
            <div className="modal-cancelar-atencion__patient-info">
              <span className="modal-cancelar-atencion__patient-label">PACIENTE CONVOCADO</span>
              <strong className="modal-cancelar-atencion__patient-name">{nombreCompleto}</strong>
              <span className="modal-cancelar-atencion__patient-dni">
                DNI: {patientInBox.paciente_dni || 'Sin DNI'} · Obra Social: {patientInBox.paciente_obra_social || 'Particular'}
              </span>
            </div>
            <div className="modal-cancelar-atencion__ticket-pill">
              <span className="modal-cancelar-atencion__ticket-label">TURNO</span>
              <strong className="modal-cancelar-atencion__ticket-num">{turnoDisplay}</strong>
            </div>
          </div>

          <div className="modal-cancelar-atencion__warning-box">
            <AlertTriangle size={18} className="modal-cancelar-atencion__warning-icon" />
            <p className="modal-cancelar-atencion__warning-text">
              Al confirmar que el paciente <strong>no se presentó</strong>, el ticket pasará a estado{' '}
              <strong>Cancelado</strong> de forma definitiva y el <strong>{currentBoxKey}</strong> quedará libre. Si el paciente regresa más tarde, deberá anunciarse nuevamente en Admisión.
            </p>
          </div>

          <div className="modal-cancelar-atencion__field">
            <label htmlFor="observaciones-cancelacion-box" className="modal-cancelar-atencion__label">
              Observación de ausencia <span className="modal-cancelar-atencion__optional">(Opcional)</span>
            </label>
            <textarea
              id="observaciones-cancelacion-box"
              className="modal-cancelar-atencion__textarea"
              rows={3}
              maxLength={255}
              placeholder="Ej: Se llamó en 3 oportunidades por pantalla y altavoz sin respuesta..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              disabled={isProcessing}
            />
            <div className="modal-cancelar-atencion__quick-chips">
              <span className="modal-cancelar-atencion__chips-caption">Sugerencias rápidas:</span>
              <div className="modal-cancelar-atencion__chips-list">
                {SUGERENCIAS_AUSENCIA.map((sugerencia) => (
                  <button
                    key={sugerencia}
                    type="button"
                    className={`modal-cancelar-atencion__chip ${
                      observaciones === sugerencia ? 'modal-cancelar-atencion__chip--active' : ''
                    }`}
                    onClick={() => setObservaciones(sugerencia)}
                    disabled={isProcessing}
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="modal-cancelar-atencion__footer">
          <button
            type="button"
            className="modal-cancelar-atencion__btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Volver al box
          </button>
          <button
            type="button"
            className="modal-cancelar-atencion__btn-danger"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            <UserX size={16} />
            <span>{isProcessing ? 'Cancelando turno...' : 'Confirmar ausencia y cancelar'}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}

