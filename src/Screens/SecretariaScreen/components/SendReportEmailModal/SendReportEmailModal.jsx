import React, { useState, useEffect } from 'react'
import { Mail, AlertTriangle, AlertCircle, X, Send, ArrowLeft } from 'lucide-react'
import './SendReportEmailModal.css'

export default function SendReportEmailModal({
  isOpen,
  onClose,
  onConfirmSend,
  isSending = false,
  backendError = null,
  onClearError
}) {
  const [targetEmail, setTargetEmail] = useState('')
  const [showConfirmAlert, setShowConfirmAlert] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setTargetEmail('')
      setShowConfirmAlert(false)
      setLocalError('')
      if (onClearError) onClearError()
    }
  }, [isOpen, onClearError])

  if (!isOpen) return null

  const handleRequestConfirm = (e) => {
    e.preventDefault()
    const trimmed = targetEmail.trim()
    if (!trimmed) {
      setLocalError('Debe ingresar un correo electrónico destinatario.')
      return
    }
    setLocalError('')
    if (onClearError) onClearError()
    setShowConfirmAlert(true)
  }

  const handleBackToEdit = () => {
    setShowConfirmAlert(false)
  }

  const handleConfirmDispatch = async () => {
    const trimmed = targetEmail.trim()
    const result = await onConfirmSend(trimmed)
    if (result?.success) {
      onClose()
    } else {
      // Si el backend devuelve error de validación de email o de envío, volvemos a mostrar el error en el modal
      setShowConfirmAlert(false)
    }
  }

  const activeError = localError || backendError

  return (
    <div
      className="send-report-email-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-report-email-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSending) {
          onClose()
        }
      }}
    >
      <div className="send-report-email-modal__card">
        <header className="send-report-email-modal__header">
          <div className="send-report-email-modal__title-wrap">
            <span className="send-report-email-modal__icon-badge" aria-hidden="true">
              <Mail size={18} />
            </span>
            <div>
              <h2 id="send-report-email-modal-title" className="send-report-email-modal__title">
                Enviar reporte a un tercero
              </h2>
              <p className="send-report-email-modal__subtitle">
                Ingrese manualmente el correo electrónico del destinatario
              </p>
            </div>
          </div>
          <button
            type="button"
            className="send-report-email-modal__close-btn"
            onClick={onClose}
            disabled={isSending}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </header>

        <div className="send-report-email-modal__body">
          {activeError && (
            <div className="send-report-email-modal__error-banner" role="alert">
              <AlertCircle className="send-report-email-modal__error-icon" size={18} />
              <span>{activeError}</span>
            </div>
          )}

          {!showConfirmAlert ? (
            <form onSubmit={handleRequestConfirm} noValidate>
              <label htmlFor="third-party-email-input" className="send-report-email-modal__label">
                Correo electrónico del destinatario
              </label>
              <input
                id="third-party-email-input"
                type="email"
                className="send-report-email-modal__input"
                placeholder="ejemplo@correo.com"
                value={targetEmail}
                onChange={(e) => {
                  setTargetEmail(e.target.value)
                  if (localError) setLocalError('')
                  if (backendError && onClearError) onClearError()
                }}
                disabled={isSending}
                autoFocus
              />

              <div className="send-report-email-modal__footer">
                <button
                  type="button"
                  className="send-report-email-modal__btn send-report-email-modal__btn--secondary"
                  onClick={onClose}
                  disabled={isSending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="send-report-email-modal__btn send-report-email-modal__btn--primary"
                  disabled={isSending || !targetEmail.trim()}
                >
                  <Send size={15} />
                  <span>Continuar</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="send-report-email-modal__confirm-step">
              <div className="send-report-email-modal__confirm-alert" role="alert">
                <AlertTriangle className="send-report-email-modal__confirm-icon" size={22} />
                <div className="send-report-email-modal__confirm-content">
                  <p className="send-report-email-modal__confirm-question">
                    ¿Seguro que quiere enviar este correo a{' '}
                    <strong className="send-report-email-modal__confirm-email">
                      {targetEmail.trim()}
                    </strong>
                    ?
                  </p>
                  <p className="send-report-email-modal__confirm-hint">
                    Se enviará el reporte diario asistencial adjunto en formato PDF a la dirección indicada.
                  </p>
                </div>
              </div>

              <div className="send-report-email-modal__footer">
                <button
                  type="button"
                  className="send-report-email-modal__btn send-report-email-modal__btn--secondary"
                  onClick={handleBackToEdit}
                  disabled={isSending}
                >
                  <ArrowLeft size={15} />
                  <span>Volver</span>
                </button>
                <button
                  type="button"
                  className="send-report-email-modal__btn send-report-email-modal__btn--primary"
                  onClick={handleConfirmDispatch}
                  disabled={isSending}
                >
                  <Send size={15} />
                  <span>{isSending ? 'Enviando...' : 'Confirmar y enviar'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

