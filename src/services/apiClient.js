import ENVIRONMENT from '../config/enviroment.config'

/**
 * Cliente HTTP unificado para SGTP.
 * Maneja peticiones REST, credenciales de sesión (cookies),
 * subida de archivos multipart y extracción de errores de Django REST Framework.
 */

const BASE_URL = ENVIRONMENT.URL_API.replace(/\/$/, '')

async function handleResponse(response, endpoint = '') {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    if (!response.ok) {
      throw new Error(`Error en descarga (${response.status}): ${response.statusText}`)
    }
    return response.blob()
  }

  let data = null
  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    try {
      const text = await response.text()
      data = text ? { detail: text } : {}
    } catch {
      data = {}
    }
  }

  if (!response.ok) {
    let errorMsg = `Error HTTP ${response.status}`
    if (data) {
      if (typeof data.detail === 'string') {
        errorMsg = data.detail
      } else if (typeof data.error === 'string') {
        errorMsg = data.detail ? `${data.error}: ${data.detail}` : data.error
      } else if (typeof data.mensaje === 'string') {
        errorMsg = data.mensaje
      } else if (typeof data === 'object') {
        const fieldErrors = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ')
        if (fieldErrors) errorMsg = fieldErrors
      }
    }

    // Si la sesión expiró o no hay credenciales (401 o 403 de DRF), notificar para limpiar estado local
    const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/emergency-unlock')
    const isUnauthenticated =
      response.status === 401 ||
      (response.status === 403 &&
        typeof data?.detail === 'string' &&
        data.detail.toLowerCase().includes('credenciales'))

    if (isUnauthenticated && !isAuthEndpoint && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { message: errorMsg } }))
    }

    const err = new Error(errorMsg)
    err.status = response.status
    err.data = data
    throw err
  }

  return data
}

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const { headers = {}, body, ...customConfig } = options

  const defaultHeaders = {}
  let processedBody = body

  // Si no es FormData, fijar Content-Type json
  if (!(body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json'
    if (body && typeof body === 'object') {
      processedBody = JSON.stringify(body)
    }
  }

  const config = {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...headers
    },
    body: processedBody,
    ...customConfig
  }

  const response = await fetch(url, config)
  return handleResponse(response, endpoint)
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
  upload: (endpoint, formData, options = {}) =>
    request(endpoint, { ...options, method: 'POST', body: formData }),
  download: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' })
}

export default apiClient
