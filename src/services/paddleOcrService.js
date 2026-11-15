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
 * Limpia ruido CJK o caracteres extraños que PaddleOCR (PP-OCRv5 multilingüe) puede emitir
 * sobre trazos cursivos ambiguos, conservando letras latinas, dígitos y signos clínicos.
 *
 * @param {string} rawText
 * @returns {string}
 */
export function cleanRecognizedOcrText(rawText) {
  return String(rawText || '')
    .replace(/[^\x20-\x7EÁÉÍÓÚÜÑáéíóúüñ°º]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calcula una huella visual perceptual compacta (dHash 64 bits + relación de aspecto = 18 hex)
 * de un bloque manuscrito para reconocerlo en futuros escaneos aunque el texto OCR sea impreciso.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
 * @returns {string}
 */
export function computeBlockVisualSignature(canvas, bbox) {
  if (!canvas || !bbox || !canvas.width || !canvas.height) return ''
  const { minX, minY, maxX, maxY } = bbox
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return ''
  }

  const startX = Math.max(0, Math.floor(minX - 6))
  const startY = Math.max(0, Math.floor(minY - 6))
  const endX = Math.min(canvas.width, Math.ceil(maxX + 6))
  const endY = Math.min(canvas.height, Math.ceil(maxY + 6))
  const cropW = Math.max(1, endX - startX)
  const cropH = Math.max(1, endY - startY)

  try {
    const gridW = 9
    const gridH = 8
    const temp = document.createElement('canvas')
    temp.width = gridW
    temp.height = gridH
    const ctx = temp.getContext('2d')
    if (!ctx) return ''

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, gridW, gridH)
    ctx.drawImage(canvas, startX, startY, cropW, cropH, 0, 0, gridW, gridH)

    const { data } = ctx.getImageData(0, 0, gridW, gridH)
    let hexHash = ''
    let nibble = 0
    let bitCount = 0

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW - 1; x++) {
        const i1 = (y * gridW + x) * 4
        const i2 = (y * gridW + x + 1) * 4
        const lum1 = 0.299 * data[i1] + 0.587 * data[i1 + 1] + 0.114 * data[i1 + 2]
        const lum2 = 0.299 * data[i2] + 0.587 * data[i2 + 1] + 0.114 * data[i2 + 2]
        nibble = (nibble << 1) | (lum1 < lum2 ? 1 : 0)
        bitCount++
        if (bitCount === 4) {
          hexHash += nibble.toString(16)
          nibble = 0
          bitCount = 0
        }
      }
    }

    const aspectBucket = Math.max(1, Math.min(255, Math.round((cropW / cropH) * 16)))
    return hexHash + aspectBucket.toString(16).padStart(2, '0')
  } catch (err) {
    console.warn('No se pudo calcular firma visual del bloque:', err)
    return ''
  }
}

/**
 * Embebe la huella visual como parámetro MIME en el DataURL para almacenamiento en BD
 * sin romper compatibilidad ni requerir columnas adicionales.
 *
 * @param {string|null} dataUrl
 * @param {string} visualHash
 * @returns {string|null}
 */
function embedVisualHashInDataUrl(dataUrl, visualHash) {
  if (!dataUrl || !visualHash || !dataUrl.startsWith('data:image/') || !dataUrl.includes(';base64,')) {
    return dataUrl
  }
  return dataUrl.replace(';base64,', `;vhash=${visualHash};base64,`)
}

/**
 * Analiza la franja horizontal de un renglón en el canvas preprocesado para detectar
 * en qué coordenadas X hay trazos reales de escritura (tinta) y dónde hay papel en blanco.
 * Ignora líneas horizontales finas de formularios (vertical < 3px) y fondos sólidos negros.
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
        if (lum < 195) {
          darkCount++
          if (firstDarkY === -1) firstDarkY = y
          lastDarkY = y
        }
      }

      if (darkCount >= 2 && lastDarkY - firstDarkY >= 3 && darkCount <= bandHeight * 0.85) {
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
 * Segmenta una franja de tinta horizontal en bloques/columnas independientes cortando cuando
 * aparece un tramo continuo de blanco >= `whiteGapThreshold`.
 *
 * @param {Uint8Array} hasInk
 * @param {number} canvasWidth
 * @param {number|null} [minXBound=null]
 * @param {number|null} [maxXBound=null]
 * @param {number|null} [whiteGapThreshold=null]
 * @returns {Array<{ minX: number, maxX: number }>}
 */
function segmentRowIntoInkColumns(
  hasInk,
  canvasWidth,
  minXBound = null,
  maxXBound = null,
  whiteGapThreshold = null
) {
  if (!hasInk || !canvasWidth) return []

  const startX =
    minXBound !== null ? Math.max(0, Math.floor(minXBound)) : Math.floor(canvasWidth * 0.04)
  const endX =
    maxXBound !== null
      ? Math.min(hasInk.length - 1, Math.ceil(maxXBound))
      : Math.ceil(canvasWidth * 0.96) - 1
  if (endX <= startX) return []

  const minWhiteGap = whiteGapThreshold ?? Math.max(36, Math.round(canvasWidth * 0.085))
  const blocks = []
  let inBlock = false
  let blockStart = 0
  let blockLastInk = 0
  let whiteRun = 0

  for (let x = startX; x <= endX; x++) {
    if (hasInk[x] === 1) {
      if (!inBlock) {
        inBlock = true
        blockStart = x
      }
      blockLastInk = x
      whiteRun = 0
    } else if (inBlock) {
      whiteRun++
      if (whiteRun >= minWhiteGap) {
        if (blockLastInk - blockStart >= 26) {
          blocks.push({ minX: blockStart, maxX: blockLastInk })
        }
        inBlock = false
        whiteRun = 0
      }
    }
  }

  if (inBlock && blockLastInk - blockStart >= 26) {
    blocks.push({ minX: blockStart, maxX: blockLastInk })
  }

  return blocks
}

/**
 * Detecta bloques escritos en 2D mediante proyección horizontal y vertical de tinta sobre el
 * canvas preprocesado, recuperando filas cursivas o columnas que DBNet haya omitido o fusionado.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @returns {Array<{ minX: number, maxX: number, minY: number, maxY: number }>}
 */
function detectInkBlocksFromCanvas(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return []
  const width = canvas.width
  const height = canvas.height

  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return []
    const { data } = ctx.getImageData(0, 0, width, height)

    const marginX = Math.floor(width * 0.04)
    const maxSafeX = Math.ceil(width * 0.96)
    const colDarkTotals = new Int32Array(width)
    const inkMask = new Uint8Array(width * height)

    for (let y = 0; y < height; y++) {
      const rowOff = y * width
      for (let x = marginX; x < maxSafeX; x++) {
        const lum = data[(rowOff + x) * 4]
        if (lum < 205) {
          inkMask[rowOff + x] = 1
          colDarkTotals[x]++
        }
      }
    }

    // Suprimir bordes verticales de formularios u orillas oscuras continuas
    const maxColDensity = height * 0.45
    const rowCounts = new Float32Array(height)
    for (let y = 0; y < height; y++) {
      const rowOff = y * width
      let rowInk = 0
      for (let x = marginX; x < maxSafeX; x++) {
        if (inkMask[rowOff + x] === 1 && colDarkTotals[x] <= maxColDensity) {
          rowInk++
        }
      }
      rowCounts[y] = rowInk
    }

    // Suavizado vertical ventana 5px
    const smoothed = new Float32Array(height)
    const sortedVals = []
    for (let y = 0; y < height; y++) {
      let acc = 0
      let cnt = 0
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy
        if (yy >= 0 && yy < height) {
          acc += rowCounts[yy]
          cnt++
        }
      }
      const val = acc / Math.max(1, cnt)
      smoothed[y] = val
      sortedVals.push(val)
    }

    sortedVals.sort((a, b) => a - b)
    const p25 = sortedVals[Math.floor(sortedVals.length * 0.25)] || 0
    const rowThreshold = Math.max(10, p25 * 1.6)

    const rawBands = []
    let y = 0
    while (y < height) {
      if (smoothed[y] > rowThreshold) {
        const bandStart = y
        while (y < height && smoothed[y] > rowThreshold) {
          y++
        }
        rawBands.push({ y1: bandStart, y2: y })
      } else {
        y++
      }
    }

    // Unir micro-cortes verticales (< 8px) dentro de un mismo renglón
    const mergedBands = []
    for (const band of rawBands) {
      const prev = mergedBands[mergedBands.length - 1]
      if (prev && band.y1 - prev.y2 < 8) {
        prev.y2 = band.y2
      } else {
        mergedBands.push({ ...band })
      }
    }

    const maxBandHeight = Math.max(140, Math.round(height * 0.38))
    const colWhiteGap = Math.max(36, Math.round(width * 0.085))
    const blocks = []

    for (const band of mergedBands) {
      const bandH = band.y2 - band.y1
      if (bandH < 14 || bandH > maxBandHeight) continue

      const y1 = Math.max(0, band.y1 - 4)
      const y2 = Math.min(height, band.y2 + 4)
      const hasInk = analyzeRowInkProfile(canvas, y1, y2)
      if (!hasInk) continue

      const cols = segmentRowIntoInkColumns(hasInk, width, null, null, colWhiteGap)
      for (const col of cols) {
        blocks.push({
          minX: col.minX,
          maxX: col.maxX,
          minY: y1,
          maxY: y2
        })
      }
    }

    return blocks
  } catch (err) {
    console.warn('No se pudo detectar bloques por tinta:', err)
    return []
  }
}

/**
 * Genera un canvas individual para un bloque con texto a ~64px de alto y margen blanco limpio
 * para mejorar la detección de palabras cursivas aisladas en PaddleOCR.
 *
 * @param {HTMLCanvasElement|null} sourceCanvas
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
 * @returns {HTMLCanvasElement|null}
 */
function createPaddedBlockCanvasForOcr(sourceCanvas, bbox) {
  if (!sourceCanvas || !bbox || !sourceCanvas.width || !sourceCanvas.height) return null

  const startX = Math.max(0, Math.floor(bbox.minX - 10))
  const startY = Math.max(0, Math.floor(bbox.minY - 8))
  const endX = Math.min(sourceCanvas.width, Math.ceil(bbox.maxX + 10))
  const endY = Math.min(sourceCanvas.height, Math.ceil(bbox.maxY + 8))
  const cropW = Math.max(1, endX - startX)
  const cropH = Math.max(1, endY - startY)

  const scale = Math.max(0.75, Math.min(2.5, 64 / cropH))
  const destW = Math.max(1, Math.round(cropW * scale))
  const destH = Math.max(1, Math.round(cropH * scale))
  const pad = 24

  try {
    const out = document.createElement('canvas')
    out.width = destW + pad * 2
    out.height = destH + pad * 2
    const ctx = out.getContext('2d')
    if (!ctx) return null

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(sourceCanvas, startX, startY, cropW, cropH, pad, pad, destW, destH)
    return out
  } catch (err) {
    console.warn('No se pudo preparar canvas del bloque para OCR:', err)
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
 * Verifica si un bloque de tinta recién detectado se solapa significativamente con algún bloque existente.
 *
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} inkBlock
 * @param {Array<{ bbox: { minX: number, minY: number, maxX: number, maxY: number } }>} existingBlocks
 * @returns {boolean}
 */
function overlapsExistingBlock(inkBlock, existingBlocks) {
  const inkW = Math.max(1, inkBlock.maxX - inkBlock.minX)
  const inkH = Math.max(1, inkBlock.maxY - inkBlock.minY)

  for (const existing of existingBlocks) {
    const b = existing.bbox
    const yOverlap = Math.max(0, Math.min(inkBlock.maxY, b.maxY) - Math.max(inkBlock.minY, b.minY))
    const xOverlap = Math.max(0, Math.min(inkBlock.maxX, b.maxX) - Math.max(inkBlock.minX, b.minX))
    const minH = Math.max(1, Math.min(inkH, b.maxY - b.minY))
    const minW = Math.max(1, Math.min(inkW, b.maxX - b.minX))

    if (yOverlap / minH >= 0.35 && xOverlap / minW >= 0.35) {
      return true
    }
  }

  return false
}

/**
 * Agrupa ítems de palabras detectadas por PaddleOCR en renglones y columnas enriquecidos,
 * combina bloques cursivos detectados por proyección 2D de tinta, separa columnas amplias
 * en bloques independientes y calcula el recorte + firma visual de cada bloque.
 *
 * @param {Array<{ poly: Array<[number, number]|{x: number, y: number}>, text: string, score: number }>} items
 * @param {HTMLCanvasElement|null} [sourceCanvas=null]
 * @returns {Array<{ text: string, confidence: number, bbox: Object, rowIndex: number, colIndex: number, totalColsInRow: number, needsBlockOcr: boolean, visualHash: string, cropDataUrl: string|null, cropStorageDataUrl: string|null }>}
 */
export function groupPaddleItemsIntoRichLines(items = [], sourceCanvas = null) {
  const hasItems = Array.isArray(items) && items.length > 0
  if (!hasItems && !sourceCanvas) return []

  const parsedBoxes = hasItems
    ? items
        .filter((it) => it && Array.isArray(it.poly) && it.poly.length > 0)
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

          const cleanedText = cleanRecognizedOcrText(it.text)
          if (!cleanedText && !sourceCanvas) return null

          const minY = Math.min(...ys)
          const maxY = Math.max(...ys)
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const centerY = (minY + maxY) / 2
          const height = Math.max(1, maxY - minY)
          return {
            text: cleanedText,
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
    : []

  const rawBlocks = []

  if (parsedBoxes.length > 0) {
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

    for (const group of lineGroups) {
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

      const totalSegs = columnSegments.length

      columnSegments.forEach((seg, segIdx) => {
        const segText = seg
          .map((b) => b.text)
          .filter(Boolean)
          .join(' ')
          .trim()
        const avgConf = Math.round(seg.reduce((acc, b) => acc + b.score, 0) / seg.length)
        const rawBbox = {
          minX: Math.min(...seg.map((b) => b.minX)),
          minY: Math.min(...seg.map((b) => b.minY)),
          maxX: Math.max(...seg.map((b) => b.maxX)),
          maxY: Math.max(...seg.map((b) => b.maxY))
        }

        const segWidth = rawBbox.maxX - rawBbox.minX
        const splitWhiteGap = sourceCanvas?.width
          ? Math.max(whiteStopThreshold, Math.round(sourceCanvas.width * 0.085))
          : whiteStopThreshold

        // Si un único polígono abarca dos o más columnas separadas por blanco (ej. "pote ro H以 p"), dividirlo
        if (sourceCanvas && hasInk && segWidth > sourceCanvas.width * 0.32) {
          const subCols = segmentRowIntoInkColumns(
            hasInk,
            sourceCanvas.width,
            Math.max(0, rawBbox.minX - 18),
            Math.min(sourceCanvas.width - 1, rawBbox.maxX + 18),
            splitWhiteGap
          )
          if (subCols.length >= 2) {
            for (const sub of subCols) {
              rawBlocks.push({
                text: '',
                confidence: 0,
                needsBlockOcr: true,
                bbox: {
                  minX: sub.minX,
                  minY: rawBbox.minY,
                  maxX: sub.maxX,
                  maxY: rawBbox.maxY
                }
              })
            }
            return
          }
        }

        const prevSeg = segIdx > 0 ? columnSegments[segIdx - 1] : null
        const nextSeg = segIdx < totalSegs - 1 ? columnSegments[segIdx + 1] : null
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

        rawBlocks.push({
          text: segText,
          confidence: avgConf,
          needsBlockOcr: segText.length < 2,
          bbox
        })
      })
    }
  }

  // Combinar con bloques de tinta detectados en 2D que PaddleOCR omitió (filas cursivas o columnas faltantes)
  if (sourceCanvas) {
    const inkBlocks = detectInkBlocksFromCanvas(sourceCanvas)
    for (const inkBlock of inkBlocks) {
      if (!overlapsExistingBlock(inkBlock, rawBlocks)) {
        rawBlocks.push({
          text: '',
          confidence: 0,
          needsBlockOcr: true,
          bbox: inkBlock
        })
      }
    }
  }

  if (rawBlocks.length === 0) return []

  // Agrupar todos los bloques finales en filas horizontales consistentes (arriba -> abajo, izq -> der)
  const sortedBlocks = rawBlocks
    .map((block) => ({
      ...block,
      centerY: (block.bbox.minY + block.bbox.maxY) / 2,
      height: Math.max(12, block.bbox.maxY - block.bbox.minY)
    }))
    .sort((a, b) => a.centerY - b.centerY)

  const finalRows = []
  let activeRow = [sortedBlocks[0]]

  for (let i = 1; i < sortedBlocks.length; i++) {
    const blk = sortedBlocks[i]
    const avgY = activeRow.reduce((acc, b) => acc + b.centerY, 0) / activeRow.length
    const avgH = activeRow.reduce((acc, b) => acc + b.height, 0) / activeRow.length
    if (Math.abs(blk.centerY - avgY) <= Math.max(14, avgH * 0.65)) {
      activeRow.push(blk)
    } else {
      finalRows.push(activeRow)
      activeRow = [blk]
    }
  }
  if (activeRow.length > 0) {
    finalRows.push(activeRow)
  }

  const richLines = []

  finalRows.forEach((rowBlocks, rowIdx) => {
    rowBlocks.sort((a, b) => a.bbox.minX - b.bbox.minX)
    const totalColsInRow = rowBlocks.length

    rowBlocks.forEach((block, colIdx) => {
      const visualHash = sourceCanvas ? computeBlockVisualSignature(sourceCanvas, block.bbox) : ''
      const cropDataUrl = sourceCanvas
        ? cropLineFromCanvas(sourceCanvas, block.bbox, { maxWidth: 760, maxHeight: 96, quality: 0.82 })
        : null
      const rawStorageUrl = sourceCanvas
        ? cropLineFromCanvas(sourceCanvas, block.bbox, { maxWidth: 420, maxHeight: 52, quality: 0.65 })
        : null
      const cropStorageDataUrl = embedVisualHashInDataUrl(rawStorageUrl, visualHash)

      richLines.push({
        text: block.text,
        confidence: block.confidence,
        bbox: block.bbox,
        rowIndex: rowIdx + 1,
        colIndex: colIdx + 1,
        totalColsInRow,
        needsBlockOcr: block.needsBlockOcr,
        visualHash,
        cropDataUrl,
        cropStorageDataUrl
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
 * Realiza un primer análisis global y una segunda pasada por recorte individual para bloques
 * cursivos o columnas separadas por espacio en blanco.
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

  // 1. Preprocesamiento adaptativo local + escalado mínimo para manuscritos
  if (onProgress) {
    onProgress({
      status: 'preprocessing',
      progress: 0.1,
      percent: 10,
      message: 'Optimizando resolución y contraste local para manuscritos...'
    })
  }

  const preprocessed = await preprocessRecipeImage(imageSource, {
    targetWidth: 1600,
    minWidth: 1200,
    binarize: false
  })

  // 2. Inicializar motor PaddleOCR
  const ocr = await getPaddleOcrInstance(onProgress)

  if (onProgress) {
    onProgress({
      status: 'predicting',
      progress: 0.45,
      percent: 45,
      message: 'Detectando renglones, columnas y trazos cursivos con PaddleOCR...'
    })
  }

  // 3. Primera pasada global con umbrales más sensibles para trazo manuscrito
  const [result] = await ocr.predict(preprocessed.canvas, {
    textDetThresh: 0.18,
    textDetBoxThresh: 0.3,
    textDetUnclipRatio: 1.5,
    textRecScoreThresh: 0.15
  })
  const items = result?.items || []
  const metrics = result?.metrics || {}

  // 4. Agrupar polígonos, separar columnas en blanco y recuperar bloques de tinta omitidos
  const groupedRichLines = groupPaddleItemsIntoRichLines(items, preprocessed.canvas)

  // 5. Segunda pasada individual sobre recortes acolchados (columnas recién separadas o bloques sin texto claro)
  const retryJobs = []
  groupedRichLines.forEach((richLine, idx) => {
    const cleanExisting = cleanRecognizedOcrText(richLine.text)
    if (richLine.needsBlockOcr || cleanExisting.length < 2) {
      const blockCanvas = createPaddedBlockCanvasForOcr(preprocessed.canvas, richLine.bbox)
      if (blockCanvas) {
        retryJobs.push({ idx, blockCanvas })
      }
    }
  })

  if (retryJobs.length > 0) {
    if (onProgress) {
      onProgress({
        status: 'predicting_blocks',
        progress: 0.72,
        percent: 72,
        message: `Releyendo ${retryJobs.length} bloques individuales separados por columna...`
      })
    }

    try {
      const blockResults = await ocr.predict(
        retryJobs.map((j) => j.blockCanvas),
        {
          textDetThresh: 0.15,
          textDetBoxThresh: 0.22,
          textDetUnclipRatio: 1.6,
          textRecScoreThresh: 0.12
        }
      )

      retryJobs.forEach((job, jobPos) => {
        const resItems = blockResults?.[jobPos]?.items || []
        const sortedItems = [...resItems].sort((a, b) => {
          const ax = Array.isArray(a?.poly?.[0]) ? a.poly[0][0] : a?.poly?.[0]?.x || 0
          const bx = Array.isArray(b?.poly?.[0]) ? b.poly[0][0] : b?.poly?.[0]?.x || 0
          return ax - bx
        })

        const joined = cleanRecognizedOcrText(sortedItems.map((it) => it?.text || '').join(' '))
        const avgBlockConf =
          sortedItems.length > 0
            ? Math.round(
                (sortedItems.reduce((acc, it) => acc + (it?.score || 0), 0) / sortedItems.length) * 100
              )
            : 0

        if (joined.length >= 2) {
          groupedRichLines[job.idx].text = joined
          groupedRichLines[job.idx].confidence = avgBlockConf
        }
      })
    } catch (err) {
      console.warn('Segunda pasada por bloque falló parcialmente:', err)
    }
  }

  const candidateRichLines = []
  for (const richLine of groupedRichLines) {
    const cleaned = cleanRecognizedOcrText(richLine.text)
    const effectiveText = cleaned.length >= 2 ? cleaned : richLine.cropDataUrl ? '[Manuscrito a revisar]' : ''
    const cleanText = sanitizeRecipeLine(effectiveText)
    if (cleanText) {
      candidateRichLines.push({
        ...richLine,
        text: cleanText,
        confidence: cleaned.length >= 2 ? richLine.confidence : 0
      })
    }
  }

  const candidateLines = candidateRichLines.map((line) => line.text)
  const groupedLines = groupedRichLines.map((line) => line.text || '[Manuscrito a revisar]')
  const rawText = candidateLines.join('\n')

  // Calcular confianza promedio
  const confList = candidateRichLines.filter((l) => l.confidence > 0).map((l) => l.confidence)
  const avgConfidence =
    confList.length > 0 ? Math.round(confList.reduce((a, b) => a + b, 0) / confList.length) : 0
  const totalMs = Math.round(performance.now() - startTime)

  if (onProgress) {
    onProgress({
      status: 'done',
      progress: 1,
      percent: 100,
      message: `PaddleOCR completó en ${totalMs} ms (${candidateRichLines.length} bloques detectados)`
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
