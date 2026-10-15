import React, { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import './FloatingToast.css'

export default function FloatingToast({
  message,
  type = 'success',
  title = null,
  duration = 4500,
  onClose
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        if (onClose) setTimeout(onClose, 300)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [message, duration, onClose])

  if (!message) return null

  const handleManualClose = () => {
    setIsVisible(false)
    if (onClose) setTimeout(onClose, 300)
  }

  const defaultTitle =
    type === 'success'
      ? 'Operación Exitosa'
      : type === 'error'
      ? 'Atención'
      : 'Información del Sistema'

  return (
    <div
      className={`floating-toast floating-toast--${type} ${
        isVisible ? 'floating-toast--enter' : 'floating-toast--exit'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="floating-toast__icon-wrapper">
        {type === 'success' && <CheckCircle2 className="floating-toast__icon" />}
        {type === 'error' && <AlertCircle className="floating-toast__icon" />}
        {type === 'info' && <Info className="floating-toast__icon" />}
      </div>

      <div className="floating-toast__content">
        <h4 className="floating-toast__title">{title || defaultTitle}</h4>
        <p className="floating-toast__message">{message}</p>
      </div>

      <button
        type="button"
        className="floating-toast__btn-close"
        onClick={handleManualClose}
        aria-label="Cerrar notificación"
      >
        <X size={16} />
      </button>

      <div
        className="floating-toast__progress-bar"
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  )
}
