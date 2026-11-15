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
 * Analiza la franja horizontal de un renglón en el canvas preprocesado para detectar
 * en qué coordenadas X hay trazos reales de escritura (tinta) y dónde hay papel en blanco.
 * Ignora líneas horizontales finas de formularios exigiendo dispersión vertical >= 3px.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @param {number} minY
 * @param {number} maxY
 * @returns {Uint8Array|null} Arreglo de longitud `canvas.width` con 1 donde hay tinta y 0 donde es blanco
 */
function analyzeRowInkProfile(canvas, minY, maxY) {
  if (!canvas || !canvas.width || !canvas.height) return null

  const rowHeight = Math.max(8, maxY - minY)
  const bandY1 = Math.max(0, Math.floor(minY + rowHeight * 0.12))
  const bandY2 = Math.min(canvas.height, Math.ceil(maxY - rowHeight * 0.12))
  const bandHeight = Math.max(4, bandY2 - bandY1)
  if (bandY1 >= canvas.height || bandHeight <= 0) return null

  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const { data, width } = ctx.getImageData(0, bandY1, canvas.width, bandHeight)
    const hasInk = new Uint8Array(width)

    for (let x = 0; x < width; x++) {
      let darkCount = 0
      let firstDarkY = -1
      let lastDarkY = -1

      for (let y = 0; y < bandHeight; y++) {
        const lum = data[(y * width + x) * 4]
        if (lum < 185) {
          darkCount++
          if (firstDarkY === -1) firstDarkY = y
          lastDarkY = y
        }
      }

      if (darkCount >= 2 && lastDarkY - firstDarkY >= 3) {
        hasInk[x] = 1
      }
    }

    return hasInk
  } catch (err) {
    console.warn('No se pudo analizar perfil de tinta del renglón:', err)
    return null
  }
}

/**
 * Verifica si entre dos coordenadas X existe un tramo continuo de papel blanco.
 *
 * @param {Uint8Array} hasInk
 * @param {number} startX
 * @param {number} endX
 * @param {number} minWhiteRun
 * @returns {boolean}
 */
function hasContinuousWhiteGap(hasInk, startX, endX, minWhiteRun) {
  const fromX = Math.max(0, Math.floor(startX))
  const toX = Math.min(hasInk.length - 1, Math.ceil(endX))
  if (toX <= fromX) return false

  let currentWhite = 0
  let maxWhite = 0
  for (let x = fromX; x <= toX; x++) {
    if (hasInk[x] === 0) {
      currentWhite++
      if (currentWhite > maxWhite) maxWhite = currentWhite
    } else {
      currentWhite = 0
    }
  }
  return maxWhite >= minWhiteRun
}

/**
 * Extiende los límites horizontales [minX, maxX] de un bloque mientras haya trazos escritos
 * y detiene el avance apenas encuentra un espacio continuo en blanco.
 *
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
 * @param {Uint8Array|null} hasInk
 * @param {number} canvasWidth
 * @param {number} leftBoundX
 * @param {number} rightBoundX
 * @param {number} whiteStopThreshold
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
function expandSegmentBoundsUntilWhite(
  bbox,
  hasInk,
  canvasWidth,
  leftBoundX,
  rightBoundX,
  whiteStopThreshold
) {
  if (!hasInk || !canvasWidth) return bbox

  const minSafeX = Math.max(Math.floor(canvasWidth * 0.04), Math.floor(leftBoundX))
  const maxSafeX = Math.min(Math.ceil(canvasWidth * 0.96) - 1, Math.ceil(rightBoundX))
  if (maxSafeX <= minSafeX) return bbox

  const startRight = Math.min(maxSafeX, Math.max(minSafeX, Math.ceil(bbox.maxX)))
  let lastInkX = startRight
  let whiteRunRight = 0

  for (let x = startRight; x <= maxSafeX; x++) {
    if (hasInk[x] === 1) {
      lastInkX = x
      whiteRunRight = 0
    } else {
      whiteRunRight++
      if (whiteRunRight >= whiteStopThreshold) {
        break
      }
    }
  }

  const startLeft = Math.max(minSafeX, Math.min(maxSafeX, Math.floor(bbox.minX)))
  let firstInkX = startLeft
  let whiteRunLeft = 0
  const leftWhiteThreshold = Math.max(16, Math.round(whiteStopThreshold * 0.85))

  for (let x = startLeft; x >= minSafeX; x--) {
    if (hasInk[x] === 1) {
      firstInkX = x
      whiteRunLeft = 0
    } else {
      whiteRunLeft++
      if (whiteRunLeft >= leftWhiteThreshold) {
        break
      }
    }
  }

  return {
    minX: Math.min(bbox.minX, firstInkX),
    minY: bbox.minY,
    maxX: Math.max(bbox.maxX, lastInkX),
    maxY: bbox.maxY
  }
}

/**
 * Genera un recorte WebP/JPEG de un bloque o renglón del canvas ajustado a sus límites de escritura.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
 * @param {{ maxWidth?: number, maxHeight?: number, quality?: number }} [options]
 * @returns {string|null}
 */
export function cropLineFromCanvas(canvas, bbox, options = {}) {
  if (!canvas || !bbox || !canvas.width || !canvas.height) return null

  const {
    maxWidth = 760,
    maxHeight = 96,
    quality = 0.82
  } = options

  const { minX, minY, maxX, maxY } = bbox
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null
  }

  const boxHeight = Math.max(12, maxY - minY)
  const padX = 14
  const padY = Math.max(10, Math.round(boxHeight * 0.35))
  const startX = Math.max(0, Math.floor(minX - padX))
  const endX = Math.min(canvas.width, Math.ceil(maxX + padX))
  const startY = Math.max(0, Math.floor(minY - padY))
  const endY = Math.min(canvas.height, Math.ceil(maxY + padY))

  const cropWidth = Math.max(1, endX - startX)
  const cropHeight = Math.max(1, endY - startY)

  const scale = Math.min(1, maxHeight / cropHeight, maxWidth / cropWidth)
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

    const webpUrl = tempCanvas.toDataURL('image/webp', quality)
    if (webpUrl && webpUrl.startsWith('data:image/webp')) {
      return webpUrl
    }
    return tempCanvas.toDataURL('image/jpeg', quality)
  } catch (err) {
    console.warn('No se pudo recortar renglón de imagen:', err)
    return null
  }
}

/**
 * Agrupa ítems de palabras detectadas por PaddleOCR en renglones y columnas enriquecidos,
 * separando estudios en múltiples columnas cuando detecta espacio en blanco continuo y
 * extendiendo cada recorte sobre lo escrito hasta donde comienza el papel en blanco.
 *
 * @param {Array<{ poly: Array<[number, number]|{x: number, y: number}>, text: string, score: number }>} items
 * @param {HTMLCanvasElement|null} [sourceCanvas=null]
 * @returns {Array<{ text: string, confidence: number, bbox: Object, rowIndex: number, colIndex: number, totalColsInRow: number, cropDataUrl: string|null, cropStorageDataUrl: string|null }>}
 */
export function groupPaddleItemsIntoRichLines(items = [], sourceCanvas = null) {
  if (!Array.isArray(items) || items.length === 0) return []

  const parsedBoxes = items
    .filter((it) => it && it.text && String(it.text).trim().length > 0 && Array.isArray(it.poly) && it.poly.length > 0)
    .map((it) => {
      const xs = []
      const ys = []
      for (const p of it.poly) {
        const x = Array.isArray(p) ? Number(p[0]) : Number(p?.x)
        const y = Array.isArray(p) ? Number(p[1]) : Number(p?.y)
        if (Number.isFinite(x) && Number.isFinite(y)) {
          xs.push(x)
          ys.push(y)
        }
      }
      if (xs.length === 0 || ys.length === 0) return null

      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const centerY = (minY + maxY) / 2
      const height = Math.max(1, maxY - minY)
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
    .filter(Boolean)

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

  const richLines = []

  lineGroups.forEach((group, rowIdx) => {
    group.sort((a, b) => a.minX - b.minX)

    const rowMinY = Math.min(...group.map((b) => b.minY))
    const rowMaxY = Math.max(...group.map((b) => b.maxY))
    const avgRowH = group.reduce((acc, b) => acc + b.height, 0) / group.length

    const whiteStopThreshold = sourceCanvas?.width
      ? Math.min(
          Math.round(sourceCanvas.width * 0.13),
          Math.max(Math.round(avgRowH * 2.2), Math.round(sourceCanvas.width * 0.065))
        )
      : Math.max(40, Math.round(avgRowH * 2.3))

    const hasInk = sourceCanvas ? analyzeRowInkProfile(sourceCanvas, rowMinY, rowMaxY) : null

    const columnSegments = []
    let currentSeg = [group[0]]
    let segMaxX = group[0].maxX

    for (let k = 1; k < group.length; k++) {
      const box = group[k]
      const gapPx = box.minX - segMaxX
      const minWhiteRun = Math.max(18, Math.round(whiteStopThreshold * 0.8))
      const isColumnSplit =
        gapPx >= whiteStopThreshold &&
        (!hasInk || hasContinuousWhiteGap(hasInk, segMaxX, box.minX, minWhiteRun))

      if (isColumnSplit) {
        columnSegments.push(currentSeg)
        currentSeg = [box]
        segMaxX = box.maxX
      } else {
        currentSeg.push(box)
        segMaxX = Math.max(segMaxX, box.maxX)
      }
    }
    columnSegments.push(currentSeg)

    const totalColsInRow = columnSegments.length

    columnSegments.forEach((seg, colIdx) => {
      const text = seg.map((b) => b.text).join(' ')
      const avgConf = Math.round(seg.reduce((acc, b) => acc + b.score, 0) / seg.length)
      const rawBbox = {
        minX: Math.min(...seg.map((b) => b.minX)),
        minY: Math.min(...seg.map((b) => b.minY)),
        maxX: Math.max(...seg.map((b) => b.maxX)),
        maxY: Math.max(...seg.map((b) => b.maxY))
      }

      const prevSeg = colIdx > 0 ? columnSegments[colIdx - 1] : null
      const nextSeg = colIdx < totalColsInRow - 1 ? columnSegments[colIdx + 1] : null
      const leftBoundX = prevSeg ? Math.max(...prevSeg.map((b) => b.maxX)) + 8 : 0
      const rightBoundX = nextSeg
        ? Math.min(...nextSeg.map((b) => b.minX)) - 8
        : sourceCanvas?.width || rawBbox.maxX

      const bbox = hasInk
        ? expandSegmentBoundsUntilWhite(
            rawBbox,
            hasInk,
            sourceCanvas.width,
            leftBoundX,
            rightBoundX,
            whiteStopThreshold
          )
        : rawBbox

      richLines.push({
        text,
        confidence: avgConf,
        bbox,
        rowIndex: rowIdx + 1,
        colIndex: colIdx + 1,
        totalColsInRow,
        cropDataUrl: sourceCanvas
          ? cropLineFromCanvas(sourceCanvas, bbox, { maxWidth: 760, maxHeight: 96, quality: 0.82 })
          : null,
        cropStorageDataUrl: sourceCanvas
          ? cropLineFromCanvas(sourceCanvas, bbox, { maxWidth: 420, maxHeight: 52, quality: 0.65 })
          : null
      })
    })
  })

  return richLines
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
