import apiClient from './apiClient'
import { getTriageApiValue, getTriageInfo } from '../constants/triage.constants'

/**
 * Normaliza los tickets devueltos por DRF a la estructura estándar consumida en React.
 */
export function normalizeTicket(t) {
  if (!t) return null
  const paciente = t.paciente_detalle || {}
  const estudiosList = (t.estudios || []).map((e) => {
    if (typeof e === 'string') return e
    return e?.estudio_detalle?.nombre || e?.nombre || 'Práctica Asistencial'
  })

  let estadoNormalizado = t.estado
  if (t.estado === 'Pendiente') estadoNormalizado = 'Espera'
  else if (t.estado === 'En Atencion') estadoNormalizado = 'En atencion'
  else if (t.estado === 'Finalizado') estadoNormalizado = 'Atendido'

  return {
    ...t,
    id: t.id_ticket || t.id,
    id_ticket: t.id_ticket || t.id,
    num_totem: t.num_totem,
    num_llamado: t.num_totem ? t.num_totem.replace(/[^\d]/g, '') || t.num_totem : (t.num_llamado || '101'),
    fecha_hora_admision: t.fecha_hora_admision,
    mat_admision: t.personal_admision_matricula || t.mat_admision || '',
    paciente_id: t.paciente,
    paciente_dni: paciente.dni ? String(paciente.dni) : (t.paciente_dni || ''),
    paciente_nombre: paciente.nombre || t.paciente_nombre || '',
    paciente_apellido: paciente.apellidos || t.paciente_apellido || '',
    paciente_obra_social: paciente.obra_social || t.paciente_obra_social || 'Particular',
    paciente_numero_afiliado: paciente.num_obra_social || t.paciente_numero_afiliado || '',
    clasificacion_triage: getTriageInfo(t.clasificacion_triage).key,
    justificacion_otro: t.justificacion_otro || '',
    box_asignado: t.box_numero ? `Box ${t.box_numero}` : (t.box_asignado || null),
    estado: estadoNormalizado,
    estado_backend: t.estado,
    estudios: estudiosList,
    estudios_raw: t.estudios || []
  }
}

/**
 * Obtiene todos los tickets registrados en el sistema.
 */
export async function fetchTicketsApi() {
  const allTickets = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const response = await apiClient.get(page === 1 ? '/tickets/' : `/tickets/?page=${page}`)
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
  const response = await apiClient.get('/tickets/cola-espera/')
  const list = Array.isArray(response) ? response : response.results || []
  return list.map(normalizeTicket)
}

/**
 * Obtiene un ticket específico por su ID / UUID.
 */
export async function fetchTicketByIdApi(idTicket) {
  const response = await apiClient.get(`/tickets/${idTicket}/`)
  return normalizeTicket(response)
}

/**
 * Emite un nuevo ticket en Admisión.
 * Soporta paciente_datos (alta automática) y estudios_ids.
 */
export async function createTicketApi(ticketData) {
  const payload = {
    num_totem: ticketData.num_totem || (ticketData.num_llamado ? `T-${ticketData.num_llamado}` : ''),
    clasificacion_triage: getTriageApiValue(
      ticketData.clasificacion_triage || 'Extraccion sin turno'
    ),
    justificacion_otro: ticketData.justificacion_otro || '',
    estudios_ids: ticketData.estudios_ids || []
  }

  if (ticketData.paciente_id) {
    payload.paciente = ticketData.paciente_id
  } else {
    payload.paciente_datos = {
      dni: Number(String(ticketData.paciente_dni || ticketData.dni).replace(/\D/g, '')),
      nombre: ticketData.paciente_nombre || ticketData.nombre || 'Sin Nombre',
      apellidos: ticketData.paciente_apellido || ticketData.apellido || 'Sin Apellido',
      obra_social: ticketData.paciente_obra_social || 'No especificada',
      num_obra_social: String(
        ticketData.paciente_numero_afiliado || ticketData.numeroAfiliado || ''
      ).replace(/\D/g, '')
    }
  }

  const response = await apiClient.post('/tickets/', payload)
  return {
    ...normalizeTicket(response),
    mat_admision: response.personal_admision_matricula || ticketData.mat_admision || ''
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
 * Búsqueda asistencial de antecedentes de pacientes.
 */
export async function searchPatientsApi(query) {
  if (!query || !query.trim()) return []
  const cleanDni = query.replace(/\D/g, '')

  if (cleanDni.length >= 4) {
    try {
      const found = await apiClient.post('/patients/buscar-por-dni/', { dni: Number(cleanDni) })
      if (found) {
        return [
          {
            dni: String(found.dni),
            nombre: found.nombre,
            apellido: found.apellidos,
            num_obra_social: found.num_obra_social || '',
            numeroAfiliado: found.num_obra_social || '',
            id_paciente: found.id_paciente
          }
        ]
      }
    } catch {
      // Si no coincide por DNI exacto, buscar en lista general
    }
  }

  try {
    const allPatients = await apiClient.get('/patients/')
    const list = Array.isArray(allPatients) ? allPatients : allPatients.results || []
    const q = query.toLowerCase().trim()
    return list
      .filter((p) =>
        String(p.dni).includes(q) ||
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.apellidos && p.apellidos.toLowerCase().includes(q)) ||
        (p.obra_social && p.obra_social.toLowerCase().includes(q)) ||
        (p.num_obra_social && p.num_obra_social.toLowerCase().includes(q))
      )
      .map((p) => ({
        dni: String(p.dni),
        nombre: p.nombre,
        apellido: p.apellidos,
        num_obra_social: p.num_obra_social || '',
        numeroAfiliado: p.num_obra_social || '',
        id_paciente: p.id_paciente
      }))
  } catch (err) {
    console.error('Error al buscar pacientes:', err)
    return []
  }
}

/**
 * Consulta el rendimiento y carga del personal (tickets emitidos / pacientes atendidos) para una fecha determinada.
 */
export async function fetchRendimientoPersonalApi(fechaStr) {
  const query = fechaStr ? `?fecha=${fechaStr}` : ''
  return await apiClient.get(`/tickets/rendimiento-personal/${query}`)
}

/**
 * Consulta el resumen de estudios de laboratorio realizados en una fecha, con soporte para Top N y búsqueda específica.
 */
export async function fetchResumenEstudiosApi({ fechaStr, search = '', top = null } = {}) {
  const params = new URLSearchParams()
  if (fechaStr) params.append('fecha', fechaStr)
  if (search && search.trim()) params.append('search', search.trim())
  if (top) params.append('top', String(top))

  const queryString = params.toString() ? `?${params.toString()}` : ''
  return await apiClient.get(`/tickets/resumen-estudios/${queryString}`)
}

