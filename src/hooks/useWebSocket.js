import { useEffect, useRef, useState, useCallback } from 'react'
import ENVIRONMENT from '../config/enviroment.config'

const WS_HEARTBEAT_INTERVAL_MS = 25000
const RECONNECT_DELAYS_MS = [3000, 6000, 12000, 25000]
const HTTP_KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000
const ACTIVITY_WINDOW_MS = 15 * 60 * 1000
const WAKEUP_PING_COOLDOWN_MS = 30000

const WINDOW_ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

let keepAliveSubscribers = 0
let keepAliveIntervalId = null
let lastOperatorActivityAt = Date.now()
let lastActivityRecordAt = 0
let lastHttpPingAt = 0
let activityListenersAttached = false

function handleOperatorActivity() {
  const now = Date.now()
  if (now - lastActivityRecordAt < 10000) return
  lastActivityRecordAt = now
  lastOperatorActivityAt = now
}

function sendHttpKeepAlivePing(force = false) {
  if (!ENVIRONMENT.URL_API || typeof fetch === 'undefined') return
  const now = Date.now()
  if (!force) {
    const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible'
    const hasRecentActivity = now - lastOperatorActivityAt <= ACTIVITY_WINDOW_MS
    if (!isVisible && !hasRecentActivity) return
  }

  lastHttpPingAt = now
  const baseUrl = ENVIRONMENT.URL_API.replace(/\/+$/, '')
  fetch(`${baseUrl}/auth/ping/`, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store'
  }).catch(() => {})
}

function triggerWakeUpHttpPing() {
  const now = Date.now()
  if (now - lastHttpPingAt < WAKEUP_PING_COOLDOWN_MS) return
  sendHttpKeepAlivePing(true)
}

function registerKeepAliveSubscriber() {
  keepAliveSubscribers += 1

  if (!activityListenersAttached && typeof window !== 'undefined') {
    WINDOW_ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleOperatorActivity, { passive: true })
    })
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleOperatorActivity)
    }
    activityListenersAttached = true
  }

  if (!keepAliveIntervalId && typeof window !== 'undefined') {
    keepAliveIntervalId = window.setInterval(() => {
      sendHttpKeepAlivePing(false)
    }, HTTP_KEEPALIVE_INTERVAL_MS)
  }
}

function unregisterKeepAliveSubscriber() {
  keepAliveSubscribers = Math.max(0, keepAliveSubscribers - 1)
  if (keepAliveSubscribers > 0) return

  if (keepAliveIntervalId && typeof window !== 'undefined') {
    window.clearInterval(keepAliveIntervalId)
    keepAliveIntervalId = null
  }

  if (activityListenersAttached && typeof window !== 'undefined') {
    WINDOW_ACTIVITY_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, handleOperatorActivity)
    })
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleOperatorActivity)
    }
    activityListenersAttached = false
  }
}

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
  const heartbeatIntervalRef = useRef(null)
  const reconnectAttemptRef = useRef(0)
  const isMountedRef = useRef(true)
  const onMessageCallbackRef = useRef(options.onMessage)

  useEffect(() => {
    onMessageCallbackRef.current = options.onMessage
  }, [options.onMessage])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!isMountedRef.current) return

    if (!ENVIRONMENT.URL_WS) {
      console.warn('VITE_WS_URL no está configurada. La conexión WebSocket está deshabilitada.')
      return
    }

    const fullUrl = buildWebSocketUrl(endpointPath)
    if (!fullUrl) return

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    const ws = new WebSocket(fullUrl)
    socketRef.current = ws

    ws.onopen = () => {
      if (!isMountedRef.current || socketRef.current !== ws) return

      reconnectAttemptRef.current = 0
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

      clearHeartbeat()
      heartbeatIntervalRef.current = setInterval(() => {
        if (socketRef.current === ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now()
          }))
        }
      }, WS_HEARTBEAT_INTERVAL_MS)
    }

    ws.onmessage = (event) => {
      if (!isMountedRef.current || socketRef.current !== ws) return

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
      clearHeartbeat()
      if (!isMountedRef.current || socketRef.current !== ws) return

      setIsConnected(false)
      setIsAuthenticated(false)

      // Si el servidor cerró expresamente por permisos (4003 Forbidden), no reintentar en bucle
      if (event.code === 4003) {
        console.warn('WebSocket cerrado por falta de permisos (4003 Forbidden). No se reintentará automáticamente.')
        return
      }

      const shouldReconnect = options.autoReconnect !== false
      if (shouldReconnect) {
        triggerWakeUpHttpPing()
        const attempt = reconnectAttemptRef.current
        const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)]
        reconnectAttemptRef.current = attempt + 1

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect()
          }
        }, delay)
      }
    }

    ws.onerror = () => {
      if (!isMountedRef.current || socketRef.current !== ws) return
      clearHeartbeat()
      if (reconnectAttemptRef.current === 0) {
        console.warn(`Conexión WebSocket (${endpointPath || 'ws'}) interrumpida. Reintentando con backoff exponencial...`)
      }
      ws.close()
    }
  }, [endpointPath, options.autoReconnect, clearHeartbeat])

  useEffect(() => {
    isMountedRef.current = true
    registerKeepAliveSubscriber()
    connect()
    return () => {
      isMountedRef.current = false
      clearHeartbeat()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (socketRef.current) {
        const currentSocket = socketRef.current
        socketRef.current = null
        currentSocket.close()
      }
      unregisterKeepAliveSubscriber()
    }
  }, [connect, clearHeartbeat])

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
