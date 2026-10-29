import React, { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react'
import './ModalFinalizarAtencion.css'

export default function ModalFinalizarAtencion({
  isOpen = false,
  onClose = () => {},
  patientInBox = null,
  currentBoxKey = 'Box 1',
  completedCount = 0,
  totalStudiesCount = 0,
  onConfirm = async () => {},
  isProcessing = false
}) {
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
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
  const pendingCount = Math.max(0, totalStudiesCount - completedCount)

  const handleConfirm = async () => {
    setErrorMessage('')
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo finalizar la consulta.')
    }
  }

  return (
    <div
      className="modal-finalizar-atencion__backdrop"
      onClick={() => !isProcessing && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-finalizar-atencion-title"
    >
      <div className="modal-finalizar-atencion__card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-finalizar-atencion__header">
          <div className="modal-finalizar-atencion__title-box">
            <div className="modal-finalizar-atencion__icon-wrap">
              <CheckCircle2 className="modal-finalizar-atencion__icon" size={22} />
            </div>
            <div>
              <h3 id="modal-finalizar-atencion-title" className="modal-finalizar-atencion__title">
                Confirmar Finalización de Consulta
              </h3>
              <p className="modal-finalizar-atencion__subtitle">
                Cierre de atención asistencial en {currentBoxKey}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-finalizar-atencion__close-btn"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </header>

        <div className="modal-finalizar-atencion__body">
          {errorMessage && (
            <div className="modal-finalizar-atencion__error" role="alert">
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="modal-finalizar-atencion__patient-summary">
            <div className="modal-finalizar-atencion__patient-info">
              <span className="modal-finalizar-atencion__patient-label">PACIENTE EN ATENCIÓN</span>
              <strong className="modal-finalizar-atencion__patient-name">{nombreCompleto}</strong>
              <span className="modal-finalizar-atencion__patient-dni">
                DNI: {patientInBox.paciente_dni || 'Sin DNI'} · Obra Social:{' '}
                {patientInBox.paciente_obra_social || 'Particular'}
              </span>
            </div>
            <div className="modal-finalizar-atencion__ticket-pill">
              <span className="modal-finalizar-atencion__ticket-label">TURNO</span>
              <strong className="modal-finalizar-atencion__ticket-num">{turnoDisplay}</strong>
            </div>
          </div>

          <div className="modal-finalizar-atencion__confirm-box" role="alert">
            <ClipboardCheck size={20} className="modal-finalizar-atencion__confirm-icon" />
            <div className="modal-finalizar-atencion__confirm-content">
              <p className="modal-finalizar-atencion__confirm-question">
                ¿Está seguro de que desea terminar la consulta de{' '}
                <strong>{nombreCompleto || 'este paciente'}</strong>?
              </p>
              <p className="modal-finalizar-atencion__confirm-text">
                Al confirmar, el turno se registrará como <strong>Finalizado</strong> y el{' '}
                <strong>{currentBoxKey}</strong> quedará disponible para llamar al siguiente paciente.
              </p>
            </div>
          </div>

          {totalStudiesCount > 0 && pendingCount > 0 && (
            <div className="modal-finalizar-atencion__pending-warning">
              <AlertTriangle size={17} className="modal-finalizar-atencion__pending-icon" />
              <span>
                Hay <strong>{pendingCount}</strong> de <strong>{totalStudiesCount}</strong> muestra(s) sin
                tildar en la lista de control ({completedCount}/{totalStudiesCount} marcadas como tomadas).
              </span>
            </div>
          )}
        </div>

        <footer className="modal-finalizar-atencion__footer">
          <button
            type="button"
            className="modal-finalizar-atencion__btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Volver al box
          </button>
          <button
            type="button"
            className="modal-finalizar-atencion__btn-confirm"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            <CheckCircle2 size={16} />
            <span>{isProcessing ? 'Finalizando consulta...' : 'Sí, finalizar consulta'}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}

