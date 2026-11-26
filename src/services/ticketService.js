import apiClient from './apiClient'
import { getTriageApiValue, getTriageInfo } from '../constants/triage.constants'
import { normalizePersonFields, normalizePersonName } from '../utils/personName.utils'

function normalizeTicketPersonNames(ticket) {
  if (!ticket) return ticket

  return {
    ...normalizePersonFields(ticket),
    ...(ticket.paciente_detalle
      ? { paciente_detalle: normalizePersonFields(ticket.paciente_detalle) }
      : {}),
    ...(ticket.paciente && typeof ticket.paciente === 'object'
      ? { paciente: normalizePersonFields(ticket.paciente) }
      : {})
  }
}

/**
 * Normaliza los tickets devueltos por DRF a la estructura estándar consumida en React.
 */
export function normalizeTicket(t) {
  if (!t) return null
  const paciente = normalizePersonFields(t.paciente_detalle || {})
  const rawEstudios = Array.isArray(t.estudios) ? t.estudios : []
  const estudiosActivosObj = rawEstudios.filter((e) => {
    if (typeof e === 'string') return true
    return e?.estado !== 'Cancelado'
  })
  const estudiosCanceladosObj = rawEstudios.filter((e) => {
    if (typeof e === 'string') return false
    return e?.estado === 'Cancelado'
  })

  const extractNombre = (e) => {
    if (typeof e === 'string') return e
    return e?.estudio_detalle?.nombre || e?.nombre || 'Práctica Asistencial'
  }

  const estudiosList = (estudiosActivosObj.length > 0 ? estudiosActivosObj : rawEstudios).map(extractNombre)

  let estadoNormalizado = t.estado
  if (t.estado === 'Pendiente') estadoNormalizado = 'Espera'
  else if (t.estado === 'En Atencion') estadoNormalizado = 'En atencion'
  else if (t.estado === 'Finalizado') estadoNormalizado = 'Atendido'

  return {
    ...t,
    id: t.id_ticket || t.id,
    id_ticket: t.id_ticket || t.id,
    num_totem: t.num_totem || '',
    num_llamado: t.num_totem || t.num_llamado || 'S/N',
    fecha_hora_admision: t.fecha_hora_admision,
    mat_admision: t.personal_admision_matricula || t.mat_admision || '',
    personal_admision_matricula: t.personal_admision_matricula || t.mat_admision || '',
    personal_admision_nombre: normalizePersonName(t.personal_admision_nombre || ''),
    personal_box_nombre: normalizePersonName(t.personal_box_nombre || ''),
    personal_box_matricula: t.personal_box_matricula || '',
    fecha_hora_atencion_box: t.fecha_hora_atencion_box || null,
    motivo_cierre_box: t.motivo_cierre_box || '',
    observaciones_cierre_box: t.observaciones_cierre_box || '',
    paciente_id: t.paciente,
    paciente_dni: paciente.dni ? String(paciente.dni) : (t.paciente_dni || ''),
    ...(t.paciente_detalle ? { paciente_detalle: paciente } : {}),
    paciente_nombre: normalizePersonName(paciente.nombre || t.paciente_nombre || ''),
    paciente_apellido: normalizePersonName(paciente.apellidos || t.paciente_apellido || ''),
    paciente_obra_social: paciente.obra_social || t.paciente_obra_social || 'Particular',
    paciente_numero_afiliado: paciente.num_obra_social || t.paciente_numero_afiliado || '',
    clasificacion_triage: getTriageInfo(t.clasificacion_triage).key,
    justificacion_otro: t.justificacion_otro || '',
    box_numero: t.box_numero || null,
    box_asignado: t.box_numero ? `Box ${t.box_numero}` : (t.box_asignado || null),
    estado: estadoNormalizado,
    estado_backend: t.estado,
    fecha_estimada_entrega: t.fecha_estimada_entrega || null,
    demora_horas_max: t.demora_horas_max || null,
    estudio_mayor_demora: t.estudio_mayor_demora || null,
    estudios: estudiosList,
    estudios_raw: rawEstudios,
    estudios_activos: estudiosActivosObj,
    estudios_cancelados: estudiosCanceladosObj
  }
}

/**
 * Obtiene los tickets registrados en el sistema.
 * Si porAtender es true, consulta únicamente los tickets pendientes y en atención activa,
 * evitando recorrer páginas históricas de tickets finalizados.
 */
export async function fetchTicketsApi({
  porAtender = false,
  fecha = null,
  allToday = false,
  cacheBust = false
} = {}) {
  const buildQuery = (page = null) => {
    const params = new URLSearchParams()
    if (porAtender) params.append('por_atender', 'true')
    if (fecha) params.append('fecha', String(fecha))
    if (allToday) params.append('all_today', 'true')
    if (page && page > 1) params.append('page', String(page))
    if (cacheBust || porAtender) params.append('_t', String(Date.now()))
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  if (porAtender) {
    const response = await apiClient.get(`/tickets/${buildQuery()}`)
    const list = Array.isArray(response) ? response : response?.results || []
    return list.map(normalizeTicket)
  }

  const allTickets = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const response = await apiClient.get(`/tickets/${buildQuery(page)}`)
    if (Array.isArray(response)) {
      allTickets.push(...response)
      hasNextPage = false
      continue
    }

    if (!Array.isArray(response?.results)) {
      throw new Error('La respuesta del servidor no contiene una lista válida de tickets.')
    }

    allTickets.push(...response.results)
    hasNextPage = Boolean(response.next)
    page += 1
  }

  return allTickets.map(normalizeTicket)
}

/**
 * Obtiene la cola de espera de tickets pendientes ordenada por prioridad médica (FIFO asistencial).
 */
export async function fetchColaEsperaApi() {
  // CRÍTICO: Romper el caché agregando el timestamp en la query string
  const response = await apiClient.get(`/tickets/cola-espera/?_t=${Date.now()}`)
  const list = Array.isArray(response) ? response : response.results || []
  return list.map(normalizeTicket)
}

/**
 * Obtiene un ticket específico por su ID / UUID.
 */
export async function fetchTicketByIdApi(idTicket, { cacheBust = true } = {}) {
  const query = cacheBust ? `?_t=${Date.now()}` : ''
  const response = await apiClient.get(`/tickets/${idTicket}/${query}`)
  return normalizeTicket(response)
}

/**
 * Emite un nuevo ticket en Admisión.
 * Soporta paciente_datos (alta automática), estudios_ids y reservation_token.
 */
export async function createTicketApi(ticketData) {
  const payload = {
    num_totem: ticketData.num_totem || ticketData.num_llamado || '',
    clasificacion_triage: getTriageApiValue(
      ticketData.clasificacion_triage || 'Extraccion sin turno'
    ),
    justificacion_otro: ticketData.justificacion_otro || '',
    estudios_ids: ticketData.estudios_ids || []
  }

  const reservationToken = ticketData.reservation_token || ticketData.reservationToken
  if (reservationToken) {
    payload.reservation_token = String(reservationToken).trim()
  }

  if (ticketData.paciente_id) {
    payload.paciente = ticketData.paciente_id
  } else {
    payload.paciente_datos = {
      dni: Number(String(ticketData.paciente_dni || ticketData.dni).replace(/\D/g, '')),
      nombre: normalizePersonName(ticketData.paciente_nombre || ticketData.nombre || 'Sin Nombre'),
      apellidos: normalizePersonName(ticketData.paciente_apellido || ticketData.apellido || 'Sin Apellido'),
      obra_social: ticketData.paciente_obra_social || ticketData.obra_social || ticketData.obraSocial || 'IOMA',
      num_obra_social: String(
        ticketData.paciente_numero_afiliado || ticketData.numeroAfiliado || ''
      ).trim()
    }
  }

  const response = await apiClient.post('/tickets/', payload)
  const normalized = normalizeTicket(response)
  return {
    ...normalized,
    mat_admision: response.personal_admision_matricula || normalized.mat_admision || ticketData.mat_admision || '',
    personal_admision_matricula: response.personal_admision_matricula || normalized.personal_admision_matricula || ticketData.mat_admision || '',
    personal_admision_nombre: normalizePersonName(
      response.personal_admision_nombre ||
      normalized.personal_admision_nombre ||
      ticketData.personal_admision_nombre ||
      ''
    )
  }
}

/**
 * Actualiza un ticket emitido (exclusivo para Jefa/Admin bajo ventana de 24h).
 */
export async function updateTicketByJefaApi(ticketId, updatedFields, userRole) {
  if (userRole !== 'Jefa' && userRole !== 'Admin') {
    throw new Error('Solo el rol de Jefa o Admin tiene autorización para modificar tickets emitidos.')
  }

  const payload = updatedFields.clasificacion_triage
    ? {
        ...updatedFields,
        clasificacion_triage: getTriageApiValue(updatedFields.clasificacion_triage)
      }
    : updatedFields

  const response = await apiClient.patch(`/tickets/${ticketId}/`, payload)
  return normalizeTicket(response)
}

/**
 * Borrado lógico / cancelación asistencial de un ticket.
 */
export async function deleteTicketApi(ticketId) {
  return await apiClient.delete(`/tickets/${ticketId}/`)
}

/**
 * Búsqueda asistencial de antecedentes de pacientes por DNI o N° de afiliado vía GET.
 */
export async function searchPatientsApi(query, { scope = 'all', signal } = {}) {
  const raw = String(query || '')
  const clean =
    scope === 'dni'
      ? raw.replace(/\D/g, '')
      : raw.replace(/[^0-9a-zA-Z-]/g, '')

  if (!clean) return []

  const params = new URLSearchParams({
    q: clean,
    scope,
    limit: '20'
  })

  const response = await apiClient.get(
    `/patients/buscar/?${params.toString()}`,
    signal ? { signal } : {}
  )
  const list = Array.isArray(response) ? response : response?.results || []

  return list.map((p) => {
    const obraSocial = p.obra_social || p.obraSocial || ''
    const numAfiliado = p.num_obra_social || p.numeroAfiliado || ''
    return {
      id: p.id_paciente ?? p.id,
      id_paciente: p.id_paciente ?? p.id,
      dni: String(p.dni ?? ''),
      nombre: normalizePersonName(p.nombre || ''),
      apellido: normalizePersonName(p.apellidos || p.apellido || ''),
      apellidos: normalizePersonName(p.apellidos || p.apellido || ''),
      obra_social: obraSocial,
      obraSocial,
      num_obra_social: numAfiliado,
      numeroAfiliado: numAfiliado
    }
  })
}

/**
 * Obtiene las notificaciones persistidas de modificaciones de estudios en Box para Admisión.
 */
export async function fetchStudyNotificationsApi() {
  const response = await apiClient.get(`/tickets/notificaciones-estudios/?_t=${Date.now()}`)
  const rawResults = Array.isArray(response) ? response : response?.results || []
  const results = rawResults.map((n) => ({
    ...n,
    paciente_nombre: normalizePersonName(n.paciente_nombre || ''),
    paciente_apellido: normalizePersonName(n.paciente_apellido || ''),
    actor_nombre: normalizePersonName(n.actor_nombre || '')
  }))

  return {
    ...(typeof response === 'object' && !Array.isArray(response) ? response : {}),
    results,
    unread_count:
      typeof response?.unread_count === 'number'
        ? response.unread_count
        : results.filter((n) => !n.leida).length
  }
}

/**
 * Marca todas las notificaciones pendientes de estudios como leídas en BD.
 */
export async function markAllStudyNotificationsReadApi() {
  return await apiClient.post('/tickets/notificaciones-estudios/marcar-todas-leidas/', {})
}

/**
 * Marca como impresas las etiquetas de los estudios indicados de un ticket.
 */
export async function markTicketLabelsPrintedApi(ticketId, studyIds = []) {
  const response = await apiClient.post(`/tickets/${ticketId}/marcar-etiquetas-impresas/`, {
    study_ids: Array.isArray(studyIds) ? studyIds : []
  })
  return {
    ...response,
    ticket: response?.ticket ? normalizeTicket(response.ticket) : null
  }
}

/**
 * Consulta el rendimiento y carga del personal (tickets emitidos / pacientes atendidos) para una fecha determinada.
 */
export async function fetchRendimientoPersonalApi(fechaStr) {
  const params = new URLSearchParams()
  if (fechaStr) params.append('fecha', fechaStr)

  // Romper el caché para que las métricas de carga de personal sean siempre en tiempo real
  params.append('_t', Date.now())

  const queryString = params.toString() ? `?${params.toString()}` : ''
  return await apiClient.get(`/tickets/rendimiento-personal/${queryString}`)
}

/**
 * Consulta el resumen de estudios de laboratorio realizados en una fecha, con soporte para Top N y búsqueda específica.
 */
export async function fetchResumenEstudiosApi({ fechaStr, search = '', top = null } = {}) {
  const params = new URLSearchParams()
  if (fechaStr) params.append('fecha', fechaStr)
  if (search && search.trim()) params.append('search', search.trim())
  if (top) params.append('top', String(top))

  // Parámetro dinámico para evitar que el navegador cachee la respuesta tras un evento WebSocket
  params.append('_t', Date.now())

  const queryString = params.toString() ? `?${params.toString()}` : ''
  return await apiClient.get(`/tickets/resumen-estudios/${queryString}`)
}

/**
 * Consulta los tickets asistenciales emitidos o atendidos por un integrante del personal.
 * - Para Admisión: tickets emitidos ordenados del último al menor.
 * - Para Box: tickets recibidos y extraídos por el técnico ordenados del último al menor.
 */
export async function fetchTicketsByStaffApi(idPersonal, fechaStr = null) {
  const query = fechaStr ? `?fecha=${fechaStr}` : ''
  const response = await apiClient.get(`/tickets/personal/${idPersonal}/${query}`)
  if (Array.isArray(response)) return response.map(normalizeTicketPersonNames)
  if (Array.isArray(response?.tickets)) {
    return { ...response, tickets: response.tickets.map(normalizeTicketPersonNames) }
  }
  if (Array.isArray(response?.results)) {
    return { ...response, results: response.results.map(normalizeTicketPersonNames) }
  }
  return response
}
