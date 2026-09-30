import { calculateMinutesDiff, formatDurationHuman } from '../utils/formatters'
import { TRIAGE_CATEGORIES, TRIAGE_LIST, getTriageInfo } from '../constants/triage.constants'

function parseLocalDateInput(value) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string') {
    const [year, month, day] = value.split('-').map(Number)
    if (year && month && day) {
      return new Date(year, month - 1, day)
    }
  }

  return new Date()
}

function sameLocalDay(dateValue, targetDate) {
  if (!dateValue) return false
  const ticketDate = new Date(dateValue)
  const normalizedTicket = new Date(
    ticketDate.getFullYear(),
    ticketDate.getMonth(),
    ticketDate.getDate()
  )
  const normalizedTarget = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  )
  return normalizedTicket.getTime() === normalizedTarget.getTime()
}

export function computeDailyReportMetrics(tickets = [], targetDate = new Date()) {
  const safeTarget = parseLocalDateInput(targetDate)

  // Filtrar tickets correspondientes al día seleccionado
  const dayTickets = tickets.filter((ticket) => sameLocalDay(ticket.fecha_hora_admision, safeTarget))

  let atendidos = 0
  let enCurso = 0
  let ingresos = 0
  let criticos = 0

  let totalEsperaMinutos = 0
  let countConEspera = 0

  let totalAtencionMinutos = 0
  let countConAtencion = 0

  const triageCounts = Object.fromEntries(
    TRIAGE_LIST.map((category) => [category.id, 0])
  )

  dayTickets.forEach((ticket) => {
    // Clasificación de Triage
    const triageInfo = getTriageInfo(ticket.clasificacion_triage)
    triageCounts[triageInfo.id] = (triageCounts[triageInfo.id] || 0) + 1

    if (triageInfo.id === TRIAGE_CATEGORIES.GUARDIA.id || triageInfo.id === TRIAGE_CATEGORIES.MEDICOS.id) {
      criticos++
    }

    // Estados
    if (ticket.estado === 'Atendido') {
      atendidos++
    } else if (ticket.estado === 'En atencion') {
      enCurso++
    } else if (ticket.estado === 'Espera') {
      ingresos++
    }

    // Tiempo de Espera (Emisión -> Llamado)
    if (ticket.fecha_hora_admision && ticket.fecha_hora_llamado) {
      const wait = calculateMinutesDiff(ticket.fecha_hora_admision, ticket.fecha_hora_llamado)
      if (wait !== null && wait >= 0) {
        totalEsperaMinutos += wait
        countConEspera++
      }
    }

    // Tiempo de Atención (Llamado -> Cierre)
    if (ticket.fecha_hora_llamado && ticket.fecha_hora_cierre) {
      const duration = calculateMinutesDiff(ticket.fecha_hora_llamado, ticket.fecha_hora_cierre)
      if (duration !== null && duration >= 0) {
        totalAtencionMinutos += duration
        countConAtencion++
      }
    }
  })

  const avgEspera = countConEspera > 0 ? Math.round(totalEsperaMinutos / countConEspera) : null
  const avgAtencion = countConAtencion > 0 ? Math.round(totalAtencionMinutos / countConAtencion) : null

  return {
    atendidos,
    enCurso,
    ingresos,
    criticos,
    esperaPromedio: formatDurationHuman(avgEspera),
    atencionPromedio: formatDurationHuman(avgAtencion),
    triageDistribution: triageCounts,
    tickets: dayTickets
  }
}

export async function sendDailyReportEmailApi(jornadaDate, recipientEmail) {
  // Simulación de despacho por servicio de mensajería seguro SMTP institucional
  await new Promise((resolve) => setTimeout(resolve, 800))
  return {
    success: true,
    message: `Informe diario de la jornada enviado con éxito a ${recipientEmail || 'jefa@sgtp.hospital.gob.ar'}.`
  }
}

export const LAB_STUDY_CATEGORIES = ['Hemograma', 'Bioquimica', 'Orina', 'Cultivo', 'Otro']

export function computeLabMatrix(tickets = []) {
  return LAB_STUDY_CATEGORIES.map((categoryName) => {
    let total = 0
    let pendientes = 0
    let enCurso = 0
    let listos = 0

    tickets.forEach((ticketItem) => {
      const tieneCategoria = ticketItem.estudios?.some((studyName) =>
        studyName.toLowerCase().includes(categoryName.toLowerCase())
      )

      if (tieneCategoria) {
        total++
        if (ticketItem.estado === 'Espera') {
          pendientes++
        } else if (ticketItem.estado === 'En atencion') {
          enCurso++
        } else if (ticketItem.estado === 'Atendido') {
          listos++
        }
      }
    })

    return {
      nombre: categoryName,
      total,
      pend: pendientes,
      curso: enCurso,
      listos
    }
  })
}

