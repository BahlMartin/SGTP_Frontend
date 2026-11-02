import React, { useState, useEffect } from 'react'
import { X, UserX, AlertTriangle } from 'lucide-react'
import './ModalCancelarTurnoRecepcion.css'

const SUGERENCIAS_CANCELACION = [
  'No respondió al llamado reiterado en sala de espera',
  'Se retiró del establecimiento antes de acercarse al mostrador',
  'DNI ingresado por error en el tótem de autoservicio',
  'Consulta espontánea resuelta externamente'
]

export default function ModalCancelarTurnoRecepcion({
  isOpen = false,
  onClose = () => {},
  turno = null,
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
  }, [isOpen, turno])

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

  if (!isOpen || !turno) return null

  const handleConfirm = async () => {
    setErrorMessage('')
    try {
      await onConfirm(observaciones.trim() || 'No respondió al llamado en sala')
      onClose()
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo cancelar el turno de recepción.')
    }
  }

  return (
    <div
      className="modal-cancelar-turno__backdrop"
      onClick={() => !isProcessing && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-cancelar-turno__container"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-cancelar-turno__header">
          <div className="modal-cancelar-turno__title-wrap">
            <UserX size={20} className="modal-cancelar-turno__header-icon" />
            <h3 className="modal-cancelar-turno__title">Cancelar Turno de Recepción</h3>
          </div>
          <button
            type="button"
            className="modal-cancelar-turno__close-btn"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </header>

        <div className="modal-cancelar-turno__body">
          <div className="modal-cancelar-turno__alert-banner">
            <AlertTriangle size={18} className="modal-cancelar-turno__alert-icon" />
            <span>
              Se dará de baja el llamado <strong>{turno.numero_llamado}</strong> (DNI: {turno.dni}). El turno será eliminado de la cola de espera activa.
            </span>
          </div>

          {errorMessage && (
            <div className="modal-cancelar-turno__error-msg">{errorMessage}</div>
          )}

          <div className="modal-cancelar-turno__field">
            <label htmlFor="cancel-observaciones" className="modal-cancelar-turno__label">
              Motivo o justificación de cancelación:
            </label>
            <textarea
              id="cancel-observaciones"
              className="modal-cancelar-turno__textarea"
              placeholder="Indique el motivo (ej. ausente tras 3 llamados)..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              disabled={isProcessing}
            />
          </div>

          <div className="modal-cancelar-turno__quick-suggestions">
            <span className="modal-cancelar-turno__quick-label">Sugerencias rápidas:</span>
            <div className="modal-cancelar-turno__chips-wrap">
              {SUGERENCIAS_CANCELACION.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="modal-cancelar-turno__chip"
                  onClick={() => setObservaciones(sug)}
                  disabled={isProcessing}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="modal-cancelar-turno__footer">
          <button
            type="button"
            className="modal-cancelar-turno__btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Volver
          </button>
          <button
            type="button"
            className="modal-cancelar-turno__btn-danger"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            <UserX size={15} />
            <span>{isProcessing ? 'Cancelando...' : 'Confirmar Cancelación'}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}

