import apiClient from './apiClient'
import { recognizeRecipePaddle } from './paddleOcrService'

export { recognizeRecipePaddle }

/**
 * Servicio de Reconocimiento y Mapeo de Recetas Médicas con Memoria Adaptativa.
 * Ejecuta PaddleOCR (PP-OCRv5 en WebAssembly) en el cliente y cruza las líneas
 * extraídas con el catálogo de estudios, combos de rutina y coocurrencias en Django.
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
 * Procesa integralmente una orden médica utilizando exclusivamente PaddleOCR (PP-OCRv5):
 * 1. Preprocesamiento óptico adaptativo.
 * 2. Detección basada en polígonos libres (DBNet).
 * 3. Reconocimiento de secuencias de texto (SVTR).
 * 4. Cruce semántico con backend Django (Fuzzy matching, Combos de rutina, Alias, Coocurrencias).
 *
 * @param {File|Blob|string|HTMLVideoElement} imageSource
 * @param {Function} [onProgress] Callback para reportar estados del proceso
 */
export async function processRecipeFullFlow(imageSource, onProgress) {
  if (!imageSource) {
    throw new Error('Debe proporcionar una imagen o captura válida de la receta médica.')
  }

  if (onProgress) {
    onProgress({
      status: 'paddle_pass',
      progress: 0.15,
      percent: 15,
      message: 'Escaneando con PaddleOCR (PP-OCRv5)...'
    })
  }

  const t0 = performance.now()
  const paddleOutput = await recognizeRecipePaddle(imageSource, onProgress)
  const durationMs = Math.round(performance.now() - t0)

  let mapping = {
    suggestedStudies: [],
    sugerenciasContextuales: [],
    comboDetectado: null,
    totalSugerencias: 0
  }

  if (paddleOutput?.lines?.length > 0) {
    if (onProgress) {
      onProgress({
        status: 'mapping_backend',
        progress: 0.85,
        percent: 85,
        message: 'Mapeando prácticas con el nomenclador clínico...'
      })
    }
    mapping = await mapStudiesFromTextApi(paddleOutput.lines)
  }

  const suggestedStudies = (mapping.suggestedStudies || []).map((s) => ({
    ...s,
    motorOcr: 'PaddleOCR'
  }))

  if (onProgress) {
    onProgress({
      status: 'done',
      progress: 1,
      percent: 100,
      message: `Análisis finalizado: ${suggestedStudies.length} prácticas identificadas con PaddleOCR`
    })
  }

  return {
    success: true,
    totalSugerencias: suggestedStudies.length,
    comboDetectado: mapping.comboDetectado || null,
    sugerencias: suggestedStudies,
    suggestedStudies,
    sugerenciasContextuales: mapping.sugerenciasContextuales || [],
    rawText: paddleOutput?.rawText || '',
    detectedLines: paddleOutput?.lines || [],
    preprocessedDataUrl: paddleOutput?.preprocessedDataUrl,
    confidence: paddleOutput?.confidence || 0,
    durationMs,
    wordsCount: paddleOutput?.metrics?.wordsCount || paddleOutput?.lines?.length || 0,
    engineUsed: 'PaddleOCR (PP-OCRv5)'
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
      lineas_origen: feedbackData.lineasOrigen || feedbackData.lineas_origen || [],
      estudios_confirmados_ids: feedbackData.estudiosConfirmadosIds || feedbackData.estudios_confirmados_ids || [],
      asociaciones_directas: (feedbackData.asociacionesDirectas || feedbackData.asociaciones_directas || []).map((a) => ({
        texto: a.texto,
        estudio_id: a.estudioId ?? a.estudio_id
      }))
    }
    const response = await apiClient.post('/ocr/retroalimentar/', payload)
    return response
  } catch (err) {
    console.warn('No se pudo registrar feedback de aprendizaje OCR:', err)
    return null
  }
}

/**
 * @deprecated Función heredada de compatibilidad. Utilice processRecipeFullFlow.
 */
export async function parseRecipeImageApi(imageSource, onProgress) {
  const result = await processRecipeFullFlow(imageSource, onProgress)
  return {
    success: true,
    mensaje: `Se reconocieron ${result.suggestedStudies.length} prácticas.`,
    totalSugerencias: result.totalSugerencias,
    comboDetectado: null,
    sugerencias: result.sugerencias || [],
    sugerenciasContextuales: [],
    suggestedStudies: (result.sugerencias || []).map((s) => ({
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
