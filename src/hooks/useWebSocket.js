import { useEffect, useRef, useState, useCallback } from 'react'
import ENVIRONMENT from '../config/enviroment.config'

/**
 * Resuelve el token de sesión desde múltiples fuentes:
 * 1. sessionStorage ('token')
 * 2. localStorage ('token' o 'sgtp_session_token')
 * 3. document.cookie ('sessionid')
 * 4. localStorage ('sgtp_session_user')
 */
export function resolveSessionToken() {
  try {
    const sessToken = sessionStorage.getItem('token')
    if (sessToken && typeof sessToken === 'string' && sessToken.trim()) {
      return sessToken.trim()
    }
  } catch {
    // Ignore storage errors
  }

  try {
    const localToken = localStorage.getItem('token') || localStorage.getItem('sgtp_session_token')
    if (localToken && typeof localToken === 'string' && localToken.trim()) {
      return localToken.trim()
    }
  } catch {
    // Ignore storage errors
  }

  if (typeof document !== 'undefined' && document.cookie) {
    const match = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/)
    if (match && match[1]) {
      return decodeURIComponent(match[1])
    }
  }

  try {
    const sessionUserRaw = localStorage.getItem('sgtp_session_user')
    if (sessionUserRaw) {
      const parsed = JSON.parse(sessionUserRaw)
      if (parsed?.token) return parsed.token
      if (parsed?.sessionid) return parsed.sessionid
    }
  } catch {
    // Ignore JSON errors
  }

  return null
}

/**
 * Normaliza la URL de conexión WebSocket para garantizar la estructura `/ws/<endpoint>`.
 * La URL permanece 100% limpia sin tokens sensibles en la query string.
 *
 * @param {string} endpointPath - Ruta como 'tickets', 'ws/tickets', '/ws/tickets', etc.
 * @returns {string} URL completa y sanitizada lista para conectar
 */
export function buildWebSocketUrl(endpointPath = '') {
  if (!ENVIRONMENT.URL_WS) return ''

  // Limpiar barras finales de la base (ej. wss://dominio.com/ws)
  const cleanBase = ENVIRONMENT.URL_WS.replace(/\/+$/, '')

  // Limpiar barras y prefijo 'ws/' si el usuario lo incluyó en el endpoint
  let cleanSubPath = (endpointPath || '').trim().replace(/^\/+|\/+$/g, '')
  if (cleanSubPath.startsWith('ws/')) {
    cleanSubPath = cleanSubPath.slice(3).replace(/^\/+/, '')
  } else if (cleanSubPath === 'ws') {
    cleanSubPath = ''
  }

  if (cleanBase.endsWith('/ws')) {
    return cleanSubPath ? `${cleanBase}/${cleanSubPath}` : cleanBase
  }
  return cleanSubPath ? `${cleanBase}/ws/${cleanSubPath}` : `${cleanBase}/ws`
}

/**
 * Hook reutilizable para conexiones WebSocket con reconexión automática y autenticación In-Band.
 *
 * @param {string} endpointPath - Ruta del endpoint (ej: 'tickets', 'boxes', 'queue', 'reportes', 'monitor-operativo')
 * @param {object} options - Opciones opcionales { onMessage, autoReconnect: true }
 */
export const useWebSocket = (endpointPath = '', options = {}) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
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

    const fullUrl = buildWebSocketUrl(endpointPath)
    if (!fullUrl) return

    const ws = new WebSocket(fullUrl)
    socketRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)

      // Autenticación por mensaje inicial (In-Band Auth)
      // El token viaja seguro dentro del socket en lugar de la URL pública
      const token = resolveSessionToken()
      if (token) {
        ws.send(JSON.stringify({
          type: 'AUTH',
          token: token
        }))
      }
    }

    ws.onmessage = (event) => {
      let parsedData = event.data
      try {
        parsedData = JSON.parse(event.data)
      } catch {
        // Se mantiene como texto plano si no es JSON válido
      }

      // Mensajes de control interno del protocolo
      if (parsedData?.type === 'AUTH_SUCCESS') {
        setIsAuthenticated(true)
        return
      }

      if (parsedData?.type === 'AUTH_ERROR') {
        setIsAuthenticated(false)
        console.warn('Autenticación WebSocket rechazada:', parsedData.detail)
        return
      }

      if (parsedData?.type === 'pong') {
        return
      }

      // Normalización bidireccional de conveniencia: asegurar que event y action existan siempre
      if (parsedData && typeof parsedData === 'object') {
        const eventName = parsedData.event || parsedData.action
        if (!parsedData.event && eventName) parsedData.event = eventName
        if (!parsedData.action && eventName) parsedData.action = eventName
      }

      setLastMessage(parsedData)
      if (onMessageCallbackRef.current) {
        onMessageCallbackRef.current(parsedData)
      }
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      setIsAuthenticated(false)

      // Si el servidor cerró expresamente por permisos (4003 Forbidden), no reintentar en bucle
      if (event.code === 4003) {
        console.warn('WebSocket cerrado por falta de permisos (4003 Forbidden). No se reintentará automáticamente.')
        return
      }

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

  // Escuchar cuando el token se resuelva para autenticar de inmediato si el socket ya está conectado
  useEffect(() => {
    const handleTokenReady = (event) => {
      const token = event.detail?.token || resolveSessionToken()
      if (token && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'AUTH',
          token: token
        }))
      }
    }

    window.addEventListener('auth:token_ready', handleTokenReady)
    return () => {
      window.removeEventListener('auth:token_ready', handleTokenReady)
    }
  }, [])


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
    isAuthenticated,
    lastMessage,
    sendMessage,
    socket: socketRef.current
  }
}

export default useWebSocket
