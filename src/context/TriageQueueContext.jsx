import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchTicketsApi,
  fetchColaEsperaApi,
  createTicketApi,
  updateTicketByJefaApi
} from '../services/ticketService'
import {
  llamarSiguientePacienteApi,
  cerrarAtencionBoxApi
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
  const [tickets, setTickets] = useState([])
  const [waitingQueue, setWaitingQueue] = useState([])
  const [loading, setLoading] = useState(false)

  const refreshTickets = useCallback(async () => {
    setLoading(true)
    try {
      const [allTickets, colaEspera] = await Promise.all([
        fetchTicketsApi(),
        fetchColaEsperaApi()
      ])
      setTickets(allTickets)
      setWaitingQueue(colaEspera)
    } catch (err) {
      console.error('Error al sincronizar tickets con el backend:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshTickets()
  }, [refreshTickets])

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
    setTickets((prev) => [newTicket, ...prev])
    setWaitingQueue((prev) => [newTicket, ...prev])
    return newTicket
  }, [])

  const callNextPatient = useCallback(
    async (boxNumero) => {
      const result = await llamarSiguientePacienteApi(boxNumero)
      if (!result.ticket) {
        throw new Error(result.mensaje || 'No hay pacientes en cola de espera para este Box.')
      }

      await refreshTickets()
      return result.ticket
    },
    [refreshTickets]
  )

  const finishAttention = useCallback(
    async (boxNumero, motivo = 'Finalizado') => {
      const result = await cerrarAtencionBoxApi(boxNumero, motivo)
      await refreshTickets()
      return result
    },
    [refreshTickets]
  )

  const updateTicketAsJefa = useCallback(async (ticketId, fields, userRole) => {
    const updated = await updateTicketByJefaApi(ticketId, fields, userRole)
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
        updateTicketAsJefa,
        refreshTickets
      }}
    >
      {children}
    </TriageQueueContext.Provider>
  )
}

export const useTriageQueue = () => useContext(TriageQueueContext)
