import apiClient from './apiClient'
import { normalizeTicket } from './ticketService'

let cachedBoxes = []

function normalizeBox(rawBox) {
  if (!rawBox) return null
  return {
    ...rawBox,
    id: rawBox.id,
    numero: rawBox.numero,
    nombre: `Box ${rawBox.numero}`,
    estado: rawBox.estado || 'Disponible',
    activo: rawBox.activo !== false,
    discapacidad: Boolean(rawBox.discapacidad)
  }
}

/**
 * Obtiene la lista de todos los boxes de atención asistencial.
 */
export async function fetchBoxesApi() {
  const response = await apiClient.get('/boxes/')
  const listadoBoxes = Array.isArray(response) ? response : response.results || []
  cachedBoxes = listadoBoxes.map(normalizeBox)
  return cachedBoxes
}

/**
 * Monitoreo en tiempo real de boxes para pantallas de sala y supervisión.
 */
export async function fetchBoxesEstadoGeneralApi() {
  const response = await apiClient.get('/boxes/estado-general/')
  const listadoBoxes = Array.isArray(response) ? response : response.results || []
  return listadoBoxes.map(normalizeBox)
}

/**
 * Obtiene un box específico por ID o número.
 */
export async function resolveBoxId(boxIdentifier) {
  if (!cachedBoxes.length) {
    await fetchBoxesApi()
  }
  const boxEncontrado = cachedBoxes.find(
    (currentBox) => currentBox.id === boxIdentifier || currentBox.numero === Number(boxIdentifier)
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
  const payload = typeof nuevoEstado === 'object' ? nuevoEstado : { estado: nuevoEstado }
  const response = await apiClient.patch(`/boxes/${boxId}/`, payload)
  return normalizeBox(response)
}

export async function deleteBoxApi(boxId) {
  return await apiClient.delete(`/boxes/${boxId}/`)
}

/**
 * Llama al siguiente paciente disponible según el algoritmo atómico multibox del backend.
 */
export async function llamarSiguientePacienteApi(boxIdentifier) {
  const boxId = await resolveBoxId(boxIdentifier)
  const response = await apiClient.post(`/boxes/${boxId}/llamar-siguiente/`)
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
