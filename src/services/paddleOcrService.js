/**
 * Servicio OCR en Cliente con PaddleOCR (PP-OCRv5 / ONNX Runtime Web).
 * 
 * Ventajas sobre Tesseract:
 * 1. Detección basada en DBNet: localiza polígonos alrededor de cada palabra,
 *    incluso en fotos inclinadas, con viñeteo de cámara o sellos médicos.
 * 2. Reconocimiento con SVTR: lectura secuencial profunda sin depender de cajas rígidas.
 * 3. Ejecución 100% en el navegador vía WebAssembly / WebGPU sin consumir RAM de Render.
 */
import { preprocessRecipeImage } from '../utils/imagePreprocessor'
import { sanitizeRecipeLines } from '../utils/ocrSanitizer'

let paddleInstance = null
let paddleLoadingPromise = null

/**
 * Inicialización perezosa (lazy load) de PaddleOCR.
 * @param {Function} [onProgress]
 * @returns {Promise<any>}
 */
export async function getPaddleOcrInstance(onProgress) {
  if (paddleInstance) {
    return paddleInstance
  }

  if (paddleLoadingPromise) {
    return paddleLoadingPromise
  }

  paddleLoadingPromise = (async () => {
    try {
      if (onProgress) {
        onProgress({
          status: 'loading_paddle',
          progress: 0.1,
          percent: 10,
          message: 'Cargando motor de visión PaddleOCR (DBNet + SVTR)...'
        })
      }

      // Silenciar advertencias informativas de optimización interna de grafos de ONNX Runtime
      if (typeof window !== 'undefined' && !window.__onnx_warn_filtered) {
        window.__onnx_warn_filtered = true
        const origWarn = console.warn
        console.warn = (...args) => {
          if (typeof args[0] === 'string' && args[0].includes('[W:onnxruntime:')) return
          origWarn.apply(console, args)
        }
        const origLog = console.log
        console.log = (...args) => {
          if (typeof args[0] === 'string' && args[0].includes('[W:onnxruntime:')) return
          origLog.apply(console, args)
        }
      }

      // Configurar nivel de logs de ONNX Runtime para que solo reporte errores críticos
      try {
        const ort = await import('onnxruntime-web')
        if (ort?.env) {
          ort.env.logLevel = 'error'
        }
      } catch (_) {}

      // Importación dinámica para code-splitting limpio
      const { PaddleOCR } = await import('@paddleocr/paddleocr-js')

      if (onProgress) {
        onProgress({
          status: 'downloading_paddle_models',
          progress: 0.25,
          percent: 25,
          message: 'Inicializando modelos ONNX de PaddleOCR (PP-OCRv5)...'
        })
      }

      // Cargar modelos directamente desde public/models/paddle/ (100% compatible con Localhost y Vercel)
      const CACHE_NAME = 'paddleocr-models-cache-v1'

      const customFetch = async (url, options) => {
        const urlStr = typeof url === 'string' ? url : url?.url || ''

        // 1. Revisar si ya está en la caché del navegador de la PC del usuario
        let cache = null
        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            cache = await window.caches.open(CACHE_NAME)
            const cachedResponse = await cache.match(urlStr)
            if (cachedResponse) {
              return cachedResponse
            }
          } catch (_) {}
        }

        // 2. Mapear a la ruta estática servida por Vite en local y por el CDN de Vercel en producción
        let fetchUrl = urlStr
        if (fetchUrl.includes('PP-OCRv5_mobile_det_onnx_infer.tar')) {
          fetchUrl = '/models/paddle/PP-OCRv5_mobile_det_onnx_infer.tar'
        } else if (fetchUrl.includes('PP-OCRv5_mobile_rec_onnx_infer.tar')) {
          fetchUrl = '/models/paddle/PP-OCRv5_mobile_rec_onnx_infer.tar'
        }

        const networkResponse = await fetch(fetchUrl, options)

        // 3. Persistir en caché para que las siguientes veces no consuma nada
        if (networkResponse.ok && cache) {
          try {
            await cache.put(urlStr, networkResponse.clone())
          } catch (_) {}
        }

        return networkResponse
      }

      const ocr = await PaddleOCR.create({
        ocrVersion: 'PP-OCRv5',
        fetch: customFetch,
        ortOptions: {
          backend: 'wasm'
        }
      })

      paddleInstance = ocr
      return ocr
    } catch (err) {
      console.error('Error al inicializar PaddleOCR:', err)
      paddleInstance = null
      throw new Error(`No se pudo inicializar PaddleOCR: ${err.message}`)
    } finally {
      paddleLoadingPromise = null
    }
  })()

  return paddleLoadingPromise
}

/**
 * Agrupa ítems de palabras detectadas por PaddleOCR en líneas de texto horizontales.
 * @param {Array<{ poly: Array<{x: number, y: number}>, text: string, score: number }>} items
 * @returns {string[]}
 */
export function groupPaddleItemsIntoLines(items = []) {
  if (!Array.isArray(items) || items.length === 0) return []

  // Calcular centroide vertical de cada caja detectada
  const parsedBoxes = items
    .filter((it) => it && it.text && String(it.text).trim().length > 0)
    .map((it) => {
      const poly = it.poly || []
      const ys = poly.map((p) => p.y)
      const xs = poly.map((p) => p.x)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const centerY = (minY + maxY) / 2
      const height = maxY - minY
      return {
        text: it.text.trim(),
        score: Math.round((it.score || 0) * 100),
        centerY,
        minX,
        maxX,
        height
      }
    })

  if (parsedBoxes.length === 0) return []

  // Ordenar de arriba hacia abajo
  parsedBoxes.sort((a, b) => a.centerY - b.centerY)

  // Agrupar cajas que compartan línea horizontal (diferencia vertical menor al 50% de su altura)
  const lines = []
  let currentLine = [parsedBoxes[0]]

  for (let i = 1; i < parsedBoxes.length; i++) {
    const box = parsedBoxes[i]
    const avgLineY = currentLine.reduce((acc, b) => acc + b.centerY, 0) / currentLine.length
    const avgLineH = currentLine.reduce((acc, b) => acc + b.height, 0) / currentLine.length

    if (Math.abs(box.centerY - avgLineY) <= Math.max(12, avgLineH * 0.6)) {
      currentLine.push(box)
    } else {
      // Ordenar cajas en la misma línea de izquierda a derecha
      currentLine.sort((a, b) => a.minX - b.minX)
      lines.push(currentLine.map((b) => b.text).join(' '))
      currentLine = [box]
    }
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.minX - b.minX)
    lines.push(currentLine.map((b) => b.text).join(' '))
  }

  return lines
}

/**
 * Ejecuta el escaneo de una orden médica completa mediante PaddleOCR.
 * 
 * @param {File|Blob|string|HTMLImageElement|HTMLCanvasElement} imageSource
 * @param {Function} [onProgress]
 * @returns {Promise<{ rawText: string, lines: string[], items: Array, metrics: Object, confidence: number, engineUsed: string, preprocessedDataUrl: string }>}
 */
export async function recognizeRecipePaddle(imageSource, onProgress) {
  if (!imageSource) {
    throw new Error('Debe proporcionar una imagen válida de la orden médica.')
  }

  const startTime = performance.now()

  // 1. Preprocesamiento adaptativo Canvas
  if (onProgress) {
    onProgress({
      status: 'preprocessing',
      progress: 0.1,
      percent: 10,
      message: 'Optimizando resolución y contraste para PaddleOCR...'
    })
  }

  const preprocessed = await preprocessRecipeImage(imageSource, {
    targetWidth: 1600,
    binarize: false
  })

  // 2. Inicializar motor PaddleOCR
  const ocr = await getPaddleOcrInstance(onProgress)

  if (onProgress) {
    onProgress({
      status: 'predicting',
      progress: 0.5,
      percent: 50,
      message: 'Detectando polígonos de texto y leyendo caracteres con PaddleOCR...'
    })
  }

  // 3. Ejecutar predicción sobre el canvas
  const [result] = await ocr.predict(preprocessed.canvas)
  const items = result?.items || []
  const metrics = result?.metrics || {}

  // 4. Agrupar palabras en renglones
  const groupedLines = groupPaddleItemsIntoLines(items)
  const candidateLines = sanitizeRecipeLines(groupedLines)
  const rawText = groupedLines.join('\n')

  // Calcular confianza promedio
  let totalScore = 0
  for (const it of items) {
    totalScore += (it.score || 0)
  }
  const avgConfidence = items.length > 0 ? Math.round((totalScore / items.length) * 100) : 0
  const totalMs = Math.round(performance.now() - startTime)

  if (onProgress) {
    onProgress({
      status: 'done',
      progress: 1,
      percent: 100,
      message: `PaddleOCR completó en ${totalMs} ms (${items.length} palabras detectadas)`
    })
  }

  return {
    rawText,
    lines: candidateLines,
    allLines: groupedLines,
    items,
    metrics: {
      ...metrics,
      totalExecutionMs: totalMs,
      wordsCount: items.length
    },
    confidence: avgConfidence,
    engineUsed: 'PaddleOCR (PP-OCRv5)',
    preprocessedDataUrl: preprocessed.dataUrl
  }
}
