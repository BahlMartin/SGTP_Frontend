import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from './AuthContext'
import useWebSocket from '../hooks/useWebSocket'
import {
  fetchTicketsApi,
  fetchColaEsperaApi,
  createTicketApi,
  updateTicketByJefaApi
} from '../services/ticketService'
import {
  llamarSiguientePacienteApi,
  cerrarAtencionBoxApi,
  modificarEstudiosBoxApi
} from '../services/boxService'

export const TriageQueueContext = createContext({
  tickets: [],
  waitingQueue: [],
  activeInBoxes: {},
  loading: false,
  createTicket: async () => {},
  callNextPatient: async () => {},
  finishAttention: async () => {},
  updateTicketAsJefa: async () => {},
  refreshTickets: async () => {}
})

export const TriageQueueContextProvider = ({ children }) => {
  const { isLogged, userData } = useAuth()
  const userRole = userData?.rol || null
  const [tickets, setTickets] = useState([])
  const [waitingQueue, setWaitingQueue] = useState([])
  const [loading, setLoading] = useState(false)

  const requestVersionRef = useRef(0)
  const inFlightRefreshRef = useRef(null)
  const inFlightVersionRef = useRef(0)
  const debounceTimerRef = useRef(null)
  const pendingWaitersRef = useRef([])
  const isLoggedRef = useRef(isLogged)
  useEffect(() => {
    isLoggedRef.current = isLogged
  }, [isLogged])

  const executeRefresh = useCallback(async () => {
    if (!isLoggedRef.current) return

    if (inFlightRefreshRef.current && inFlightVersionRef.current === requestVersionRef.current) {
      return inFlightRefreshRef.current
    }

    const fetchVersion = ++requestVersionRef.current
    inFlightVersionRef.current = fetchVersion
    setLoading(true)

    const refreshPromise = (async () => {
      try {
        const soloPorAtender = userRole === 'Box'
        const [allTickets, colaEspera] = await Promise.all([
          soloPorAtender
            ? fetchTicketsApi({ porAtender: true, cacheBust: true })
            : fetchTicketsApi({ porAtender: false, fecha: 'hoy', allToday: true, cacheBust: true }),
          fetchColaEsperaApi()
        ])
        if (fetchVersion === requestVersionRef.current && isLoggedRef.current) {
          setTickets(allTickets)
          setWaitingQueue(colaEspera)
        }
      } catch (err) {
        console.error('Error al sincronizar tickets con el backend:', err)
      } finally {
        if (inFlightRefreshRef.current === refreshPromise) {
          inFlightRefreshRef.current = null
        }
        if (fetchVersion === requestVersionRef.current) {
          setLoading(false)
        }
      }
    })()

    inFlightRefreshRef.current = refreshPromise
    return refreshPromise
  }, [userRole])

  const refreshTickets = useCallback(
    ({ immediate = false } = {}) => {
      if (!isLoggedRef.current) return Promise.resolve()

      if (immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        const waiters = pendingWaitersRef.current.splice(0)
        const promise = executeRefresh()
        promise.then(
          (res) => waiters.forEach((w) => w.resolve(res)),
          (err) => waiters.forEach((w) => w.reject(err))
        )
        return promise
      }

      if (
        inFlightRefreshRef.current &&
        !debounceTimerRef.current &&
        inFlightVersionRef.current === requestVersionRef.current
      ) {
        return inFlightRefreshRef.current
      }

      return new Promise((resolve, reject) => {
        pendingWaitersRef.current.push({ resolve, reject })
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null
          const waiters = pendingWaitersRef.current.splice(0)
          executeRefresh().then(
            (res) => waiters.forEach((w) => w.resolve(res)),
            (err) => waiters.forEach((w) => w.reject(err))
          )
        }, 150)
      })
    },
    [executeRefresh]
  )

  useWebSocket('queue', {
    onMessage: useCallback((msg) => {
      const evt = msg?.event || msg?.action
      if ([
        'QUEUE_UPDATED',
        'TICKET_CREATED',
        'NEW_TICKET',
        'TICKET_LLAMADO',
        'TICKET_UPDATED',
        'TICKET_FINISHED',
        'TICKET_CANCELLED',
        'TICKET_STUDIES_UPDATED',
        'BOX_STUDIES_UPDATED',
        'ESTUDIOS_MODIFICADOS'
      ].includes(evt)) {
        refreshTickets()
      }
    }, [refreshTickets])
  })

  useWebSocket('tickets', {
    onMessage: useCallback((msg) => {
      const evt = msg?.event || msg?.action
      if ([
        'TICKET_CREATED',
        'NEW_TICKET',
        'TICKET_UPDATED',
        'TICKET_FINISHED',
        'TICKET_CANCELLED',
        'TICKET_LABELS_PRINTED',
        'TICKET_STUDIES_UPDATED',
        'BOX_STUDIES_UPDATED',
        'ESTUDIOS_MODIFICADOS',
        'TICKET_LLAMADO'
      ].includes(evt)) {
        refreshTickets()
      }
    }, [refreshTickets])
  })

  useEffect(() => {
    if (isLogged) {
      refreshTickets({ immediate: true })
    } else {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      pendingWaitersRef.current.splice(0).forEach((w) => w.resolve())
      requestVersionRef.current += 1
      inFlightRefreshRef.current = null
      setTickets([])
      setWaitingQueue([])
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [isLogged, refreshTickets])

  // Mapa de tickets actualmente en atención por box
  const activeInBoxes = useMemo(() => {
    const map = {}
    for (const t of tickets) {
      if (t.estado === 'En atencion' && t.box_asignado) {
        map[t.box_asignado] = t
      }
    }
    return map
  }, [tickets])

  const createTicket = useCallback(async (payload) => {
    const newTicket = await createTicketApi(payload)
    requestVersionRef.current += 1
    setTickets((prev) => [newTicket, ...prev.filter((t) => t.id !== newTicket.id)])
    setWaitingQueue((prev) => [newTicket, ...prev.filter((t) => t.id !== newTicket.id)])
    return newTicket
  }, [])

  const callNextPatient = useCallback(
    async (boxNumero, ticketId = null) => {
      const result = await llamarSiguientePacienteApi(boxNumero, ticketId)
      if (!result.ticket) {
        throw new Error(result.mensaje || 'No hay pacientes en cola de espera para este Box.')
      }

      await refreshTickets({ immediate: true })
      return result.ticket
    },
    [refreshTickets]
  )

  const finishAttention = useCallback(
    async (boxNumero, motivo = 'Finalizado', observaciones = '') => {
      const result = await cerrarAtencionBoxApi(boxNumero, motivo, observaciones)
      await refreshTickets({ immediate: true })
      return result
    },
    [refreshTickets]
  )

  const updateBoxStudies = useCallback(
    async (boxNumero, { cancelarEstudios, agregarEstudios }) => {
      const result = await modificarEstudiosBoxApi(boxNumero, { cancelarEstudios, agregarEstudios })
      if (result.ticket) {
        requestVersionRef.current += 1
        setTickets((prev) => prev.map((t) => (t.id === result.ticket.id ? result.ticket : t)))
      }
      await refreshTickets({ immediate: true })
      return result
    },
    [refreshTickets]
  )

  const updateTicketAsJefa = useCallback(async (ticketId, fields, roleArg) => {
    const updated = await updateTicketByJefaApi(ticketId, fields, roleArg)
    requestVersionRef.current += 1
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)))
    setWaitingQueue((prev) => prev.map((t) => (t.id === ticketId ? updated : t)))
    return updated
  }, [])

  return (
    <TriageQueueContext.Provider
      value={{
        tickets,
        waitingQueue,
        activeInBoxes,
        loading,
        createTicket,
        callNextPatient,
        finishAttention,
        updateBoxStudies,
        updateTicketAsJefa,
        refreshTickets
      }}
    >
      {children}
    </TriageQueueContext.Provider>
  )
}

export const useTriageQueue = () => useContext(TriageQueueContext)
