import { useMemo } from 'react'
import { getArgentinaDateString, getTodayLocalDateString } from '../utils/formatters'

/**
 * Hook para filtrar de forma optimizada y memorizada los tickets
 * emitidos en la fecha de hoy, evitando recálculos innecesarios.
 */
export function useTodayTickets(ticketsList = []) {
  return useMemo(() => {
    const todayDateString = getTodayLocalDateString()
    return ticketsList.filter((ticketItem) => {
      if (!ticketItem.fecha_hora_admision) return false
      return getArgentinaDateString(ticketItem.fecha_hora_admision) === todayDateString
    })
  }, [ticketsList])
}
