import apiClient from './apiClient'

/**
 * Servicio para consulta y gestión de la configuración de tiempos de espera (SLA Triage).
 */

export async function fetchSlaConfigsApi() {
  const response = await apiClient.get('/sla/')
  return Array.isArray(response) ? response : response.results || []
}

export async function updateSlaConfigApi(id, data) {
  return await apiClient.patch(`/sla/${id}/`, data)
}

