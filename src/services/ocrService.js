import apiClient from './apiClient'

/**
 * Escanea y procesa una orden médica mediante el microservicio OCR del backend.
 * Envía la imagen mediante multipart/form-data en memoria volátil (cumplimiento PHI).
 */
export async function scanRecipeOcrApi(fileOrBlob) {
  if (!fileOrBlob) {
    throw new Error('Debe proporcionar un archivo de imagen válido.')
  }

  const formData = new FormData()
  formData.append('file', fileOrBlob)

  const response = await apiClient.upload('/ocr/escanear-receta/', formData)

  return {
    success: true,
    mensaje: response.mensaje,
    totalSugerencias: response.total_sugerencias || 0,
    sugerencias: response.sugerencias || [],
    suggestedStudies: (response.sugerencias || []).map((s) => ({
      id: s.id_estudio,
      nombre: s.nombre,
      categoria: s.tipo_muestra || 'Otro',
      codigoPractica: s.codigo_practica,
      score: s.similitud_score
    }))
  }
}
