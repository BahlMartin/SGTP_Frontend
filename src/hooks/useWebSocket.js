import { useEffect, useRef, useState, useCallback } from 'react'
import ENVIRONMENT from '../config/enviroment.config'

/**
 * Hook reutilizable para conexiones WebSocket con reconexión automática.
 * Obtiene la URL base exclusivamente desde ENVIRONMENT.URL_WS (definida por VITE_WS_URL en .env).
 *
 * @param {string} endpointPath - Ruta relativa del endpoint ws (ej: 'tickets/' o 'boxes/')
 * @param {object} options - Opciones opcionales { onMessage, autoReconnect: true }
 */
export const useWebSocket = (endpointPath = '', options = {}) => {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const onMessageCallbackRef = useRef(options.onMessage)

  useEffect(() => {
    onMessageCallbackRef.current = options.onMessage
  }, [options.onMessage])

  const connect = useCallback(() => {
    if (!ENVIRONMENT.URL_WS) {
      console.warn('VITE_WS_URL no está configurada. La conexión WebSocket está deshabilitada.')
      return
    }

    const cleanBase = ENVIRONMENT.URL_WS.replace(/\/$/, '')
    const cleanPath = endpointPath.replace(/^\//, '')
    const fullUrl = cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase

    const ws = new WebSocket(fullUrl)
    socketRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      let parsedData = event.data
      try {
        parsedData = JSON.parse(event.data)
      } catch {
        // Se mantiene como texto plano si no es JSON válido
      }
      setLastMessage(parsedData)
      if (onMessageCallbackRef.current) {
        onMessageCallbackRef.current(parsedData)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      const shouldReconnect = options.autoReconnect !== false
      if (shouldReconnect) {
        // Reconexión tras 3 segundos
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    }

    ws.onerror = (error) => {
      console.error('Error en WebSocket:', error)
      ws.close()
    }
  }, [endpointPath, options.autoReconnect])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [connect])

  const sendMessage = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
      socketRef.current.send(data)
    } else {
      console.warn('No se puede enviar mensaje: WebSocket no conectado.')
    }
  }, [])

  return {
    isConnected,
    lastMessage,
    sendMessage,
    socket: socketRef.current
  }
}

export default useWebSocket
