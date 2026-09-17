import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { fetchTicketsApi, createTicketApi, updateTicketByJefaApi } from '../services/ticketService'
import { sortQueueByPriority } from '../utils/triageAlgorithm'
import { getCurrentUtcIso } from '../utils/formatters'
import { assignCallToBoxApi, finishAttentionInBoxApi } from '../services/boxService'

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
  const [loading, setLoading] = useState(false)

  const refreshTickets = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchTicketsApi()
      setTickets(data)
    } catch (err) {
      console.error('Error loading tickets:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshTickets()
  }, [refreshTickets])

  // Cola de pacientes en Espera ordenada automáticamente por el algoritmo de triage inteligente
  const waitingQueue = useMemo(() => {
    const inWaiting = tickets.filter((t) => t.estado === 'Espera')
    return sortQueueByPriority(inWaiting)
  }, [tickets])

  // Mapa de tickets actualmente en atención por box
  const activeInBoxes = useMemo(() => {
    const map = {}
    tickets
      .filter((t) => t.estado === 'En atencion' && t.box_asignado)
      .forEach((t) => {
        map[t.box_asignado] = t
      })
    return map
  }, [tickets])

  const createTicket = useCallback(async (payload) => {
    const newTicket = await createTicketApi(payload)
    setTickets((prev) => [newTicket, ...prev])
    return newTicket
  }, [])

  const callNextPatient = useCallback(
    async (boxNumero, tecnicoMatricula) => {
      const boxKey = `Box ${boxNumero}`
      // Si ya hay un paciente en atención en este box, no llamar a otro sin finalizar
      const currentActive = tickets.find((t) => t.box_asignado === boxKey && t.estado === 'En atencion')
      if (currentActive) {
        throw new Error(`El ${boxKey} ya tiene un paciente en atención (${currentActive.paciente_nombre}). Finalice la consulta primero.`)
      }

      // Obtener el paciente con máxima prioridad de la cola multibox
      const inWaiting = tickets.filter((t) => t.estado === 'Espera')
      const sorted = sortQueueByPriority(inWaiting)
      if (sorted.length === 0) {
        throw new Error('No hay pacientes en espera en la cola multibox.')
      }

      const nextPatient = sorted[0]
      const nowUtc = getCurrentUtcIso()

      // Actualizar el estado del ticket
      const updatedTicket = {
        ...nextPatient,
        estado: 'En atencion',
        fecha_hora_llamado: nowUtc,
        box_asignado: boxKey,
        mat_box: tecnicoMatricula || 'TEC-3391'
      }

      // Actualizar en backend/storage
      await assignCallToBoxApi(boxNumero, updatedTicket.id, tecnicoMatricula)

      setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)))
      return updatedTicket
    },
    [tickets]
  )

  const finishAttention = useCallback(
    async (boxNumero) => {
      const boxKey = `Box ${boxNumero}`
      const activeTicket = tickets.find((t) => t.box_asignado === boxKey && t.estado === 'En atencion')

      if (!activeTicket) {
        throw new Error(`No hay paciente en atención activa en el ${boxKey}.`)
      }

      const nowUtc = getCurrentUtcIso()
      const finishedTicket = {
        ...activeTicket,
        estado: 'Atendido',
        fecha_hora_cierre: nowUtc
      }

      await finishAttentionInBoxApi(boxNumero)

      setTickets((prev) => prev.map((t) => (t.id === finishedTicket.id ? finishedTicket : t)))
      return finishedTicket
    },
    [tickets]
  )

  const updateTicketAsJefa = useCallback(async (ticketId, fields, userRole) => {
    const updated = await updateTicketByJefaApi(ticketId, fields, userRole)
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)))
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
