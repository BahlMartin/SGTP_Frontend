import { createWorker } from 'tesseract.js'
import { preprocessRecipeImage } from '../utils/imagePreprocessor'

/**
 * Servicio OCR en Cliente (WebAssembly) con Tesseract.js.
 * Ejecuta el reconocimiento óptico de caracteres 100% en el navegador de la recepcionista.
 * La imagen médica nunca sale de la memoria local de la PC.
 */

let activeWorker = null
let isWorkerInitializing = false

/**
 * Traduce los estados internos de Tesseract.js a descripciones amigables en español.
 */
function mapTesseractStatus(status, progress = 0) {
  const percent = Math.round((progress || 0) * 100)
  switch (status) {
    case 'loading tesseract core':
      return 'Cargando motor OCR en memoria...'
    case 'loading language traineddata':
      return 'Cargando modelo lingüístico en español...'
    case 'loaded language traineddata':
      return 'Modelo en español cargado'
    case 'initializing tesseract':
      return 'Inicializando reconocedor...'
    case 'initialized tesseract':
      return 'Motor listo'
    case 'recognizing text':
      return `Reconociendo texto de la receta (${percent}%)...`
    default:
      return percent > 0 ? `Procesando (${percent}%)...` : 'Preparando reconocimiento...'
  }
}

/**
 * Obtiene o crea un Worker de Tesseract configurado para idioma español.
 * @param {Function} [onProgress] Callback para reportar porcentaje y estado
 * @returns {Promise<import('tesseract.js').Worker>}
 */
export async function getTesseractWorker(onProgress) {
  if (activeWorker) {
    return activeWorker
  }

  if (isWorkerInitializing) {
    // Esperar si otro proceso lo está inicializando
    while (isWorkerInitializing) {
      await new Promise((r) => setTimeout(r, 50))
    }
    if (activeWorker) return activeWorker
  }

  isWorkerInitializing = true
  try {
    const worker = await createWorker('spa', 1, {
      logger: (m) => {
        if (onProgress && m) {
          const userMessage = mapTesseractStatus(m.status, m.progress)
          onProgress({
            status: m.status,
            progress: m.progress || 0,
            percent: Math.round((m.progress || 0) * 100),
            message: userMessage
          })
        }
      }
    })

    activeWorker = worker
    return activeWorker
  } finally {
    isWorkerInitializing = false
  }
}

/**
 * Libera la memoria del worker de Tesseract si es necesario.
 */
export async function terminateTesseractWorker() {
  if (activeWorker) {
    try {
      await activeWorker.terminate()
    } catch (e) {
      console.warn('Error al terminar worker de Tesseract:', e)
    } finally {
      activeWorker = null
    }
  }
}

/**
 * Limpia y filtra líneas de texto para descartar encabezados no médicos, firmas y ruido común de recetarios.
 * @param {string[]} rawLines
 * @returns {string[]} Líneas candidatas a nombres de estudios
 */
export function sanitizeRecipeLines(rawLines = []) {
  const noisePatterns = [
    /^(dr|dra|doctor|doctora)\b/i,
    /^(m\.?n\.?|m\.?p\.?|matricula|matrícula)\b/i,
    /^(r\/?p|rp:?|prescripcion|prescripción)\b/i,
    /^(paciente|nombre|apellido|edad|sexo|dni|afiliado)\b/i,
    /^(fecha|diagnostico|diagnóstico|diag:?)\b/i,
    /^(solicito|indicacion|indicación|urgente)\b/i,
    /^(firma|sello|laboratorio|analisis|análisis)\b/i,
    /^[0-9\s.,\-_/\\:;*+~#]+$/ // Líneas que solo tienen números y símbolos
  ]

  const cleanLines = []

  for (const line of rawLines) {
    const trimmed = String(line || '').trim()
    if (trimmed.length < 3) continue

    const isNoise = noisePatterns.some((pattern) => pattern.test(trimmed))
    if (!isNoise) {
      // Eliminar viñetas o guiones al inicio (ej: "- Hemograma" -> "Hemograma")
      const normalized = trimmed.replace(/^[-*•–—>+.]\s*/, '').trim()
      if (normalized.length >= 3) {
        cleanLines.push(normalized)
      }
    }
  }

  return cleanLines
}

/**
 * Procesa integralmente una orden médica:
 * 1. Preprocesamiento óptico en Canvas (Otsu binarización y contraste).
 * 2. Reconocimiento OCR en cliente mediante Tesseract.js.
 * 3. Segmentación y filtrado de ruido no médico.
 *
 * @param {File|Blob|string|HTMLVideoElement} imageSource
 * @param {Function} [onProgress] Callback para reportar estado y porcentaje
 * @returns {Promise<{ rawText: string, lines: string[], preprocessedDataUrl: string, confidence: number }>}
 */
export async function recognizeRecipeClient(imageSource, onProgress) {
  if (onProgress) {
    onProgress({
      status: 'preprocessing',
      progress: 0.05,
      percent: 5,
      message: 'Optimizando imagen (filtro de contraste y binarización Otsu)...'
    })
  }

  // 1. Preprocesamiento en Canvas
  const preprocessed = await preprocessRecipeImage(imageSource, {
    targetWidth: 1600,
    binarize: true
  })

  // 2. Obtener worker de Tesseract y ejecutar reconocimiento
  const worker = await getTesseractWorker(onProgress)

  const result = await worker.recognize(preprocessed.canvas)
  const fullText = result.data?.text || ''
  const confidence = result.data?.confidence || 0

  // 3. Segmentar por saltos de línea y sanitizar
  const splitLines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const candidateLines = sanitizeRecipeLines(splitLines)

  return {
    rawText: fullText,
    lines: candidateLines,
    preprocessedDataUrl: preprocessed.dataUrl,
    confidence
  }
}
