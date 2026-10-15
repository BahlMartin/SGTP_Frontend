import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import './RefreshButton.css'

export default function RefreshButton({
  onRefresh,
  isLoading = false,
  label = 'Actualizar',
  className = ''
}) {
  const [lastUpdated, setLastUpdated] = useState(() => new Date())

  const handleManualRefresh = async () => {
    if (isLoading || !onRefresh) return
    try {
      await onRefresh()
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error durante la actualización manual:', err)
    }
  }

  const formattedTime = lastUpdated.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  return (
    <button
      type="button"
      className={`refresh-btn ${className}`.trim()}
      onClick={handleManualRefresh}
      disabled={isLoading}
      title={`Última actualización: ${formattedTime}`}
      aria-label={`${label}. Última actualización: ${formattedTime}`}
    >
      <RefreshCw
        size={13}
        className={`refresh-btn__icon ${isLoading ? 'refresh-btn__icon--spinning' : ''}`}
        aria-hidden="true"
      />
      <span className="refresh-btn__label">{label}</span>
      <span className="refresh-btn__time">{formattedTime}</span>
    </button>
  )
}
