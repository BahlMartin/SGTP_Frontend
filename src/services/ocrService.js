import apiClient from './apiClient'
import { recognizeRecipeClient } from './clientOcrService'

/**
 * Servicio de Reconocimiento y Mapeo de Recetas Médicas con Memoria Adaptativa.
 * Orquesta la captura local (Tesseract.js + Canvas en WebAssembly)
 * y el cruce semántico con el catálogo de estudios, combos de rutina y coocurrencias.
 */

/**
 * Envía un array de textos extraídos al backend para realizar el pipeline de mapeo:
 * 1. Baterías de rutina (combos por IDs).
 * 2. Memoria de alias aprendidos.
 * 3. Fuzzy matching y abreviaturas nucleares.
 * 4. Desambiguación contextual (boosting).
 * 5. Sugerencias complementarias de estudios asociados.
 *
 * @param {string[]} textos Líneas de texto detectadas en la receta
 * @returns {Promise<{ mensaje: string, totalSugerencias: number, comboDetectado: string|null, sugerencias: Array, suggestedStudies: Array, sugerenciasContextuales: Array }>}
 */
export async function mapStudiesFromTextApi(textos = []) {
  if (!Array.isArray(textos) || textos.length === 0) {
    return {
      mensaje: 'No se detectaron textos legibles.',
      totalSugerencias: 0,
      comboDetectado: null,
      sugerencias: [],
      suggestedStudies: [],
      sugerenciasContextuales: []
    }
  }

  const response = await apiClient.post('/ocr/escanear-receta/', { textos })

  const sugerencias = response.sugerencias || []
  return {
    success: true,
    mensaje: response.mensaje || `Se detectaron ${sugerencias.length} estudios coincidentes.`,
    totalSugerencias: response.total_sugerencias ?? sugerencias.length,
    comboDetectado: response.combo_detectado || null,
    sugerencias,
    sugerenciasContextuales: response.sugerencias_contextuales || [],
    suggestedStudies: sugerencias.map((s) => ({
      id: s.id_estudio,
      nombre: s.nombre,
      categoria: s.tipo_muestra || 'Otro',
      codigoPractica: s.codigo_practica,
      score: s.similitud_score,
      textoOrigen: s.texto_detectado_origen,
      origenDeteccion: s.origen_deteccion || 'OCR_DIRECTO'
    }))
  }
}

/**
 * Flujo Completo Asistido por Cliente:
 * 1. Filtro óptico Canvas (escala de grises adaptativa y contraste).
 * 2. Reconocimiento OCR con Tesseract.js en el navegador (DPI 300 + PSM adaptativo).
 * 3. Cruce léxico, combos de rutina y memoria adaptativa en el Backend Django.
 *
 * @param {File|Blob|string|HTMLVideoElement} imageSource
 * @param {Function} [onProgress] Callback para reportar estados del proceso
 * @param {Object} [options] Opciones opcionales de preprocesamiento
 */
export async function processRecipeFullFlow(imageSource, onProgress, options = {}) {
  if (!imageSource) {
    throw new Error('Debe proporcionar una imagen o captura válida de la receta médica.')
  }

  // 1 y 2: Preprocesamiento y OCR local en navegador
  const ocrOutput = await recognizeRecipeClient(imageSource, onProgress, options)

  if (onProgress) {
    onProgress({
      status: 'matching',
      progress: 0.9,
      percent: 90,
      message: 'Mapeando estudios clínicos, combos de rutina y memoria adaptativa...'
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
      comboDetectado: null,
      sugerencias: [],
      suggestedStudies: [],
      sugerenciasContextuales: [],
      rawText: ocrOutput.rawText,
      detectedLines: [],
      preprocessedDataUrl: ocrOutput.preprocessedDataUrl,
      confidence: ocrOutput.confidence
    }
  }

  // 4: Enviar textos filtrados al backend para pipeline de mapeo inteligente
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
 * Ingesta de Aprendizaje Activo en segundo plano (fire-and-forget).
 * Notifica al backend las asociaciones validadas por el personal para:
 * 1. Guardar abreviaturas corregidas en EstudioAliasAprendido.
 * 2. Guardar combos habituales en PerfilEstudioPatron.
 * 3. Actualizar la matriz de CoocurrenciaEstudio.
 *
 * @param {Object} feedbackData
 * @param {string[]} feedbackData.lineasOrigen
 * @param {number[]} feedbackData.estudiosConfirmadosIds
 * @param {Array<{ texto: string, estudioId: number }>} feedbackData.asociacionesDirectas
 */
export async function reportOcrFeedbackApi(feedbackData = {}) {
  try {
    const payload = {
      lineas_origen: feedbackData.lineasOrigen || [],
      estudios_confirmados_ids: feedbackData.estudiosConfirmadosIds || [],
      asociaciones_directas: (feedbackData.asociacionesDirectas || []).map((a) => ({
        texto: a.texto,
        estudio_id: a.estudioId
      }))
    }
    return await apiClient.post('/ocr/retroalimentar/', payload)
  } catch (err) {
    console.warn('No se pudo enviar retroalimentación OCR en segundo plano:', err)
    return null
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
    comboDetectado: null,
    sugerencias: response.sugerencias || [],
    sugerenciasContextuales: [],
    suggestedStudies: (response.sugerencias || []).map((s) => ({
      id: s.id_estudio,
      nombre: s.nombre,
      categoria: s.tipo_muestra || 'Otro',
      codigoPractica: s.codigo_practica,
      score: s.similitud_score,
      textoOrigen: s.texto_detectado_origen,
      origenDeteccion: s.origen_deteccion || 'OCR_DIRECTO'
    }))
  }
}
