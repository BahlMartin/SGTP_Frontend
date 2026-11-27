import apiClient from './apiClient'
import { recognizeRecipePaddle, recognizeManualCropFromImage } from './paddleOcrService'

export { recognizeRecipePaddle, recognizeManualCropFromImage }

/**
 * Servicio de Reconocimiento y Mapeo de Recetas Médicas con Memoria Adaptativa.
 * Ejecuta PaddleOCR (PP-OCRv5 en WebAssembly) en el cliente y cruza las líneas
 * extraídas con el catálogo de estudios, combos de rutina y coocurrencias en Django.
 */

function mapRecomendadoToCandidate(r, textoOrigen = '') {
  return {
    id: r.id_estudio,
    nombre: r.nombre,
    categoria: r.tipo_muestra || 'Otro',
    codigoPractica: r.codigo_practica,
    score: r.similitud_score,
    textoOrigen: textoOrigen || r.texto_detectado_origen || '',
    origenDeteccion: r.origen_deteccion || 'OCR_DIRECTO',
    preseleccionado: r.preseleccionado ?? true,
    vecesConfirmado: r.veces_confirmado || 0,
    imagenMuestra: r.imagen_muestra || null
  }
}

/**
 * Envía un array de textos extraídos al backend para realizar el pipeline de mapeo:
 * 1. Baterías de rutina (combos por IDs).
 * 2. Memoria de alias aprendidos.
 * 3. Fuzzy matching y abreviaturas nucleares.
 * 4. Desambiguación contextual (boosting).
 * 5. Sugerencias complementarias de estudios asociados.
 *
 * @param {string[]} textos Líneas de texto detectadas en la receta
 * @param {string[]} [firmasVisuales] Huellas visuales opcionales paralelas a cada renglón
 * @param {string[]} [recortesImagen] Recortes DataURL livianos paralelos a cada renglón
 * @returns {Promise<{ mensaje: string, totalSugerencias: number, comboDetectado: string|null, sugerencias: Array, suggestedStudies: Array, sugerenciasContextuales: Array }>}
 */
export async function mapStudiesFromTextApi(textos = [], firmasVisuales = [], recortesImagen = []) {
  if (!Array.isArray(textos) || textos.length === 0) {
    return {
      mensaje: 'No se detectaron textos legibles.',
      totalSugerencias: 0,
      comboDetectado: null,
      sugerencias: [],
      renglones: [],
      suggestedStudies: [],
      sugerenciasContextuales: []
    }
  }

  const response = await apiClient.post('/ocr/escanear-receta/', {
    textos,
    firmas_visuales: Array.isArray(firmasVisuales) ? firmasVisuales : [],
    recortes_imagen: Array.isArray(recortesImagen) ? recortesImagen : [],
    usar_vision_ia: false,
    deduplicar_imagenes: true
  })

  const sugerencias = response.sugerencias || []
  return {
    success: true,
    mensaje: response.mensaje || `Se detectaron ${sugerencias.length} estudios coincidentes.`,
    totalSugerencias: response.total_sugerencias ?? sugerencias.length,
    comboDetectado: response.combo_detectado || null,
    sugerencias,
    renglones: response.renglones || [],
    imagenesRecortes:
      response.imagenes_recortes && typeof response.imagenes_recortes === 'object'
        ? response.imagenes_recortes
        : {},
    sugerenciasContextuales: response.sugerencias_contextuales || [],
    suggestedStudies: sugerencias.map((s) => mapRecomendadoToCandidate(s))
  }
}

/**
 * Envía una única imagen contextual saneada (zona clínica recortada + rectángulos blancos sobre
 * datos sensibles/firma) al backend para que Gemini IA interprete los estudios en contexto.
 *
 * @param {{ imagenContextual: string, contextoRenglones?: Array<{ indice: number, texto_ocr: string }> }} payload
 */
export async function interpretContextualRecipeWithAiApi({
  imagenContextual,
  contextoRenglones = []
} = {}) {
  if (!imagenContextual) {
    return {
      totalProcesados: 0,
      resultados: [],
      renglonesNuevos: [],
      diagnosticoDetectado: '',
      notasMuestra: '',
      modeloUsado: 'gemini-3.1-flash-lite',
      errorIa: 'No se preparó la imagen contextual para enviar a IA.'
    }
  }

  const response = await apiClient.post('/ocr/interpretar-recortes/', {
    imagen_contextual: imagenContextual,
    contexto_renglones: Array.isArray(contextoRenglones) ? contextoRenglones : []
  })

  const rawResultados = Array.isArray(response?.resultados) ? response.resultados : []
  const rawNuevos = Array.isArray(response?.renglones_nuevos) ? response.renglones_nuevos : []

  const mapIaItem = (item) => ({
    indice: item.indice ?? null,
    textoOcrOriginal: item.texto_ocr_original || '',
    textoTranscritoIa: item.texto_transcrito_ia || '',
    comboDetectado: item.combo_detectado || null,
    recomendados: (item.recomendados || []).map((r) =>
      mapRecomendadoToCandidate(r, item.texto_transcrito_ia || item.texto_ocr_original || '')
    )
  })

  return {
    totalProcesados: response?.total_procesados ?? rawResultados.length + rawNuevos.length,
    resultados: rawResultados.map(mapIaItem),
    renglonesNuevos: rawNuevos.map(mapIaItem),
    diagnosticoDetectado: response?.diagnostico_detectado || '',
    notasMuestra: response?.notas_muestra || '',
    modeloUsado: response?.modelo_usado || 'gemini-3.1-flash-lite',
    errorIa: response?.error_ia || ''
  }
}

/**
 * @deprecated Función heredada; la UI actual utiliza interpretContextualRecipeWithAiApi.
 */
export async function interpretSelectedCropsWithAiApi(recortes = []) {
  if (!Array.isArray(recortes) || recortes.length === 0) {
    return { totalProcesados: 0, resultados: [] }
  }

  const response = await apiClient.post('/ocr/interpretar-recortes/', {
    recortes
  })

  const rawResultados = Array.isArray(response?.resultados) ? response.resultados : []
  return {
    totalProcesados: response?.total_procesados ?? rawResultados.length,
    resultados: rawResultados.map((item) => ({
      indice: item.indice,
      textoOcrOriginal: item.texto_ocr_original || '',
      textoTranscritoIa: item.texto_transcrito_ia || '',
      comboDetectado: item.combo_detectado || null,
      recomendados: (item.recomendados || []).map((r) =>
        mapRecomendadoToCandidate(r, item.texto_ocr_original || '')
      )
    }))
  }
}

function buildDetectedLineDetail(richLine, backendLine, idx, imagenesRecortes = {}) {
  const resolvedTexto =
    richLine.text === '[Manuscrito a revisar]' &&
    backendLine?.texto_renglon &&
    backendLine.texto_renglon !== '[Manuscrito a revisar]'
      ? backendLine.texto_renglon
      : richLine.text

  const rawKnownImages = Array.isArray(backendLine?.imagenes_muestra_conocidas)
    ? backendLine.imagenes_muestra_conocidas.filter(Boolean)
    : []
  const imagenesMuestraConocidas =
    rawKnownImages.length > 0
      ? rawKnownImages
      : backendLine?.imagen_muestra_conocida
        ? [backendLine.imagen_muestra_conocida]
        : []

  const trazosCoincidentes = Array.isArray(backendLine?.trazos_coincidentes)
    ? backendLine.trazos_coincidentes
        .filter((t) => t && t.recorte_id !== undefined && t.recorte_id !== null)
        .map((t) => ({
          recorteId: t.recorte_id,
          imagenMuestra: t.imagen_muestra || imagenesRecortes[String(t.recorte_id)] || '',
          estudiosIds: Array.isArray(t.estudios_ids) ? t.estudios_ids : [],
          estudiosNombres: Array.isArray(t.estudios_nombres) ? t.estudios_nombres : [],
          similitudScore: Number(t.similitud_score) || 0,
          scoreBase: Number(t.score_base) || 0,
          metricas:
            t.metricas && typeof t.metricas === 'object' && !Array.isArray(t.metricas)
              ? t.metricas
              : {}
        }))
    : []

  return {
    id: idx,
    texto: resolvedTexto,
    textoOriginalOcr: richLine.text,
    textoIa: null,
    confidence: richLine.confidence ?? 0,
    bbox: richLine.bbox || null,
    rowIndex: richLine.rowIndex || idx + 1,
    colIndex: richLine.colIndex || 1,
    totalColsInRow: richLine.totalColsInRow || 1,
    visualHash: richLine.visualHash || '',
    cropDataUrl: richLine.cropDataUrl || null,
    cropStorageDataUrl: richLine.cropStorageDataUrl || null,
    comboDetectado: backendLine?.combo_detectado || null,
    esRuidoAprendido: Boolean(backendLine?.es_ruido_aprendido),
    imagenMuestraConocida:
      backendLine?.imagen_muestra_conocida || imagenesMuestraConocidas[0] || null,
    imagenesMuestraConocidas,
    trazosCoincidentes,
    recomendados: (backendLine?.recomendados || []).map((r) =>
      mapRecomendadoToCandidate(r, richLine.text)
    )
  }
}

/**
 * Procesa un recorte dibujado manualmente en "Por Recortes" usando PaddleOCR local
 * sobre ese fragmento y el mapeador / comparador OpenCV en Django (sin enviar PHI externo).
 *
 * @param {{ preprocessedDataUrl?: string, fallbackImageUrl?: string, normalizedRect: { x: number, y: number, w: number, h: number } }} params
 */
export async function processManualRecipeCrop({
  preprocessedDataUrl,
  fallbackImageUrl,
  normalizedRect
} = {}) {
  const imageSource = preprocessedDataUrl || fallbackImageUrl
  const cropInfo = await recognizeManualCropFromImage(imageSource, normalizedRect)

  const mapping = await mapStudiesFromTextApi(
    [cropInfo.text],
    [cropInfo.visualHash || ''],
    [cropInfo.cropStorageDataUrl || '']
  )

  const backendLine = mapping?.renglones?.[0] || null
  const detail = buildDetectedLineDetail(cropInfo, backendLine, 0, mapping?.imagenesRecortes || {})
  return {
    ...detail,
    esRuidoAprendido: false,
    isManualCrop: true
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
    renglones: [],
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
    const firmasVisuales = (paddleOutput.richLines || []).map((l) => l.visualHash || '')
    const recortesImagen = (paddleOutput.richLines || []).map((l) => l.cropStorageDataUrl || '')
    // Los recortes livianos prefiltrados se envían solo al backend propio de Django
    // para comparación visual local (OpenCV + NumPy) con usar_vision_ia: false (sin exposición externa PHI).
    mapping = await mapStudiesFromTextApi(paddleOutput.lines, firmasVisuales, recortesImagen)
  }

  const suggestedStudies = (mapping.suggestedStudies || []).map((s) => ({
    ...s,
    motorOcr: 'PaddleOCR'
  }))

  const richLines = paddleOutput?.richLines || (paddleOutput?.lines || []).map((text, idx) => ({
    text,
    confidence: paddleOutput?.confidence || 0,
    rowIndex: idx + 1,
    colIndex: 1,
    totalColsInRow: 1,
    visualHash: '',
    cropDataUrl: null,
    cropStorageDataUrl: null
  }))

  const backendRenglones = mapping.renglones || []
  const imagenesRecortesMap = mapping.imagenesRecortes || {}
  const detectedLinesDetail = richLines
    .map((richLine, idx) => {
      const backendLine =
        backendRenglones.find((r) => r.indice === idx) ||
        backendRenglones[idx] ||
        null

      return buildDetectedLineDetail(richLine, backendLine, idx, imagenesRecortesMap)
    })
    .filter((line) => !line.esRuidoAprendido)

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
    detectedLinesDetail,
    preprocessedDataUrl: paddleOutput?.preprocessedDataUrl,
    preprocessedWidth: paddleOutput?.preprocessedWidth || 0,
    preprocessedHeight: paddleOutput?.preprocessedHeight || 0,
    confidence: paddleOutput?.confidence || 0,
    durationMs,
    wordsCount: paddleOutput?.metrics?.wordsCount || paddleOutput?.lines?.length || 0,
    engineUsed: 'PaddleOCR (PP-OCRv5)'
  }
}

/**
 * Ingesta de Aprendizaje Activo en segundo plano (fire-and-forget).
 * Notifica al backend las asociaciones validadas por el personal para:
 * 1. Guardar abreviaturas corregidas y recortes en EstudioAliasAprendido.
 * 2. Guardar combos habituales y recortes en PerfilEstudioPatron.
 * 3. Filtrar renglones descartados como ruido en futuros escaneos.
 * 4. Actualizar la matriz de CoocurrenciaEstudio.
 *
 * @param {Object} feedbackData
 * @param {string[]} feedbackData.lineasOrigen
 * @param {number[]} feedbackData.estudiosConfirmadosIds
 * @param {Array<{ texto: string, estudioId: number }>} feedbackData.asociacionesDirectas
 * @param {Array<{ texto: string, estudiosIds: number[], imagenMuestra?: string }>} [feedbackData.renglonesConfirmados]
 * @param {string[]} [feedbackData.lineasDescartadas]
 * @param {Array<{ texto: string, imagenMuestra: string }>} [feedbackData.recortesDescartados]
 * @param {Array<{ recorteId: number, esCorrecto: boolean, textoConsulta?: string, firmaVisualConsulta?: string, imagenConsulta?: string, estudiosConfirmadosIds?: number[], scoreBase?: number|null, metricas?: Object }>} [feedbackData.evaluacionesTrazos]
 */
export async function reportOcrFeedbackApi(feedbackData = {}) {
  try {
    const rawEvaluacionesTrazos =
      feedbackData.evaluacionesTrazos || feedbackData.evaluaciones_trazos || []
    const evaluacionesTrazos = Array.isArray(rawEvaluacionesTrazos)
      ? rawEvaluacionesTrazos
          .map((ev) => {
            const recorteId = Number(ev?.recorteId ?? ev?.recorte_id)
            const estudiosIds = ev?.estudiosConfirmadosIds ?? ev?.estudios_confirmados_ids
            const rawScoreBase = ev?.scoreBase ?? ev?.score_base
            const parsedScoreBase =
              rawScoreBase === undefined || rawScoreBase === null || rawScoreBase === ''
                ? null
                : Number(rawScoreBase)
            const metricas = ev?.metricas
            return {
              recorte_id: recorteId,
              es_correcto: Boolean(ev?.esCorrecto ?? ev?.es_correcto),
              texto_consulta: String(ev?.textoConsulta ?? ev?.texto_consulta ?? ''),
              firma_visual_consulta: String(
                ev?.firmaVisualConsulta ?? ev?.firma_visual_consulta ?? ''
              ),
              imagen_consulta: String(ev?.imagenConsulta ?? ev?.imagen_consulta ?? ''),
              estudios_confirmados_ids: Array.isArray(estudiosIds) ? estudiosIds : [],
              score_base: Number.isFinite(parsedScoreBase) ? parsedScoreBase : null,
              metricas:
                metricas && typeof metricas === 'object' && !Array.isArray(metricas)
                  ? metricas
                  : {}
            }
          })
          .filter((ev) => Number.isInteger(ev.recorte_id) && ev.recorte_id >= 1)
      : []

    const payload = {
      lineas_origen: feedbackData.lineasOrigen || feedbackData.lineas_origen || [],
      estudios_confirmados_ids: feedbackData.estudiosConfirmadosIds || feedbackData.estudios_confirmados_ids || [],
      asociaciones_directas: (feedbackData.asociacionesDirectas || feedbackData.asociaciones_directas || []).map((a) => ({
        texto: a.texto,
        estudio_id: a.estudioId ?? a.estudio_id
      })),
      renglones_confirmados: (feedbackData.renglonesConfirmados || feedbackData.renglones_confirmados || []).map((r) => ({
        texto: r.texto,
        estudios_ids: r.estudiosIds || r.estudios_ids || [],
        imagen_muestra: r.imagenMuestra ?? r.imagen_muestra ?? ''
      })),
      lineas_descartadas: feedbackData.lineasDescartadas || feedbackData.lineas_descartadas || [],
      recortes_descartados: (feedbackData.recortesDescartados || feedbackData.recortes_descartados || []).map((rd) => ({
        texto: rd.texto || '',
        imagen_muestra: rd.imagenMuestra ?? rd.imagen_muestra ?? ''
      })),
      evaluaciones_trazos: evaluacionesTrazos
    }
    const response = await apiClient.post('/ocr/retroalimentar/', payload)
    return response
  } catch (err) {
    console.warn('No se pudo registrar feedback de aprendizaje OCR:', err)
    return null
  }
}

/**
 * Consulta la configuración operativa y de entrenamiento del módulo OCR.
 * @returns {Promise<{ entrenamientoHabilitado: boolean, totalVotosPositivos: number, totalVotosNegativos: number, fechaActualizacion: string|null }>}
 */
export async function fetchOcrConfigApi() {
  const response = await apiClient.get('/ocr/configuracion/')
  return {
    entrenamientoHabilitado: Boolean(response?.entrenamiento_habilitado),
    totalVotosPositivos: Number(response?.total_votos_positivos || 0),
    totalVotosNegativos: Number(response?.total_votos_negativos || 0),
    fechaActualizacion: response?.fecha_actualizacion || null
  }
}

/**
 * Habilita o bloquea el modo Entrenamiento / Por Recortes OCR (exclusivo Jefatura/Admin).
 * @param {boolean} entrenamientoHabilitado
 */
export async function updateOcrConfigApi(entrenamientoHabilitado) {
  const response = await apiClient.patch('/ocr/configuracion/', {
    entrenamiento_habilitado: Boolean(entrenamientoHabilitado)
  })
  return {
    entrenamientoHabilitado: Boolean(response?.entrenamiento_habilitado),
    totalVotosPositivos: Number(response?.total_votos_positivos || 0),
    totalVotosNegativos: Number(response?.total_votos_negativos || 0),
    fechaActualizacion: response?.fecha_actualizacion || null
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
