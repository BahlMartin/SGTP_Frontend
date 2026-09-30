import { getTriageInfo } from '../constants/triage.constants'

/**
 * Ordena la cola multibox por severidad de triage (menor número = mayor urgencia).
 * Si tienen la misma urgencia, prioriza al paciente que lleva más tiempo en espera (FIFO).
 */
export function sortQueueByPriority(tickets) {
  return [...tickets].sort((a, b) => {
    const infoA = getTriageInfo(a.clasificacion_triage)
    const infoB = getTriageInfo(b.clasificacion_triage)

    if (infoA.priority !== infoB.priority) {
      return infoA.priority - infoB.priority
    }

    const timeA = new Date(a.fecha_hora_admision || 0).getTime()
    const timeB = new Date(b.fecha_hora_admision || 0).getTime()
    return timeA - timeB
  })
}
