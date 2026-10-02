import apiClient from './apiClient'

/**
 * Servicio para gestión y búsqueda clínica de Pacientes.
 * Conecta con el ViewSet y endpoint asistencial de búsqueda por DNI con cifrado FLE.
 */

export async function fetchPatientsApi() {
  const response = await apiClient.get('/patients/')
  // DRF puede retornar array directo o paginado { results: [...] }
  return Array.isArray(response) ? response : response.results || []
}

export async function fetchPatientByIdApi(idPaciente) {
  return await apiClient.get(`/patients/${idPaciente}/`)
}

export async function createPatientApi(patientData) {
  const payload = {
    dni: Number(String(patientData.dni).replace(/\D/g, '')),
    nombre: String(patientData.nombre || '').trim(),
    apellidos: String(patientData.apellidos || patientData.apellido || '').trim(),
    obra_social: String(patientData.obra_social || patientData.obraSocial || 'Particular').trim(),
    num_obra_social: String(patientData.num_obra_social || patientData.numObraSocial || '').trim()
  }
  return await apiClient.post('/patients/', payload)
}

export async function updatePatientApi(idPaciente, partialData) {
  return await apiClient.patch(`/patients/${idPaciente}/`, partialData)
}

export async function deletePatientApi(idPaciente) {
  return await apiClient.delete(`/patients/${idPaciente}/`)
}

export async function searchPatientByDniApi(dni) {
  const cleanDni = Number(String(dni).replace(/\D/g, ''))
  if (!cleanDni) return null

  try {
    const data = await apiClient.post('/patients/buscar-por-dni/', { dni: cleanDni })
    return {
      id: data.id_paciente,
      id_paciente: data.id_paciente,
      dni: data.dni,
      nombre: data.nombre,
      apellido: data.apellidos,
      apellidos: data.apellidos,
      obraSocial: data.obra_social,
      obra_social: data.obra_social,
      numObraSocial: data.num_obra_social
    }
  } catch (err) {
    if (err.status === 404) {
      return null
    }
    throw err
  }
}
