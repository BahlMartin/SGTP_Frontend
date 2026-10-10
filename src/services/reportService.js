import apiClient from './apiClient'
import { formatDurationHuman, getArgentinaDateString, getTodayLocalDateString } from '../utils/formatters'
import { TRIAGE_LIST, TRIAGE_CATEGORIES, getTriageInfo } from '../constants/triage.constants'

/**
 * Cálculo asistencial local de métricas a partir del conjunto de tickets.
 */
export function computeDailyReportMetrics(tickets = [], targetDate = new Date()) {
  let targetDateStr = ''
  if (targetDate instanceof Date) {
    targetDateStr = getArgentinaDateString(targetDate)
  } else if (typeof targetDate === 'string') {
    targetDateStr = targetDate.slice(0, 10)
  }

  const dayTickets = tickets.filter((ticket) => {
    if (!ticket.fecha_hora_admision) return false
    return getArgentinaDateString(ticket.fecha_hora_admision) === targetDateStr
  })

  let atendidos = 0
  let enCurso = 0
  let ingresos = 0
  let criticos = 0

  const triageCounts = Object.fromEntries(
    TRIAGE_LIST.map((category) => [category.id, 0])
  )

  dayTickets.forEach((ticket) => {
    const triageInfo = getTriageInfo(ticket.clasificacion_triage)
    triageCounts[triageInfo.id] = (triageCounts[triageInfo.id] || 0) + 1

    if (ticket.estado === 'Atendido' || ticket.estado === 'Finalizado') {
      atendidos++
      if (
        triageInfo.id === TRIAGE_CATEGORIES.GUARDIA.id ||
        triageInfo.id === TRIAGE_CATEGORIES.MEDICOS.id
      ) {
        criticos++
      }
    } else if (ticket.estado === 'En atencion' || ticket.estado === 'En Atencion') {
      enCurso++
    } else if (ticket.estado === 'Espera' || ticket.estado === 'Pendiente') {
      ingresos++
    }
  })

  return {
    atendidos,
    enCurso,
    ingresos: dayTickets.length || ingresos,
    criticos,
    esperaPromedio: '—',
    atencionPromedio: '—',
    triageDistribution: triageCounts,
    tickets: dayTickets
  }
}

/**
 * Consulta las métricas consolidadas del reporte diario en el backend.
 */
export async function fetchMetricasDiariasApi(fechaStr) {
  const query = `?fecha=${fechaStr || getTodayLocalDateString()}`
  const data = await apiClient.get(`/reports/metricas-diarias/${query}`)

  // Mapear distribución de triage al formato esperado por los componentes React
  const triageMap = Object.fromEntries(TRIAGE_LIST.map((c) => [c.id, 0]))
  if (Array.isArray(data.distribucion_triage)) {
    data.distribucion_triage.forEach((item) => {
      const catKey = String(item.clasificacion_triage || '').toLowerCase().replace(/\s+/g, '_')
      const matched = TRIAGE_LIST.find(
        (t) => t.id === catKey || t.nombre?.toLowerCase() === String(item.clasificacion_triage).toLowerCase()
      )
      if (matched) {
        triageMap[matched.id] = (triageMap[matched.id] || 0) + item.cantidad
      } else {
        triageMap[item.clasificacion_triage] = item.cantidad
      }
    })
  }

  const enCurso = Math.max(0, (data.total_emitidos || 0) - (data.total_atendidos || 0))

  return {
    fecha: data.fecha,
    atendidos: data.total_atendidos || 0,
    ingresos: data.total_emitidos || 0,
    enCurso,
    criticos: data.total_criticos_atendidos || 0,
    esperaPromedio: data.promedio_espera_minutos ? formatDurationHuman(Math.round(data.promedio_espera_minutos)) : '—',
    atencionPromedio: data.promedio_atencion_minutos ? formatDurationHuman(Math.round(data.promedio_atencion_minutos)) : '—',
    triageDistribution: triageMap,
    rendimientoPersonal: data.rendimiento_personal || [],
    totalEstudios: data.total_estudios || 0,
    raw: data
  }
}

/**
 * Descarga el archivo PDF oficial compilado en tiempo real por el backend.
 */
export async function downloadReportePdfApi(fechaStr) {
  const query = fechaStr ? `?fecha=${fechaStr}` : ''
  const blob = await apiClient.download(`/reports/descargar-pdf/${query}`)

  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Reporte_Asistencial_${fechaStr || 'hoy'}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)

  return true
}

/**
 * Dispara el despacho manual del reporte diario vía correo institucional SMTP.
 */
export async function dispararEnvioReporteApi(fechaStr) {
  return await apiClient.post('/reports/disparar-envio/', { fecha: fechaStr })
}

export async function sendDailyReportEmailApi(fechaStr) {
  const response = await dispararEnvioReporteApi(fechaStr)
  return {
    success: true,
    message: response.mensaje || 'Reporte asistencial despachado exitosamente por correo institucional.'
  }
}

/**
 * Obtiene el historial de auditoría de reportes diarios generados y despachados.
 */
export async function fetchHistorialReportesApi() {
  const response = await apiClient.get('/reports/historial/')
  return Array.isArray(response) ? response : response.results || []
}

export async function fetchHistorialReporteByIdApi(id) {
  return await apiClient.get(`/reports/historial/${id}/`)
}

export function computeTopLabStudies(tickets = []) {
  const studyCounts = new Map()

  tickets.forEach((ticketItem) => {
    ticketItem.estudios?.forEach((studyName) => {
      const name = String(studyName).trim()
      if (name) studyCounts.set(name, (studyCounts.get(name) || 0) + 1)
    })
  })

  return Array.from(studyCounts, ([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
    .slice(0, 5)
}
