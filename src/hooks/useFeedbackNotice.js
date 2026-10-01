import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Hook reutilizable para gestionar mensajes de notificación y feedback temporal.
 * Cancela automáticamente temporizadores pendientes ante nuevos avisos o al desmontar el componente.
 *
 * @param {number} defaultDurationMs - Duración en milisegundos que permanece visible el aviso (por defecto 4000ms).
 */
export function useFeedbackNotice(defaultDurationMs = 4000) {
  const [notice, setNotice] = useState(null)
  const timerReference = useRef(null)

  const clearNotice = useCallback(() => {
    if (timerReference.current) {
      clearTimeout(timerReference.current)
      timerReference.current = null
    }
    setNotice(null)
  }, [])

  const showNotice = useCallback(
    (messageText, customDurationMs) => {
      if (timerReference.current) {
        clearTimeout(timerReference.current)
      }

      setNotice(messageText)

      const activeDuration =
        typeof customDurationMs === 'number' ? customDurationMs : defaultDurationMs

      timerReference.current = setTimeout(() => {
        setNotice(null)
        timerReference.current = null
      }, activeDuration)
    },
    [defaultDurationMs]
  )

  useEffect(() => {
    return () => {
      if (timerReference.current) {
        clearTimeout(timerReference.current)
      }
    }
  }, [])

  return {
    notice,
    showNotice,
    clearNotice
  }
}
