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
  onSuccess = null,
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
    const patientSnapshot = patientInBox
    try {
      const finishedTicket = await onConfirm()
      onClose()
      if (onSuccess) {
        onSuccess(finishedTicket || patientSnapshot)
      }
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
            <div className="modal-finalizar-atencion__turn-badge">
              <span className="modal-finalizar-atencion__turn-label">TURNO</span>
              <span className="modal-finalizar-atencion__turn-value">{turnoDisplay}</span>
            </div>
          </div>

          {/* Estado de muestras tomadas */}
          <div
            className={`modal-finalizar-atencion__status-box ${
              pendingCount > 0
                ? 'modal-finalizar-atencion__status-box--warning'
                : 'modal-finalizar-atencion__status-box--success'
            }`}
          >
            <div className="modal-finalizar-atencion__status-icon-wrap">
              {pendingCount > 0 ? (
                <AlertTriangle size={20} className="modal-finalizar-atencion__status-icon--warn" />
              ) : (
                <ClipboardCheck size={20} className="modal-finalizar-atencion__status-icon--check" />
              )}
            </div>
            <div className="modal-finalizar-atencion__status-text">
              <strong>
                {pendingCount > 0
                  ? `Atención: Quedan ${pendingCount} de ${totalStudiesCount} estudios sin marcar como tomada`
                  : `Todas las muestras tomadas (${completedCount}/${totalStudiesCount})`}
              </strong>
              <p>
                {pendingCount > 0
                  ? 'Puede finalizar la consulta de todas formas si las muestras físicas ya fueron recolectadas.'
                  : 'Todas las determinaciones clínicas fueron registradas correctamente.'}
              </p>
            </div>
          </div>

          <div className="modal-finalizar-atencion__prompt">
            <p>
              ¿Está seguro de que desea finalizar la consulta en el <strong>{currentBoxKey}</strong>?
            </p>
            <span className="modal-finalizar-atencion__prompt-hint">
              El turno pasará al estado <strong>Atendido</strong>, se calculará la fecha estimada de retiro y se emitirá el comprobante.
            </span>
          </div>
        </div>

        <footer className="modal-finalizar-atencion__footer">
          <button
            type="button"
            className="modal-finalizar-atencion__btn-cancel"
            onClick={onClose}
            disabled={isProcessing}
          >
            Volver
          </button>
          <button
            type="button"
            className="modal-finalizar-atencion__btn-confirm"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            <CheckCircle2 size={16} />
            {isProcessing ? 'Finalizando...' : 'Sí, finalizar consulta'}
          </button>
        </footer>
      </div>
    </div>
  )
}
