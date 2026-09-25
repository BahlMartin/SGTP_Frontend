import { calculateMinutesDiff, formatDurationHuman } from '../utils/formatters'

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
  const dayTickets = tickets.filter((t) => sameLocalDay(t.fecha_hora_admision, safeTarget))

  let atendidos = 0
  let enCurso = 0
  let ingresos = 0
  let criticos = 0

  let totalEsperaMinutos = 0
  let countConEspera = 0

  let totalAtencionMinutos = 0
  let countConAtencion = 0

  const triageCounts = {
    guardia: 0,
    medicos: 0,
    discapacidad: 0,
    oncologia: 0,
    extraccion_con_turno: 0,
    extraccion_sin_turno: 0,
    otro: 0
  }

  const categoryMap = {
    guardia: 'guardia',
    medicos: 'medicos',
    discapacidad: 'discapacidad',
    oncologia: 'oncologia',
    'extraccion con turno': 'extraccion_con_turno',
    'extraccion sin turno': 'extraccion_sin_turno',
    otro: 'otro'
  }

  dayTickets.forEach((t) => {
    // Clasificación de Triage
    const key = (t.clasificacion_triage || '').toLowerCase().trim()
    const mapped = categoryMap[key] || 'otro'
    triageCounts[mapped] = (triageCounts[mapped] || 0) + 1

    if (mapped === 'guardia' || mapped === 'medicos') {
      criticos++
    }

    // Estados
    if (t.estado === 'Atendido') {
      atendidos++
    } else if (t.estado === 'En atencion') {
      enCurso++
    } else if (t.estado === 'Espera') {
      ingresos++
    }

    // Tiempo de Espera (Emisión -> Llamado)
    if (t.fecha_hora_admision && t.fecha_hora_llamado) {
      const wait = calculateMinutesDiff(t.fecha_hora_admision, t.fecha_hora_llamado)
      if (wait !== null && wait >= 0) {
        totalEsperaMinutos += wait
        countConEspera++
      }
    }

    // Tiempo de Atención (Llamado -> Cierre)
    if (t.fecha_hora_llamado && t.fecha_hora_cierre) {
      const duration = calculateMinutesDiff(t.fecha_hora_llamado, t.fecha_hora_cierre)
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
