import apiClient from './apiClient'
import { normalizeTicket } from './ticketService'

let cachedBoxes = []

function normalizeBoxStatus(rawStatus, isActive) {
  const normalizedStatus = String(rawStatus || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')

  if (normalizedStatus === 'disponible') return 'Disponible'
  if (normalizedStatus === 'en atencion') return 'En atencion'
  if (normalizedStatus === 'fuera de servicio') return 'Fuera de servicio'
  if (isActive === false) return 'Fuera de servicio'
  return rawStatus || 'Disponible'
}

function serializeBoxStatus(rawStatus) {
  const normalizedStatus = String(rawStatus || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')

  if (normalizedStatus === 'disponible') return 'Disponible'
  if (normalizedStatus === 'en atencion') return 'En atencion'
  if (normalizedStatus === 'fuera de servicio') return 'Fuera de servicio'

  throw new Error(`El estado de box "${rawStatus}" no es válido.`)
}

function normalizeBox(rawBox) {
  if (!rawBox) return null
  const isActive = rawBox.activo !== false
  const boxNumber = Number(rawBox.numero)

  return {
    ...rawBox,
    id: rawBox.id,
    numero: Number.isFinite(boxNumber) ? boxNumber : rawBox.numero,
    nombre: `Box ${rawBox.numero}`,
    estado: normalizeBoxStatus(rawBox.estado, isActive),
    activo: isActive,
    discapacidad: Boolean(rawBox.discapacidad),
    personal_actual: rawBox.personal_actual_detalle || rawBox.personal_actual || null,
    paciente_actual: rawBox.paciente_actual_detalle || rawBox.paciente_actual || null
  }
}

function extractBoxList(response) {
  if (Array.isArray(response)) return response

  const list = response?.results || response?.data || response?.boxes
  if (Array.isArray(list)) return list

  throw new Error('La respuesta del servidor no contiene una lista válida de boxes.')
}

/**
 * Obtiene la lista de todos los boxes de atención asistencial.
 */
export async function fetchBoxesApi() {
  const response = await apiClient.get(`/boxes/?_t=${Date.now()}`)
  cachedBoxes = extractBoxList(response).map(normalizeBox).filter(Boolean)
  return cachedBoxes
}

/**
 * Monitoreo en tiempo real de boxes para pantallas de sala y supervisión.
 */
export async function fetchBoxesEstadoGeneralApi() {
  const response = await apiClient.get(`/boxes/estado-general/?_t=${Date.now()}`)
  return extractBoxList(response).map(normalizeBox).filter(Boolean)
}

/**
 * Obtiene un box específico por ID o número.
 */
export async function resolveBoxId(boxIdentifier) {
  if (!cachedBoxes.length) {
    await fetchBoxesApi()
  }
  const boxEncontrado = cachedBoxes.find(
    (currentBox) =>
      currentBox.id === boxIdentifier || Number(currentBox.numero) === Number(boxIdentifier)
  )
  return boxEncontrado ? boxEncontrado.id : boxIdentifier
}

export async function fetchBoxByIdApi(boxId) {
  const response = await apiClient.get(`/boxes/${boxId}/`)
  return normalizeBox(response)
}

export async function createBoxApi(boxData) {
  const response = await apiClient.post('/boxes/', boxData)
  return normalizeBox(response)
}

export async function updateBoxStateApi(boxIdentifier, nuevoEstado) {
  const boxId = await resolveBoxId(boxIdentifier)
  const payload = typeof nuevoEstado === 'object'
    ? { ...nuevoEstado, ...(nuevoEstado.estado ? { estado: serializeBoxStatus(nuevoEstado.estado) } : {}) }
    : { estado: serializeBoxStatus(nuevoEstado) }
  const response = await apiClient.patch(`/boxes/${boxId}/`, payload)
  const normalizedResponse = normalizeBox(response)
  const boxNumber = Number(boxIdentifier)
  const cachedBoxIndex = cachedBoxes.findIndex(
    (currentBox) => Number(currentBox.numero) === boxNumber
  )
  const existingBox = cachedBoxIndex >= 0 ? cachedBoxes[cachedBoxIndex] : {}
  const hasServerStatus = response && response.estado
  const updatedBox = {
    ...existingBox,
    ...(normalizedResponse || {}),
    id: normalizedResponse?.id ?? existingBox.id ?? boxId,
    numero: Number.isFinite(Number(normalizedResponse?.numero))
      ? Number(normalizedResponse.numero)
      : boxNumber,
    nombre: normalizedResponse?.nombre || existingBox.nombre || `Box ${boxNumber}`,
    estado: hasServerStatus && normalizedResponse
      ? normalizedResponse.estado
      : normalizeBoxStatus(payload.estado, undefined),
    activo: normalizedResponse?.activo ?? existingBox.activo ?? true
  }

  if (cachedBoxIndex >= 0) {
    cachedBoxes[cachedBoxIndex] = { ...cachedBoxes[cachedBoxIndex], ...updatedBox }
  } else {
    cachedBoxes.push(updatedBox)
  }

  return updatedBox
}

export async function deleteBoxApi(boxId) {
  return await apiClient.delete(`/boxes/${boxId}/`)
}

/**
 * Asocia al técnico actual al box físico seleccionado en tiempo real.
 */
export async function tomarBoxApi(boxIdentifier) {
  const boxId = await resolveBoxId(boxIdentifier)
  const response = await apiClient.post(`/boxes/${boxId}/tomar-box/`)
  return normalizeBox(response)
}

/**
 * Llama al siguiente paciente disponible según el algoritmo atómico multibox del backend,
 * o a un paciente específico si se proporciona ticketId (llamado directo ignorando triage).
 */
export async function llamarSiguientePacienteApi(boxIdentifier, ticketId = null) {
  const boxId = await resolveBoxId(boxIdentifier)
  const payload = ticketId ? { ticket_id: ticketId } : {}
  const response = await apiClient.post(`/boxes/${boxId}/llamar-siguiente/`, payload)
  return {
    mensaje: response.mensaje,
    ticket: response.ticket ? normalizeTicket(response.ticket) : null,
    asignacion_id: response.asignacion_id,
    box: response.box ? normalizeBox(response.box) : null
  }
}

/**
 * Finaliza la atención del box y lo restituye al estado 'Disponible'.
 */
export async function cerrarAtencionBoxApi(boxIdentifier, motivoCierre = 'Finalizado') {
  const boxId = await resolveBoxId(boxIdentifier)
  const response = await apiClient.post(`/boxes/${boxId}/cerrar-atencion/`, {
    motivo_cierre: motivoCierre
  })
  return {
    mensaje: response.mensaje,
    box: response.box ? normalizeBox(response.box) : null,
    asignacion: response.asignacion
  }
}

/**
 * Modifica los estudios de la orden médica durante la atención en Box (cancelar y/o agregar).
 */
export async function modificarEstudiosBoxApi(boxIdentifier, { cancelarEstudios = [], agregarEstudios = [] }) {
  const boxId = await resolveBoxId(boxIdentifier)
  const response = await apiClient.post(`/boxes/${boxId}/modificar-estudios/`, {
    cancelar_estudios: cancelarEstudios,
    agregar_estudios: agregarEstudios
  })
  return {
    mensaje: response.mensaje,
    ticket: response.ticket ? normalizeTicket(response.ticket) : null
  }
}

/**
 * Historial inmutable de asignaciones y atenciones en Box.
 */
export async function fetchAsignacionesBoxApi() {
  const response = await apiClient.get('/boxes/asignaciones/')
  return Array.isArray(response) ? response : response.results || []
}

export async function fetchAsignacionBoxByIdApi(asignacionId) {
  return await apiClient.get(`/boxes/asignaciones/${asignacionId}/`)
}

// Compatibilidad con invocaciones anteriores
export async function assignCallToBoxApi(boxNumero) {
  return await llamarSiguientePacienteApi(boxNumero)
}

export async function finishAttentionInBoxApi(boxNumero, motivoCierre) {
  return await cerrarAtencionBoxApi(boxNumero, motivoCierre)
}
