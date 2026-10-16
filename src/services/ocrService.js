import apiClient from './apiClient'
import { recognizeRecipeClient } from './clientOcrService'

/**
 * Servicio de Reconocimiento y Mapeo de Recetas Médicas.
 * Orquesta la captura local (Tesseract.js + Canvas en WebAssembly)
 * y el cruce semántico con el catálogo de estudios del backend en Render.
 */

/**
 * Envía un array de textos extraídos al backend para realizar Fuzzy Matching
 * con el catálogo activo de Estudios Bioquímicos.
 * @param {string[]} textos Líneas de texto detectadas en la receta
 * @returns {Promise<{ mensaje: string, totalSugerencias: number, sugerencias: Array, suggestedStudies: Array }>}
 */
export async function mapStudiesFromTextApi(textos = []) {
  if (!Array.isArray(textos) || textos.length === 0) {
    return {
      mensaje: 'No se detectaron textos legibles.',
      totalSugerencias: 0,
      sugerencias: [],
      suggestedStudies: []
    }
  }

  const response = await apiClient.post('/ocr/escanear-receta/', { textos })

  const sugerencias = response.sugerencias || []
  return {
    success: true,
    mensaje: response.mensaje || `Se detectaron ${sugerencias.length} estudios coincidentes.`,
    totalSugerencias: response.total_sugerencias ?? sugerencias.length,
    sugerencias,
    suggestedStudies: sugerencias.map((s) => ({
      id: s.id_estudio,
      nombre: s.nombre,
      categoria: s.tipo_muestra || 'Otro',
      codigoPractica: s.codigo_practica,
      score: s.similitud_score,
      textoOrigen: s.texto_detectado_origen
    }))
  }
}

/**
 * Flujo Completo Asistido por Cliente:
 * 1. Filtro óptico Canvas (escala de grises, contraste y binarización Otsu).
 * 2. Reconocimiento OCR con Tesseract.js en el navegador.
 * 3. Cruce léxico con diccionario de abreviaturas en el Backend Django.
 *
 * @param {File|Blob|string|HTMLVideoElement} imageSource
 * @param {Function} [onProgress] Callback para reportar estados del proceso
 */
export async function processRecipeFullFlow(imageSource, onProgress) {
  if (!imageSource) {
    throw new Error('Debe proporcionar una imagen o captura válida de la receta médica.')
  }

  // 1 y 2: Preprocesamiento y OCR local en navegador
  const ocrOutput = await recognizeRecipeClient(imageSource, onProgress)

  if (onProgress) {
    onProgress({
      status: 'matching',
      progress: 0.9,
      percent: 90,
      message: 'Mapeando estudios clínicos con el catálogo institucional...'
    })
  }

  // 3: Si no se extrajeron líneas legibles
  if (!ocrOutput.lines || ocrOutput.lines.length === 0) {
    if (onProgress) {
      onProgress({
        status: 'done',
        progress: 1,
        percent: 100,
        message: 'Finalizado sin coincidencias'
      })
    }
    return {
      success: true,
      mensaje: 'No se identificaron prácticas clínicas legibles en la imagen.',
      totalSugerencias: 0,
      sugerencias: [],
      suggestedStudies: [],
      rawText: ocrOutput.rawText,
      detectedLines: [],
      preprocessedDataUrl: ocrOutput.preprocessedDataUrl,
      confidence: ocrOutput.confidence
    }
  }

  // 4: Enviar textos filtrados al backend para Fuzzy Matching con abreviaturas
  const mappingResult = await mapStudiesFromTextApi(ocrOutput.lines)

  if (onProgress) {
    onProgress({
      status: 'done',
      progress: 1,
      percent: 100,
      message: 'Completado'
    })
  }

  return {
    ...mappingResult,
    rawText: ocrOutput.rawText,
    detectedLines: ocrOutput.lines,
    preprocessedDataUrl: ocrOutput.preprocessedDataUrl,
    confidence: ocrOutput.confidence
  }
}

/**
 * Método legacy para compatibilidad hacia atrás: sube archivo binario al backend.
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
      score: s.similitud_score,
      textoOrigen: s.texto_detectado_origen
    }))
  }
}
