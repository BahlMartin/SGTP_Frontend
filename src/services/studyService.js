import apiClient from './apiClient'

/**
 * Servicio para consulta y gestión del catálogo maestro de Estudios Bioquímicos.
 */

export async function fetchStudiesApi(searchQuery = '') {
  const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''
  const response = await apiClient.get(`/studies/${queryParam}`)
  return Array.isArray(response) ? response : response.results || []
}

export async function fetchStudyByIdApi(idEstudio) {
  return await apiClient.get(`/studies/${idEstudio}/`)
}

export async function createStudyApi(studyData) {
  return await apiClient.post('/studies/', studyData)
}

export async function updateStudyApi(idEstudio, studyData) {
  return await apiClient.patch(`/studies/${idEstudio}/`, studyData)
}

export async function deleteStudyApi(idEstudio) {
  return await apiClient.delete(`/studies/${idEstudio}/`)
}
