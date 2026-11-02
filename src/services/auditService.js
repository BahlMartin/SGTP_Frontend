import apiClient from './apiClient'

/**
 * Servicio de conexión con la API de Auditoría Operacional y Actividad del Personal.
 */

function buildQueryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val)
    }
  })
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export async function fetchEventosAuditoriaApi(params = {}) {
  const qs = buildQueryString(params)
  return await apiClient.get(`/auditoria/eventos/${qs}`)
}

export async function fetchEventoAuditoriaDetalleApi(id) {
  return await apiClient.get(`/auditoria/eventos/${id}/`)
}

export async function fetchAuditoriaResumenKpisApi(params = {}) {
  const qs = buildQueryString(params)
  return await apiClient.get(`/auditoria/resumen/${qs}`)
}

export async function fetchAlmacenamientoDbApi() {
  return await apiClient.get('/auditoria/almacenamiento/')
}

export async function reportarUbicacionNavegadorApi({ lat, lon, precision_m, denegada = false }) {
  return await apiClient.post('/auditoria/ubicacion/', {
    lat,
    lon,
    precision_m,
    denegada
  })
}

export async function fetchEmpleadoJornadaApi(empleadoId, fechaStr) {
  const params = {}
  if (fechaStr) params.fecha = fechaStr
  const qs = buildQueryString(params)
  return await apiClient.get(`/auditoria/empleado/${empleadoId}/${qs}`)
}

export async function descargarAuditoriaExcelApi(params = {}) {
  const qs = buildQueryString(params)
  const blob = await apiClient.download(`/auditoria/exportar/${qs}`)
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Auditoria_Actividad_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

