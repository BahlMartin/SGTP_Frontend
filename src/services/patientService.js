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
    obra_social: String(patientData.obra_social || patientData.obraSocial || 'Particular').trim(),
    num_obra_social: String(patientData.num_obra_social || patientData.numObraSocial || '').trim()
  }
  return normalizePersonFields(await apiClient.post('/patients/', normalizePersonFields(payload)))
}

export async function updatePatientApi(idPaciente, partialData) {
  const normalizedData = normalizePersonFields(partialData)
  return normalizePersonFields(await apiClient.patch(`/patients/${idPaciente}/`, normalizedData))
}

export async function deletePatientApi(idPaciente) {
  return await apiClient.delete(`/patients/${idPaciente}/`)
}

export async function searchPatientByDniApi(dni) {
  const cleanDni = Number(String(dni).replace(/\D/g, ''))
  if (!cleanDni) return null

  try {
    const data = await apiClient.post('/patients/buscar-por-dni/', { dni: cleanDni })
    return normalizePersonFields({
      id: data.id_paciente,
      id_paciente: data.id_paciente,
      dni: data.dni,
      nombre: data.nombre,
      apellido: data.apellidos,
      apellidos: data.apellidos,
      obraSocial: data.obra_social,
      obra_social: data.obra_social,
      numObraSocial: data.num_obra_social,
      numeroAfiliado: data.num_obra_social
    })
  } catch (err) {
    if (err.status === 404) {
      return null
    }
    throw err
  }
}
