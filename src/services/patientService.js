import apiClient from './apiClient'
import { normalizePersonFields } from '../utils/personName.utils'

/**
 * Servicio para gestión y búsqueda clínica de Pacientes.
 * Conecta con el ViewSet y endpoint asistencial de búsqueda por DNI con cifrado FLE.
 */

export async function fetchPatientsApi() {
  const response = await apiClient.get('/patients/')
  // DRF puede retornar array directo o paginado { results: [...] }
  const patients = Array.isArray(response) ? response : response.results || []
  return patients.map(normalizePersonFields)
}

export async function fetchPatientByIdApi(idPaciente) {
  return normalizePersonFields(await apiClient.get(`/patients/${idPaciente}/`))
}

export async function fetchPatientHistoryApi(idPaciente) {
  try {
    const response = await apiClient.get(`/patients/${idPaciente}/historial/`)
    if (Array.isArray(response)) return response.map(normalizePersonFields)

    return {
      ...response,
      paciente: normalizePersonFields(response?.paciente),
      atenciones: Array.isArray(response?.atenciones)
        ? response.atenciones.map((visit) => ({
            ...normalizePersonFields(visit),
            paciente: normalizePersonFields(visit?.paciente),
            paciente_detalle: normalizePersonFields(visit?.paciente_detalle)
          }))
        : response?.atenciones
    }
  } catch (error) {
    if (error.status === 404) {
      throw new Error(
        'El historial de estudios todavía no está disponible en el servidor. Debe desplegarse el endpoint de historial del backend.'
      )
    }
    throw error
  }
}

export async function createPatientApi(patientData) {
  const payload = {
    dni: Number(String(patientData.dni).replace(/\D/g, '')),
    nombre: String(patientData.nombre || '').trim(),
    apellidos: String(patientData.apellidos || patientData.apellido || '').trim(),
    obra_social: String(patientData.obra_social || patientData.obraSocial || 'IOMA').trim(),
    num_obra_social: String(
      patientData.num_obra_social || patientData.numObraSocial || patientData.numeroAfiliado || ''
    ).trim()
  }
  return normalizePersonFields(await apiClient.post('/patients/', normalizePersonFields(payload)))
}

export async function updatePatientApi(idPaciente, partialData) {
  const sanitized = { ...partialData }
  if (typeof sanitized.obra_social === 'string') {
    sanitized.obra_social = sanitized.obra_social.trim()
  }
  if (typeof sanitized.num_obra_social === 'string') {
    sanitized.num_obra_social = sanitized.num_obra_social.trim()
  }
  const normalizedData = normalizePersonFields(sanitized)
  return normalizePersonFields(await apiClient.patch(`/patients/${idPaciente}/`, normalizedData))
}

export async function deletePatientApi(idPaciente) {
  return await apiClient.delete(`/patients/${idPaciente}/`)
}

export async function searchPatientByDniApi(dni, { signal } = {}) {
  const cleanDni = String(dni ?? '').replace(/\D/g, '')
  if (!cleanDni) return null

  const params = new URLSearchParams({
    q: cleanDni,
    scope: 'dni',
    exact: 'true'
  })

  const response = await apiClient.get(
    `/patients/buscar/?${params.toString()}`,
    signal ? { signal } : {}
  )
  const results = Array.isArray(response) ? response : response?.results || []
  const data = results[0]
  if (!data) return null

  return normalizePersonFields({
    id: data.id_paciente ?? data.id,
    id_paciente: data.id_paciente ?? data.id,
    dni: data.dni,
    nombre: data.nombre,
    apellido: data.apellidos || data.apellido || '',
    apellidos: data.apellidos || data.apellido || '',
    obraSocial: data.obra_social || data.obraSocial || '',
    obra_social: data.obra_social || data.obraSocial || '',
    numObraSocial: data.num_obra_social || data.numeroAfiliado || '',
    num_obra_social: data.num_obra_social || data.numeroAfiliado || '',
    numeroAfiliado: data.num_obra_social || data.numeroAfiliado || ''
  })
}
