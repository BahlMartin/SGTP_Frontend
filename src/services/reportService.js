import apiClient from './apiClient'
import { formatDurationHuman, getArgentinaDateString, getTodayLocalDateString } from '../utils/formatters'
import { TRIAGE_LIST, TRIAGE_CATEGORIES, getTriageInfo } from '../constants/triage.constants'

/**
 * Cálculo asistencial local de métricas a partir del conjunto de tickets.
 */
export function computeDailyReportMetrics(tickets = [], targetDate = new Date(), targetEndDate = null) {
  let startDateStr = ''
  if (targetDate instanceof Date) {
    startDateStr = getArgentinaDateString(targetDate)
  } else if (typeof targetDate === 'string') {
    startDateStr = targetDate.slice(0, 10)
  }

  let endDateStr = startDateStr
  if (targetEndDate instanceof Date) {
    endDateStr = getArgentinaDateString(targetEndDate)
  } else if (typeof targetEndDate === 'string' && targetEndDate.trim()) {
    endDateStr = targetEndDate.slice(0, 10)
  }

  if (endDateStr < startDateStr) {
    const tmp = startDateStr
    startDateStr = endDateStr
    endDateStr = tmp
  }

  const dayTickets = tickets.filter((ticket) => {
    if (!ticket.fecha_hora_admision) return false
    const ticketDateStr = getArgentinaDateString(ticket.fecha_hora_admision)
    return ticketDateStr >= startDateStr && ticketDateStr <= endDateStr
  })

  let atendidos = 0
  let cancelados = 0
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
    } else if (ticket.estado === 'Cancelado') {
      cancelados++
    } else if (ticket.estado === 'En atencion' || ticket.estado === 'En Atencion') {
      enCurso++
    } else if (ticket.estado === 'Espera' || ticket.estado === 'Pendiente') {
      ingresos++
    }
  })

  const totalIngresos = dayTickets.length || ingresos
  const tasaCompletitud = totalIngresos > 0 ? Number(((atendidos / totalIngresos) * 100).toFixed(1)) : 0
  const tasaDesercion = totalIngresos > 0 ? Number(((cancelados / totalIngresos) * 100).toFixed(1)) : 0

  return {
    atendidos,
    cancelados,
    enCurso,
    ingresos: totalIngresos,
    criticos,
    tasaCompletitud,
    tasaDesercion,
    esperaPromedio: '—',
    atencionPromedio: '—',
    triageDistribution: triageCounts,
    slaTriage: [],
    franjasHorarias: [],
    resumenEstudiosRealizadosPorSeccion: null,
    resumenEstudiosRealizadosPorMuestra: null,
    tickets: dayTickets
  }
}

/**
 * Consulta las métricas consolidadas del reporte diario o por rango en el backend.
 */
export async function fetchMetricasDiariasApi(fechaStr, fechaHastaStr = null) {
  const desde = fechaStr || getTodayLocalDateString()
  const hasta = fechaHastaStr || desde
  const query =
    desde === hasta
      ? `?fecha=${desde}&_t=${Date.now()}`
      : `?fecha_desde=${desde}&fecha_hasta=${hasta}&_t=${Date.now()}`
  const data = await apiClient.get(`/reports/metricas-diarias/${query}`)

  const resumenEstudiosRealizadosPorSeccion = Array.isArray(data.resumen_estudios_realizados_por_seccion)
    ? data.resumen_estudios_realizados_por_seccion
    : Array.isArray(data.resumen_secciones)
      ? data.resumen_secciones.map((section) => ({
          seccion_key: section.seccion_key,
          nombre_seccion: section.nombre_seccion || section.seccion_nombre || 'Sección',
          total_estudios: section.total_estudios ?? section.total ?? 0
        }))
      : null

  let resumenEstudiosRealizadosPorMuestra = data.resumen_estudios_realizados_por_muestra
  if (!Array.isArray(resumenEstudiosRealizadosPorMuestra) && Array.isArray(data.insumos_tubos)) {
    const sampleCounts = {
      sangre: 0,
      orina: 0,
      'materia fecal': 0,
      otros: 0
    }
    const bloodSampleTypes = new Set(['edta', 'citrato', 'suero', 'jeringa', 'sangre'])

    data.insumos_tubos.forEach((sample) => {
      const sampleType = String(sample.tipo_muestra || '').trim().toLowerCase()
      const sampleGroup = bloodSampleTypes.has(sampleType)
        ? 'sangre'
        : sampleType === 'orina'
          ? 'orina'
          : sampleType === 'materia fecal'
            ? 'materia fecal'
            : 'otros'
      sampleCounts[sampleGroup] += Number(sample.total_estudios ?? sample.total_tubos ?? sample.total ?? 0)
    })

    resumenEstudiosRealizadosPorMuestra = [
      { muestra_key: 'sangre', nombre_muestra: 'Sangre', total_estudios: sampleCounts.sangre },
      { muestra_key: 'orina', nombre_muestra: 'Orina', total_estudios: sampleCounts.orina },
      { muestra_key: 'materia fecal', nombre_muestra: 'Materia fecal', total_estudios: sampleCounts['materia fecal'] },
      ...(sampleCounts.otros > 0
        ? [{ muestra_key: 'otros', nombre_muestra: 'Otros', total_estudios: sampleCounts.otros }]
        : [])
    ]
  }

  // Mapear distribución de triage al formato esperado por los componentes React
  const triageMap = Object.fromEntries(TRIAGE_LIST.map((c) => [c.id, 0]))
  const normalizeCategory = (value) =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s.-]+/g, '_')

  const resolveCategoryId = (rawValue) => {
    const categoryKey = normalizeCategory(rawValue)
    const matched = TRIAGE_LIST.find((category) =>
      [category.id, category.key, category.label, category.code].some(
        (value) => normalizeCategory(value) === categoryKey
      )
    )
    return matched ? matched.id : categoryKey || String(rawValue ?? '')
  }

  if (Array.isArray(data.distribucion_triage)) {
    data.distribucion_triage.forEach((item) => {
      const resolvedId = resolveCategoryId(item.clasificacion_triage)
      const quantity = Number(item.cantidad) || 0

      if (resolvedId in triageMap) {
        triageMap[resolvedId] += quantity
      } else {
        triageMap[resolvedId] = quantity
      }
    })
  }

  const slaTriage = Array.isArray(data.sla_triage)
    ? data.sla_triage.map((item) => ({
        ...item,
        triage_key: resolveCategoryId(item.clasificacion_triage),
        total_pacientes: Number(item.total_pacientes) || 0,
        promedio_espera_minutos: Number(item.promedio_espera_minutos) || 0
      }))
    : []

  const franjasHorarias = Array.isArray(data.franjas_horarias)
    ? data.franjas_horarias.map((slot) => ({
        ...slot,
        total_emitidos: Number(slot.total_emitidos) || 0,
        total_atendidos: Number(slot.total_atendidos) || 0,
        total_cancelados: Number(slot.total_cancelados) || 0,
        promedio_espera_minutos: Number(slot.promedio_espera_minutos) || 0,
        promedio_atencion_minutos: Number(slot.promedio_atencion_minutos) || 0,
        distribucion_triage: Array.isArray(slot.distribucion_triage)
          ? slot.distribucion_triage.map((tItem) => ({
              ...tItem,
              triage_key: resolveCategoryId(tItem.clasificacion_triage),
              cantidad: Number(tItem.cantidad) || 0
            }))
          : []
      }))
    : []

  const enCurso = Math.max(
    0,
    (data.total_emitidos || 0) - (data.total_atendidos || 0) - (data.total_cancelados || 0)
  )
  return {
    fecha: data.fecha,
    atendidos: data.total_atendidos || 0,
    ingresos: data.total_emitidos || 0,
    cancelados: data.total_cancelados || 0,
    enCurso,
    criticos: data.total_criticos_atendidos || 0,
    tasaCompletitud: Number(data.tasa_completitud_porcentaje) || 0,
    tasaDesercion: Number(data.tasa_desercion_porcentaje) || 0,
    esperaPromedio: data.promedio_espera_minutos ? formatDurationHuman(Math.round(data.promedio_espera_minutos)) : '—',
    atencionPromedio: data.promedio_atencion_minutos ? formatDurationHuman(Math.round(data.promedio_atencion_minutos)) : '—',
    triageDistribution: triageMap,
    slaTriage,
    franjasHorarias,
    resumenSecciones: data.resumen_secciones || [],
    resumenEstudiosRealizadosPorSeccion,
    resumenEstudiosRealizadosPorMuestra,
    insumosTubos: data.insumos_tubos || [],
    auditoriaBox: data.auditoria_box || {},
    totalEstudios: data.total_estudios || 0,
    raw: data
  }
}

/**
 * Descarga el archivo PDF oficial compilado en tiempo real por el backend.
 */
export async function downloadReportePdfApi(fechaStr, fechaHastaStr = null) {
  const desde = fechaStr || ''
  const hasta = fechaHastaStr || desde
  let query = ''
  if (desde && hasta && desde !== hasta) {
    query = `?fecha_desde=${desde}&fecha_hasta=${hasta}`
  } else if (desde) {
    query = `?fecha=${desde}`
  }
  const blob = await apiClient.download(`/reports/descargar-pdf/${query}`)
  const fileLabel = desde && hasta && desde !== hasta ? `${desde}_a_${hasta}` : desde || 'hoy'

  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Reporte_Asistencial_${fileLabel}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)

  return true
}

/**
 * Descarga el libro Excel (.xlsx) oficial de 6 hojas compilado en tiempo real por el backend.
 */
export async function downloadReporteExcelApi(fechaStr, fechaHastaStr = null) {
  const desde = fechaStr || ''
  const hasta = fechaHastaStr || desde
  let query = ''
  if (desde && hasta && desde !== hasta) {
    query = `?fecha_desde=${desde}&fecha_hasta=${hasta}`
  } else if (desde) {
    query = `?fecha=${desde}`
  }
  const blob = await apiClient.download(`/reports/descargar-excel/${query}`)
  const fileLabel = desde && hasta && desde !== hasta ? `${desde}_a_${hasta}` : desde || 'hoy'

  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Reporte_Asistencial_${fileLabel}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)

  return true
}

/**
 * Dispara el despacho manual del reporte diario o por rango vía correo institucional SMTP.
 */
export async function dispararEnvioReporteApi(fechaStr, emailDestinatario, fechaHastaStr = null) {
  const desde = fechaStr
  const hasta = fechaHastaStr || desde
  const payload =
    desde && hasta && desde !== hasta
      ? { fecha_desde: desde, fecha_hasta: hasta }
      : { fecha: desde }
  if (emailDestinatario !== undefined && emailDestinatario !== null) {
    payload.email_destinatario = emailDestinatario
  }
  return await apiClient.post('/reports/disparar-envio/', payload)
}

export async function sendDailyReportEmailApi(fechaStr, emailDestinatario, fechaHastaStr = null) {
  const response = await dispararEnvioReporteApi(fechaStr, emailDestinatario, fechaHastaStr)
  return {
    success: true,
    message: response.mensaje || 'Reporte asistencial despachado exitosamente por correo institucional.',
    resultado: response.resultado
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
    if (ticketItem.estado === 'Cancelado') return
    ticketItem.estudios?.forEach((studyName) => {
      const name = String(studyName).trim()
      if (name) studyCounts.set(name, (studyCounts.get(name) || 0) + 1)
    })
  })

  return Array.from(studyCounts, ([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
    .slice(0, 5)
}
