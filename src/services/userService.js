import apiClient from './apiClient'

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
    matricula: rawStaffMember.matricula || `MAT-${idPersonal}`,
    rol: rawStaffMember.rol,
    turno: turnoDesc,
    inicio_turno: rawStaffMember.inicio_turno,
    fin_turno: rawStaffMember.fin_turno,
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
    fin_turno: `${newUserPayload.fin_turno || '15:00'}:00`
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

export async function fetchHabilitacionesHorariasApi(incluirInactivas = true) {
  const queryParam = incluirInactivas ? '?incluir_inactivas=true' : ''
  const response = await apiClient.get(`/users/habilitaciones-horarias/${queryParam}`)
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

export async function reactivateHabilitacionHorariaApi(habilitacionId) {
  return await apiClient.patch(`/users/habilitaciones-horarias/${habilitacionId}/reactivar/`)
}

/**
 * Conmuta o habilita una excepción horaria para el personal.
 */
export async function toggleShiftExceptionApi(userId, habilitado) {
  if (habilitado) {
    const todayStr = new Date().toISOString().split('T')[0]
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
