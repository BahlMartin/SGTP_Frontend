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
import { sanitizeRecipeLine } from '../utils/ocrSanitizer'

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
        const shouldFilter = (args) => {
          return args.some(
            (arg) =>
              typeof arg === 'string' &&
              (arg.includes('onnxruntime') ||
                arg.includes('CleanUnusedInitializersAndNodeArgs') ||
                arg.includes('Removing initializer') ||
                arg.includes('[W:onnxruntime:'))
          )
        }
        const origWarn = console.warn
        console.warn = (...args) => {
          if (shouldFilter(args)) return
          origWarn.apply(console, args)
        }
        const origLog = console.log
        console.log = (...args) => {
          if (shouldFilter(args)) return
          origLog.apply(console, args)
        }
        const origInfo = console.info
        console.info = (...args) => {
          if (shouldFilter(args)) return
          origInfo.apply(console, args)
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
 * Genera un recorte WebP/JPEG liviano (~2-5 KB) de un único renglón del canvas.
 * Nunca expone datos sensibles del resto de la receta y limita dimensiones a max 360x44px.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
 * @returns {string|null}
 */
export function cropLineFromCanvas(canvas, bbox) {
  if (!canvas || !bbox || !canvas.width || !canvas.height) return null

  const padX = 10
  const padY = 6
  const startX = Math.max(0, Math.floor(bbox.minX - padX))
  const startY = Math.max(0, Math.floor(bbox.minY - padY))
  const endX = Math.min(canvas.width, Math.ceil(bbox.maxX + padX))
  const endY = Math.min(canvas.height, Math.ceil(bbox.maxY + padY))

  const cropWidth = Math.max(1, endX - startX)
  const cropHeight = Math.max(1, endY - startY)

  const scale = Math.min(1, 44 / cropHeight, 360 / cropWidth)
  const destWidth = Math.max(1, Math.round(cropWidth * scale))
  const destHeight = Math.max(1, Math.round(cropHeight * scale))

  try {
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = destWidth
    tempCanvas.height = destHeight
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, destWidth, destHeight)
    ctx.drawImage(canvas, startX, startY, cropWidth, cropHeight, 0, 0, destWidth, destHeight)

    const webpUrl = tempCanvas.toDataURL('image/webp', 0.65)
    if (webpUrl && webpUrl.startsWith('data:image/webp')) {
      return webpUrl
    }
    return tempCanvas.toDataURL('image/jpeg', 0.65)
  } catch (err) {
    console.warn('No se pudo recortar renglón de imagen:', err)
    return null
  }
}

/**
 * Agrupa ítems de palabras detectadas por PaddleOCR en renglones horizontales enriquecidos,
 * conservando coordenadas (bbox), confianza promedio y el recorte visual del renglón.
 *
 * @param {Array<{ poly: Array<{x: number, y: number}>, text: string, score: number }>} items
 * @param {HTMLCanvasElement|null} [sourceCanvas=null]
 * @returns {Array<{ text: string, confidence: number, bbox: Object, cropDataUrl: string|null }>}
 */
export function groupPaddleItemsIntoRichLines(items = [], sourceCanvas = null) {
  if (!Array.isArray(items) || items.length === 0) return []

  const parsedBoxes = items
    .filter((it) => it && it.text && String(it.text).trim().length > 0 && Array.isArray(it.poly) && it.poly.length > 0)
    .map((it) => {
      const ys = it.poly.map((p) => p.y)
      const xs = it.poly.map((p) => p.x)
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
        minY,
        maxY,
        height
      }
    })

  if (parsedBoxes.length === 0) return []

  parsedBoxes.sort((a, b) => a.centerY - b.centerY)

  const lineGroups = []
  let currentLine = [parsedBoxes[0]]

  for (let i = 1; i < parsedBoxes.length; i++) {
    const box = parsedBoxes[i]
    const avgLineY = currentLine.reduce((acc, b) => acc + b.centerY, 0) / currentLine.length
    const avgLineH = currentLine.reduce((acc, b) => acc + b.height, 0) / currentLine.length

    if (Math.abs(box.centerY - avgLineY) <= Math.max(12, avgLineH * 0.6)) {
      currentLine.push(box)
    } else {
      lineGroups.push(currentLine)
      currentLine = [box]
    }
  }

  if (currentLine.length > 0) {
    lineGroups.push(currentLine)
  }

  return lineGroups.map((group) => {
    group.sort((a, b) => a.minX - b.minX)
    const text = group.map((b) => b.text).join(' ')
    const avgConf = Math.round(group.reduce((acc, b) => acc + b.score, 0) / group.length)
    const bbox = {
      minX: Math.min(...group.map((b) => b.minX)),
      minY: Math.min(...group.map((b) => b.minY)),
      maxX: Math.max(...group.map((b) => b.maxX)),
      maxY: Math.max(...group.map((b) => b.maxY))
    }
    return {
      text,
      confidence: avgConf,
      bbox,
      cropDataUrl: sourceCanvas ? cropLineFromCanvas(sourceCanvas, bbox) : null
    }
  })
}

/**
 * Agrupa ítems de palabras detectadas por PaddleOCR en líneas de texto horizontales.
 * @param {Array<{ poly: Array<{x: number, y: number}>, text: string, score: number }>} items
 * @returns {string[]}
 */
export function groupPaddleItemsIntoLines(items = []) {
  return groupPaddleItemsIntoRichLines(items, null).map((line) => line.text)
}

/**
 * Ejecuta el escaneo de una orden médica completa mediante PaddleOCR.
 * 
 * @param {File|Blob|string|HTMLImageElement|HTMLCanvasElement} imageSource
 * @param {Function} [onProgress]
 * @returns {Promise<{ rawText: string, lines: string[], richLines: Array, items: Array, metrics: Object, confidence: number, engineUsed: string, preprocessedDataUrl: string }>}
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

  // 4. Agrupar palabras en renglones y generar recortes por renglón
  const groupedRichLines = groupPaddleItemsIntoRichLines(items, preprocessed.canvas)
  const groupedLines = groupedRichLines.map((line) => line.text)

  const candidateRichLines = []
  for (const richLine of groupedRichLines) {
    const cleanText = sanitizeRecipeLine(richLine.text)
    if (cleanText) {
      candidateRichLines.push({
        ...richLine,
        text: cleanText
      })
    }
  }
  const candidateLines = candidateRichLines.map((line) => line.text)
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
    richLines: candidateRichLines,
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
