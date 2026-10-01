import { useMemo } from 'react'

/**
 * Hook para filtrar de forma optimizada y memorizada los tickets
 * emitidos en la fecha de hoy, evitando recálculos innecesarios.
 */
export function useTodayTickets(ticketsList = []) {
  return useMemo(() => {
    const todayDateString = new Date().toDateString()
    return ticketsList.filter((ticketItem) => {
      if (!ticketItem.fecha_hora_admision) return false
      return new Date(ticketItem.fecha_hora_admision).toDateString() === todayDateString
    })
  }, [ticketsList])
}
