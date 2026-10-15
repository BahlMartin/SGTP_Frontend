import apiClient from './apiClient'
import { getTodayLocalDateString } from '../utils/formatters'

function normalizeStaffUser(rawStaffMember) {
  if (!rawStaffMember) return null
  const idPersonal = rawStaffMember.id_personal || rawStaffMember.id
  const nombreCompleto = `${rawStaffMember.nombre || ''} ${rawStaffMember.apellidos || ''}`.trim() || rawStaffMember.email
  const turnoDesc = rawStaffMember.inicio_turno && rawStaffMember.fin_turno
    ? `${String(rawStaffMember.inicio_turno).slice(0, 5)} - ${String(rawStaffMember.fin_turno).slice(0, 5)}`
    : (rawStaffMember.turno || 'Sin franja')

  return {
    ...rawStaffMember,
    id: idPersonal,
    id_personal: idPersonal,
    nombre: nombreCompleto,
    primerNombre: rawStaffMember.nombre || nombreCompleto,
    apellidos: rawStaffMember.apellidos || '',
    email: rawStaffMember.email,
    matricula: rawStaffMember.matricula || '',
    rol: rawStaffMember.rol,
    turno: turnoDesc,
    inicio_turno: rawStaffMember.inicio_turno,
    fin_turno: rawStaffMember.fin_turno,
    dias_laborales_detalle: Array.isArray(rawStaffMember.dias_laborales_detalle)
      ? rawStaffMember.dias_laborales_detalle
      : [0, 1, 2, 3, 4],
    habilitaciones_activas_hoy: Array.isArray(rawStaffMember.habilitaciones_activas_hoy)
      ? rawStaffMember.habilitaciones_activas_hoy
      : [],
    activo: rawStaffMember.activo !== false,
    cant_intentos: rawStaffMember.cant_intentos || 0,
    area: rawStaffMember.rol === 'Box' ? 'Área Asistencial' : 'Administración / Triage'
  }
}

/**
 * Obtiene el listado completo de personal hospitalario.
 */
export async function fetchAllStaffApi(incluirInactivos = true) {
  const queryParam = incluirInactivos ? '?incluir_inactivos=true' : ''
  const response = await apiClient.get(`/users/${queryParam}`)
  const listadoPersonal = Array.isArray(response) ? response : response.results || []
  return listadoPersonal.map(normalizeStaffUser)
}

export async function fetchStaffUserByIdApi(userId) {
  const response = await apiClient.get(`/users/${userId}/`)
  return normalizeStaffUser(response)
}

/**
 * Da de alta a un nuevo miembro del personal asistencial con rol y horario asignado.
 */
export async function createStaffUserApi(currentUserRole, newUserPayload) {
  // Validación de jerarquía RBAC
  if (currentUserRole === 'Jefa') {
    if (newUserPayload.rol === 'Admin' || newUserPayload.rol === 'Jefa') {
      throw new Error('Restricción de jerarquía: El rol de Jefa no puede crear usuarios de nivel Admin o Jefa.')
    }
  }

  const payload = {
    email: newUserPayload.email.trim().toLowerCase(),
    password: newUserPayload.password || 'SeguridadHospital2026!',
    dni: Number(String(newUserPayload.dni).replace(/\D/g, '')),
    nombre: newUserPayload.nombre.trim(),
    apellidos: (newUserPayload.apellidos || newUserPayload.apellido || '').trim(),
    matricula: newUserPayload.matricula.trim(),
    rol: newUserPayload.rol || 'Box',
    inicio_turno: `${newUserPayload.inicio_turno || '07:00'}:00`,
    fin_turno: `${newUserPayload.fin_turno || '15:00'}:00`,
    dias_laborales: Array.isArray(newUserPayload.dias_laborales)
      ? newUserPayload.dias_laborales
      : [0, 1, 2, 3, 4]
  }

  const response = await apiClient.post('/users/', payload)
  return normalizeStaffUser(response)
}

export async function updateStaffUserApi(userId, patchData) {
  const response = await apiClient.patch(`/users/${userId}/`, patchData)
  return normalizeStaffUser(response)
}

/**
 * Borrado lógico (desactivación asistencial) de la cuenta del personal.
 */
export async function deleteStaffUserApi(currentUserRole, userId) {
  return await apiClient.delete(`/users/${userId}/`)
}

/**
 * Reactiva una cuenta de personal previamente dada de baja.
 */
export async function reactivateStaffUserApi(userId) {
  const response = await apiClient.patch(`/users/${userId}/reactivar/`)
  return normalizeStaffUser(response.personal || response)
}

// ==============================================================================
// GESTIÓN DE HABILITACIONES HORARIAS (HORAS EXTRAS Y EXCEPCIONES)
// ==============================================================================

export async function fetchHabilitacionesHorariasApi(
  incluirInactivas = true,
  personalId = null,
  fecha = null,
  anio = null,
  mes = null
) {
  const params = new URLSearchParams()
  if (incluirInactivas) params.append('incluir_inactivas', 'true')
  if (personalId) params.append('personal', personalId)
  if (fecha) params.append('fecha', fecha)
  if (anio) params.append('anio', anio)
  if (mes) params.append('mes', mes)
  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await apiClient.get(`/users/habilitaciones-horarias/${queryString}`)
  return Array.isArray(response) ? response : response.results || []
}

export async function fetchHabilitacionHorariaByIdApi(habilitacionId) {
  return await apiClient.get(`/users/habilitaciones-horarias/${habilitacionId}/`)
}

export async function createHabilitacionHorariaApi(dataHabilitacion) {
  return await apiClient.post('/users/habilitaciones-horarias/', dataHabilitacion)
}

export async function updateHabilitacionHorariaApi(habilitacionId, dataHabilitacion) {
  return await apiClient.patch(`/users/habilitaciones-horarias/${habilitacionId}/`, dataHabilitacion)
}

export async function revokeHabilitacionHorariaApi(habilitacionId) {
  return await apiClient.delete(`/users/habilitaciones-horarias/${habilitacionId}/`)
}

export async function bulkRevokeHabilitacionesApi(payload) {
  return await apiClient.post('/users/habilitaciones-horarias/revocar-lote/', payload)
}

export async function reactivateHabilitacionHorariaApi(habilitacionId) {
  return await apiClient.patch(`/users/habilitaciones-horarias/${habilitacionId}/reactivar/`)
}

/**
 * Conmuta o habilita una excepción horaria para el personal.
 */
export async function toggleShiftExceptionApi(userId, habilitado) {
  if (habilitado) {
    const todayStr = getTodayLocalDateString()
    return await createHabilitacionHorariaApi({
      personal: userId,
      fecha: todayStr,
      hora_inicio: '00:00:00',
      hora_fin: '23:59:59',
      motivo: 'Extensión horaria autorizada desde consola'
    })
  } else {
    return await updateStaffUserApi(userId, { activo: false })
  }
}

// ==============================================================================
// GESTIÓN DE PLANIFICACIONES MENSUALES DE HORAS EXTRAS
// ==============================================================================

export async function fetchPlanificacionesHorasExtrasApi(personalId = null, anio = null, mes = null) {
  const params = new URLSearchParams()
  if (personalId) params.append('personal', personalId)
  if (anio) params.append('anio', anio)
  if (mes) params.append('mes', mes)
  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await apiClient.get(`/users/planificaciones-horas-extras/${queryString}`)
  return Array.isArray(response) ? response : response.results || []
}

export async function createPlanificacionHorasExtrasApi(dataPlanificacion) {
  return await apiClient.post('/users/planificaciones-horas-extras/', dataPlanificacion)
}

export async function deletePlanificacionHorasExtrasApi(planificacionId) {
  return await apiClient.delete(`/users/planificaciones-horas-extras/${planificacionId}/`)
}


