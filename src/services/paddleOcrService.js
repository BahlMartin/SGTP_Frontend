/**
 * Servicio OCR en Cliente con PaddleOCR (PP-OCRv5 / ONNX Runtime Web).
 * 
 * Ventajas sobre Tesseract:
 * 1. Detección basada en DBNet: localiza polígonos alrededor de cada palabra,
 *    incluso en fotos inclinadas, con viñeteo de cámara o sellos médicos.
 * 2. Reconocimiento con SVTR: lectura secuencial profunda sin depender de cajas rígidas.
 * 3. Ejecución 100% en el navegador vía WebAssembly / WebGPU sin consumir RAM de Render.
 */
import {
  preprocessRecipeImage,
  detectPaperVerticalBoundsFromGrayscale,
  loadImageElement
} from '../utils/imagePreprocessor'
import { sanitizeRecipeLine } from '../utils/ocrSanitizer'

const ONNX_NOISE_PATTERNS = [
  'onnxruntime',
  '[W:onnxruntime:',
  'CleanUnusedInitializersAndNodeArgs',
  'Removing initializer',
  'p2o.pd_op.full_int_array'
]

/**
 * Silencia advertencias informativas de optimización interna de grafos de ONNX Runtime / Emscripten
 * de forma idempotente antes de que los módulos WASM capturen las referencias de console.*.
 */
function installOnnxConsoleFilter() {
  if (typeof window === 'undefined' || window.__onnx_warn_filtered) {
    return
  }
  window.__onnx_warn_filtered = true

  const shouldFilter = (args) =>
    args.some((arg) => {
      const text =
        typeof arg === 'string'
          ? arg
          : typeof arg?.message === 'string'
            ? arg.message
            : ''
      return Boolean(text) && ONNX_NOISE_PATTERNS.some((pattern) => text.includes(pattern))
    })

  for (const method of ['warn', 'error', 'log', 'info', 'debug']) {
    const originalMethod = console[method]
    if (typeof originalMethod === 'function') {
      console[method] = (...args) => {
        if (shouldFilter(args)) return
        originalMethod.apply(console, args)
      }
    }
  }
}

installOnnxConsoleFilter()

function wrapOrtInferenceSession(InferenceSession) {
  if (!InferenceSession?.create || InferenceSession.create.__onnxLogWrapped) {
    return
  }
  const originalCreate = InferenceSession.create.bind(InferenceSession)
  const wrappedCreate = function (model, byteOffsetOrOptions, byteLength, maybeOptions) {
    if (typeof byteOffsetOrOptions === 'number') {
      const mergedOptions = {
        logSeverityLevel: 3,
        logVerbosityLevel: 0,
        ...(maybeOptions && typeof maybeOptions === 'object' ? maybeOptions : {})
      }
      return originalCreate(model, byteOffsetOrOptions, byteLength, mergedOptions)
    }
    const mergedOptions = {
      logSeverityLevel: 3,
      logVerbosityLevel: 0,
      ...(byteOffsetOrOptions && typeof byteOffsetOrOptions === 'object' ? byteOffsetOrOptions : {})
    }
    return originalCreate(model, mergedOptions)
  }
  wrappedCreate.__onnxLogWrapped = true
  InferenceSession.create = wrappedCreate
}

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

      installOnnxConsoleFilter()

      // Configurar nivel de logs de ONNX Runtime (JS + C++ WASM) para que solo reporte errores críticos
      try {
        const ort = await import('onnxruntime-web')
        if (ort?.env) {
          ort.env.logLevel = 'error'
        }
        if (ort?.env?.wasm) {
          ort.env.wasm.proxy = false
        }
        if (ort?.InferenceSession) {
          wrapOrtInferenceSession(ort.InferenceSession)
        }
        if (ort?.default?.InferenceSession) {
          wrapOrtInferenceSession(ort.default.InferenceSession)
        }
      } catch {}

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
 * Ajusta internamente un bounding box al rectángulo mínimo de píxeles de tinta oscuros
 * para eliminar márgenes blancos variables y estabilizar recortes y huellas visuales.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
 * @param {number} [pad=4]
 * @returns {{ startX: number, startY: number, endX: number, endY: number, cropW: number, cropH: number }|null}
 */
function trimBboxToInkBounds(canvas, bbox, pad = 4) {
  if (!canvas || !bbox || !canvas.width || !canvas.height) return null
  const { minX, minY, maxX, maxY } = bbox
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  const initStartX = Math.max(0, Math.floor(minX - 6))
  const initStartY = Math.max(0, Math.floor(minY - 6))
  const initEndX = Math.min(canvas.width, Math.ceil(maxX + 6))
  const initEndY = Math.min(canvas.height, Math.ceil(maxY + 6))
  const initW = Math.max(1, initEndX - initStartX)
  const initH = Math.max(1, initEndY - initStartY)

  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const { data } = ctx.getImageData(initStartX, initStartY, initW, initH)

    let inkMinX = initW
    let inkMinY = initH
    let inkMaxX = -1
    let inkMaxY = -1
    let inkPixels = 0

    for (let y = 0; y < initH; y++) {
      const rowOff = y * initW
      for (let x = 0; x < initW; x++) {
        const idx = (rowOff + x) * 4
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
        if (lum < 175) {
          inkPixels++
          if (x < inkMinX) inkMinX = x
          if (x > inkMaxX) inkMaxX = x
          if (y < inkMinY) inkMinY = y
          if (y > inkMaxY) inkMaxY = y
        }
      }
    }

    if (inkPixels >= 12 && inkMaxX > inkMinX && inkMaxY > inkMinY) {
      const startX = Math.max(0, initStartX + inkMinX - pad)
      const startY = Math.max(0, initStartY + inkMinY - pad)
      const endX = Math.min(canvas.width, initStartX + inkMaxX + 1 + pad)
      const endY = Math.min(canvas.height, initStartY + inkMaxY + 1 + pad)
      return {
        startX,
        startY,
        endX,
        endY,
        cropW: Math.max(1, endX - startX),
        cropH: Math.max(1, endY - startY)
      }
    }

    return {
      startX: initStartX,
      startY: initStartY,
      endX: initEndX,
      endY: initEndY,
      cropW: initW,
      cropH: initH
    }
  } catch {
    return {
      startX: initStartX,
      startY: initStartY,
      endX: initEndX,
      endY: initEndY,
      cropW: initW,
      cropH: initH
    }
  }
}

/**
 * Calcula una huella visual perceptual compacta (dHash 64 bits + aspecto + mapa 4x4 + perfil asc/desc = 26 hex)
 * de un bloque manuscrito recortado al límite exacto de su tinta para reconocerlo en futuros
 * escaneos aunque el texto OCR sea impreciso.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bbox
 * @returns {string}
 */
export function computeBlockVisualSignature(canvas, bbox) {
  const bounds = trimBboxToInkBounds(canvas, bbox, 4)
  if (!bounds) return ''
  const { startX, startY, cropW, cropH } = bounds

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

    // Mapa morfológico 4x4 (16 bits) de distribución espacial de tinta
    const morphCanvas = document.createElement('canvas')
    morphCanvas.width = 4
    morphCanvas.height = 4
    const morphCtx = morphCanvas.getContext('2d')
    let morphHex = '0000'
    if (morphCtx) {
      morphCtx.fillStyle = '#ffffff'
      morphCtx.fillRect(0, 0, 4, 4)
      morphCtx.drawImage(canvas, startX, startY, cropW, cropH, 0, 0, 4, 4)
      const mData = morphCtx.getImageData(0, 0, 4, 4).data
      const lums = new Float32Array(16)
      let lumSum = 0
      for (let i = 0; i < 16; i++) {
        const off = i * 4
        const l = 0.299 * mData[off] + 0.587 * mData[off + 1] + 0.114 * mData[off + 2]
        lums[i] = l
        lumSum += l
      }
      const meanCellLum = lumSum / 16
      let morphMask = 0
      for (let i = 0; i < 16; i++) {
        morphMask = (morphMask << 1) | (lums[i] < meanCellLum ? 1 : 0)
      }
      morphHex = morphMask.toString(16).padStart(4, '0')
    }

    // Envolvente vertical de ascendentes/descendentes (8 columnas x 2 bits = 16 bits = 4 hex)
    const envCanvas = document.createElement('canvas')
    envCanvas.width = 8
    envCanvas.height = 12
    const envCtx = envCanvas.getContext('2d')
    let envHex = '0000'
    if (envCtx) {
      envCtx.fillStyle = '#ffffff'
      envCtx.fillRect(0, 0, 8, 12)
      envCtx.drawImage(canvas, startX, startY, cropW, cropH, 0, 0, 8, 12)
      const eData = envCtx.getImageData(0, 0, 8, 12).data
      let envMask = 0
      for (let x = 0; x < 8; x++) {
        let hasAscender = false
        for (let y = 0; y < 3; y++) {
          const off = (y * 8 + x) * 4
          const lum = 0.299 * eData[off] + 0.587 * eData[off + 1] + 0.114 * eData[off + 2]
          if (lum < 232) {
            hasAscender = true
            break
          }
        }
        let hasDescender = false
        for (let y = 9; y < 12; y++) {
          const off = (y * 8 + x) * 4
          const lum = 0.299 * eData[off] + 0.587 * eData[off + 1] + 0.114 * eData[off + 2]
          if (lum < 232) {
            hasDescender = true
            break
          }
        }
        envMask = (envMask << 2) | ((hasAscender ? 2 : 0) | (hasDescender ? 1 : 0))
      }
      envHex = envMask.toString(16).padStart(4, '0')
    }

    const aspectBucket = Math.max(1, Math.min(255, Math.round((cropW / cropH) * 16)))
    return hexHash + aspectBucket.toString(16).padStart(2, '0') + morphHex + envHex
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
 * Ignora pliegues horizontales tenues del papel, líneas finas (< 3px) y fondos sólidos negros.
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

  const width = canvas.width
  const cleanMaskObj = canvas.__cleanInkMask
  if (
    cleanMaskObj?.data &&
    cleanMaskObj.width === width &&
    cleanMaskObj.height === canvas.height
  ) {
    const maskData = cleanMaskObj.data
    const hasInk = new Uint8Array(width)
    const maxDarkCols = Math.floor(bandHeight * 0.85)

    for (let x = 0; x < width; x++) {
      let darkCount = 0
      let firstDarkY = -1
      let lastDarkY = -1
      for (let y = bandY1; y < bandY2; y++) {
        if (maskData[y * width + x] > 0) {
          darkCount++
          if (firstDarkY === -1) firstDarkY = y
          lastDarkY = y
        }
      }
      const span = lastDarkY - firstDarkY
      if (darkCount >= 2 && darkCount <= maxDarkCols && span >= 3) {
        hasInk[x] = 1
      }
    }
    return hasInk
  }

  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const { data } = ctx.getImageData(0, bandY1, width, bandHeight)
    const hasInk = new Uint8Array(width)
    const maxDarkCols = Math.floor(bandHeight * 0.78)

    for (let x = 0; x < width; x++) {
      let darkCount = 0
      let firstDarkY = -1
      let lastDarkY = -1
      let minColLum = 255

      for (let y = 0; y < bandHeight; y++) {
        const lum = data[(y * width + x) * 4]
        if (lum < 152 && lum > 8) {
          darkCount++
          if (firstDarkY === -1) firstDarkY = y
          lastDarkY = y
          if (lum < minColLum) minColLum = lum
        }
      }

      const span = lastDarkY - firstDarkY
      if (
        darkCount >= 2 &&
        darkCount <= maxDarkCols &&
        span >= 3 &&
        (minColLum < 138 || span >= 8 || darkCount >= 4)
      ) {
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
 * Valida que un segmento horizontal [minX, maxX] tenga patrón de trazos de escritura
 * (alternancia entre tinta y espacios internos) para evitar que sombras o bordes creen tarjetas falsas.
 *
 * @param {Uint8Array} hasInk
 * @param {number} minX
 * @param {number} maxX
 * @returns {boolean}
 */
function hasLetterStrokePattern(hasInk, minX, maxX) {
  const segW = maxX - minX + 1
  if (!hasInk || segW < 45) return false

  let activeCols = 0
  let transitions = 0
  for (let x = minX; x <= maxX; x++) {
    if (hasInk[x] === 1) activeCols++
    if (x > minX && hasInk[x] !== hasInk[x - 1]) {
      transitions++
    }
  }

  const activeRatio = activeCols / segW
  return transitions >= 12 && activeRatio >= 0.18 && activeRatio <= 0.85
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
        if (blockLastInk - blockStart >= 45 && hasLetterStrokePattern(hasInk, blockStart, blockLastInk)) {
          blocks.push({ minX: blockStart, maxX: blockLastInk })
        }
        inBlock = false
        whiteRun = 0
      }
    }
  }

  if (inBlock && blockLastInk - blockStart >= 45 && hasLetterStrokePattern(hasInk, blockStart, blockLastInk)) {
    blocks.push({ minX: blockStart, maxX: blockLastInk })
  }

  return blocks
}

/**
 * Suavizado 1D por media móvil de ventana `(2 * radius + 1)` en O(n) con bordes acotados.
 *
 * @param {Float32Array} src
 * @param {number} radius
 * @returns {Float32Array}
 */
function smooth1DBoxSame(src, radius) {
  const n = src.length
  const out = new Float32Array(n)
  if (n === 0) return out
  const k = 2 * radius + 1
  const prefix = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i] + src[i]
  }
  for (let i = 0; i < n; i++) {
    const a = i > radius ? i - radius : 0
    const b = i + radius < n ? i + radius : n - 1
    out[i] = (prefix[b + 1] - prefix[a]) / k
  }
  return out
}

/**
 * Detecta un canal vertical central genuino de 2 columnas (Exp C) buscando en `x in 38%..64%`:
 * - Masa mínima de tinta en ambas mitades (`minSide >= paperH * 0.025`).
 * - Corredor silencioso continuo `>= 3%` del ancho (`minVal <= minSide * 0.12`).
 * - `<= 15%` de filas activas con tinta cruzando el centro `[bestX - 8 .. bestX + 8]`.
 * - `>= 30%` de cobertura vertical activa en la mitad izquierda y en la mitad derecha.
 *
 * @param {Uint8Array} inkMask Máscara binaria (0 o 1) de tamaño `width * height`
 * @param {number} width
 * @param {number} height
 * @param {number} [paperMinY=0]
 * @param {number} [paperMaxY=height - 1]
 * @returns {number|null}
 */
export function detectCentralColumnGutter(
  inkMask,
  width,
  height,
  paperMinY = 0,
  paperMaxY = height - 1
) {
  if (!inkMask || width < 120 || height < 40) return null

  const minY = Math.max(0, paperMinY)
  const maxY = Math.min(height - 1, paperMaxY)
  const paperH = Math.max(1, maxY - minY + 1)

  const colProj = new Float32Array(width)
  for (let y = minY; y <= maxY; y++) {
    const rowOff = y * width
    for (let x = 0; x < width; x++) {
      if (inkMask[rowOff + x] > 0) {
        colProj[x]++
      }
    }
  }

  const win = Math.max(8, Math.round(width * 0.012))
  const smooth = smooth1DBoxSame(colProj, win)

  const sMin = Math.round(width * 0.38)
  const sMax = Math.round(width * 0.64)
  if (sMax <= sMin) return null

  let bestX = sMin
  let minVal = smooth[sMin]
  for (let x = sMin + 1; x <= sMax; x++) {
    if (smooth[x] < minVal) {
      minVal = smooth[x]
      bestX = x
    }
  }

  const leftStart = Math.floor(width * 0.05)
  const leftEnd = Math.max(Math.floor(width * 0.06), bestX - Math.floor(width * 0.05))
  let leftPeak = 0
  for (let x = leftStart; x < leftEnd; x++) {
    if (smooth[x] > leftPeak) leftPeak = smooth[x]
  }

  const rightStart = Math.min(width - 2, bestX + Math.floor(width * 0.05))
  const rightEnd = Math.floor(width * 0.95)
  let rightPeak = 0
  for (let x = rightStart; x < rightEnd; x++) {
    if (smooth[x] > rightPeak) rightPeak = smooth[x]
  }

  const minSide = Math.min(leftPeak, rightPeak)
  if (minSide < paperH * 0.025) return null
  if (minVal > minSide * 0.12) return null

  const quietThr = Math.max(2.0, minSide * 0.15)
  let qx1 = bestX
  const qx1Floor = Math.max(0, sMin - 40)
  while (qx1 > qx1Floor && smooth[qx1] <= quietThr) {
    qx1--
  }
  let qx2 = bestX
  const qx2Ceil = Math.min(width - 1, sMax + 40)
  while (qx2 < qx2Ceil && smooth[qx2] <= quietThr) {
    qx2++
  }

  const corridorW = qx2 - qx1
  if (corridorW < width * 0.03) return null

  const leftMarginX = Math.floor(width * 0.04)
  const rightMarginX = Math.floor(width * 0.96)
  const stripStart = Math.max(0, bestX - 8)
  const stripEnd = Math.min(width, bestX + 9)

  let activeRows = 0
  let leftActiveRows = 0
  let rightActiveRows = 0
  let crossingRows = 0

  for (let y = minY; y <= maxY; y++) {
    const rowOff = y * width
    let lSum = 0
    for (let x = leftMarginX; x < qx1; x++) {
      if (inkMask[rowOff + x] > 0) lSum++
    }
    let rSum = 0
    for (let x = qx2; x < rightMarginX; x++) {
      if (inkMask[rowOff + x] > 0) rSum++
    }
    const hasLeft = lSum >= 4
    const hasRight = rSum >= 4
    if (hasLeft) leftActiveRows++
    if (hasRight) rightActiveRows++
    if (hasLeft || hasRight) activeRows++

    for (let x = stripStart; x < stripEnd; x++) {
      if (inkMask[rowOff + x] > 0) {
        crossingRows++
        break
      }
    }
  }

  if (activeRows < 30) return null
  if (crossingRows / activeRows > 0.15) return null
  if (leftActiveRows < activeRows * 0.3 || rightActiveRows < activeRows * 0.3) {
    return null
  }

  return Math.round(0.5 * (qx1 + qx2))
}

/**
 * Segmenta una columna (o la página completa en 1 columna) en bloques horizontales limpios (Exp C):
 * - Divide bandas verticales altas (> max(130, 17% del alto)) por valles locales entre picos de
 *   proyección horizontal suavizada en lugar de descartarlas.
 * - Separa fragmentos alejados horizontalmente por huecos blancos amplios (> 14% del ancho).
 * - Filtra tildes/marcas diminutas sueltas (`bw < 70 && bh < 85`, o `bw < 95 && bw / bh < 1.35`)
 *   conservando siglas reales cortas (CPK, ESD, Urea).
 *
 * @param {Uint8Array} inkMask
 * @param {number} fullWidth
 * @param {number} paperMinY
 * @param {number} paperMaxY
 * @param {number} xStart
 * @param {number} xEnd
 * @returns {Array<{ minX: number, maxX: number, minY: number, maxY: number }>}
 */
export function segmentColumnLinesFromMask(
  inkMask,
  fullWidth,
  paperMinY,
  paperMaxY,
  xStart,
  xEnd
) {
  const colW = xEnd - xStart
  const paperH = Math.max(0, paperMaxY - paperMinY + 1)
  if (!inkMask || colW < 20 || paperH < 20) return []

  const rowProj = new Float32Array(paperH)
  for (let yRel = 0; yRel < paperH; yRel++) {
    const rowOff = (paperMinY + yRel) * fullWidth
    let cnt = 0
    for (let x = xStart; x < xEnd; x++) {
      if (inkMask[rowOff + x] > 0) cnt++
    }
    rowProj[yRel] = cnt
  }

  const smooth = smooth1DBoxSame(rowProj, 3)
  const nz = []
  for (let i = 0; i < paperH; i++) {
    if (smooth[i] > 2.0) nz.push(smooth[i])
  }
  if (nz.length === 0) return []

  nz.sort((a, b) => a - b)
  const p15Idx = Math.floor((nz.length - 1) * 0.15)
  const thresh = Math.max(4.0, nz[p15Idx] * 0.35)

  const rawBands = []
  let y = 0
  while (y < paperH) {
    if (smooth[y] > thresh) {
      const y0 = y
      while (y < paperH && smooth[y] > thresh) {
        y++
      }
      if (y - y0 >= 14) {
        rawBands.push([y0, y])
      }
    } else {
      y++
    }
  }

  // Unir micro-cortes verticales (< 6px) dentro de un mismo renglón si la altura combinada sigue siendo acotada
  const maxMergeH = Math.max(90, Math.floor(paperH * 0.14))
  const merged = []
  for (const [y0, y1] of rawBands) {
    const prev = merged[merged.length - 1]
    if (prev && y0 - prev[1] < 6 && y1 - prev[0] < maxMergeH) {
      prev[1] = y1
    } else {
      merged.push([y0, y1])
    }
  }

  // Dividir bandas altas por valles entre picos locales de proyección horizontal suavizada
  const maxSingleBandH = Math.max(130, Math.round(paperH * 0.17))
  const minPeakDist = Math.max(45, Math.round(paperH * 0.07))
  const lineBands = []

  for (const [y0, y1] of merged) {
    const bh = y1 - y0
    if (bh <= maxSingleBandH) {
      lineBands.push([y0, y1])
      continue
    }

    const sub = smooth.subarray(y0, y1)
    const kS = Math.max(15, Math.min(27, Math.floor(bh / 6) | 1))
    const subS = smooth1DBoxSame(sub, Math.floor(kS / 2))

    let subMax = 0
    for (let i = 0; i < subS.length; i++) {
      if (subS[i] > subMax) subMax = subS[i]
    }
    const pMin = Math.max(12.0, subMax * 0.22)
    const rad = Math.max(12, Math.floor(minPeakDist / 3))
    const peaks = []

    for (let i = 6; i < subS.length - 6; i++) {
      const val = subS[i]
      if (val < pMin) continue
      const wStart = Math.max(0, i - rad)
      const wEnd = Math.min(subS.length - 1, i + rad)
      let localMax = val
      for (let j = wStart; j <= wEnd; j++) {
        if (subS[j] > localMax) {
          localMax = subS[j]
          break
        }
      }
      if (val === localMax) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDist) {
          peaks.push(i)
        } else if (val > subS[peaks[peaks.length - 1]]) {
          peaks[peaks.length - 1] = i
        }
      }
    }

    if (peaks.length <= 1) {
      lineBands.push([y0, y1])
    } else {
      const cuts = [0]
      for (let pi = 0; pi < peaks.length - 1; pi++) {
        const p1 = peaks[pi]
        const p2 = peaks[pi + 1]
        let minIdx = p1
        let minV = subS[p1]
        for (let j = p1 + 1; j <= p2; j++) {
          if (subS[j] < minV) {
            minV = subS[j]
            minIdx = j
          }
        }
        cuts.push(minIdx)
      }
      cuts.push(sub.length)

      for (let ci = 0; ci < cuts.length - 1; ci++) {
        const cy0 = y0 + cuts[ci]
        const cy1 = y0 + cuts[ci + 1]
        if (cy1 - cy0 >= 18) {
          lineBands.push([cy0, cy1])
        }
      }
    }
  }

  const blocks = []
  const colSums = new Int32Array(colW)
  const bigGap = Math.max(60, Math.round(colW * 0.14))

  for (const [ly1, ly2] of lineBands) {
    colSums.fill(0)
    for (let yRel = ly1; yRel < ly2; yRel++) {
      const rowOff = (paperMinY + yRel) * fullWidth
      for (let xRel = 0; xRel < colW; xRel++) {
        if (inkMask[rowOff + xStart + xRel] > 0) {
          colSums[xRel]++
        }
      }
    }

    let firstX = -1
    let lastX = -1
    let activeCols = 0
    for (let xRel = 0; xRel < colW; xRel++) {
      if (colSums[xRel] >= 1) {
        if (firstX === -1) firstX = xRel
        lastX = xRel
        activeCols++
      }
    }
    if (activeCols < 16 || firstX === -1) continue

    const segs = []
    let inSeg = false
    let s0 = 0
    let sLast = 0
    let gap = 0

    for (let xRel = firstX; xRel <= lastX; xRel++) {
      if (colSums[xRel] >= 2) {
        if (!inSeg) {
          inSeg = true
          s0 = xRel
        }
        sLast = xRel
        gap = 0
      } else if (inSeg) {
        gap++
        if (gap >= bigGap) {
          if (sLast - s0 >= 28) {
            segs.push([s0, sLast])
          }
          inSeg = false
          gap = 0
        }
      }
    }
    if (inSeg && sLast - s0 >= 28) {
      segs.push([s0, sLast])
    }
    if (segs.length === 0) {
      segs.push([firstX, lastX])
    }

    for (const [sx1, sx2] of segs) {
      let minX = colW
      let maxX = -1
      let minY = ly2
      let maxY = -1
      let inkPixels = 0

      for (let yRel = ly1; yRel < ly2; yRel++) {
        const rowOff = (paperMinY + yRel) * fullWidth
        for (let xRel = sx1; xRel <= sx2; xRel++) {
          if (inkMask[rowOff + xStart + xRel] > 0) {
            inkPixels++
            if (xRel < minX) minX = xRel
            if (xRel > maxX) maxX = xRel
            if (yRel < minY) minY = yRel
            if (yRel > maxY) maxY = yRel
          }
        }
      }

      if (inkPixels < 25 || maxX < minX || maxY < minY) continue

      const bx1 = xStart + minX
      const bx2 = xStart + maxX + 1
      const by1 = paperMinY + minY
      const by2 = paperMinY + maxY + 1
      const bw = bx2 - bx1
      const bh = by2 - by1

      // Filtrar tildes, rayas o marcas diminutas sueltas (ej. '/' en R3) preservando siglas reales (CPK, ESD, Urea)
      if (bw < 70 && bh < 85) continue
      if (bw < 95 && bw / Math.max(1, bh) < 1.35) continue
      if (bw >= 50 && bh >= 16) {
        blocks.push({
          minX: bx1,
          maxX: bx2,
          minY: by1,
          maxY: by2
        })
      }
    }
  }

  return blocks
}

/**
 * Divide un bloque horizontal que cruza el canal central de 2 columnas en Columna 1 y Columna 2
 * buscando el hueco blanco o mínimo de tinta más limpio cerca de `centralGutterX`.
 *
 * @param {Uint8Array} hasInk
 * @param {{ minX: number, maxX: number }} col
 * @param {number} centralGutterX
 * @param {number} canvasWidth
 * @returns {Array<{ minX: number, maxX: number }>}
 */
function splitBlockAtCentralGutter(hasInk, col, centralGutterX, canvasWidth) {
  if (!hasInk || centralGutterX === null) return [col]
  const crossesCenter =
    col.minX < centralGutterX - canvasWidth * 0.06 &&
    col.maxX > centralGutterX + canvasWidth * 0.06
  if (!crossesCenter) return [col]

  const winStart = Math.max(col.minX + 35, Math.floor(centralGutterX - 55))
  const winEnd = Math.min(col.maxX - 35, Math.ceil(centralGutterX + 55))
  if (winEnd <= winStart) return [col]

  // Buscar la mayor secuencia continua en blanco (hasInk === 0) dentro de la ventana central
  let bestRunLen = 0
  let bestRunCenter = -1
  let curLen = 0
  let curStart = 0

  for (let x = winStart; x <= winEnd; x++) {
    if (hasInk[x] === 0) {
      if (curLen === 0) curStart = x
      curLen++
      if (curLen > bestRunLen) {
        bestRunLen = curLen
        bestRunCenter = Math.round(curStart + curLen / 2)
      }
    } else {
      curLen = 0
    }
  }

  if (bestRunLen < 6 || bestRunCenter === -1) {
    return [col]
  }

  let leftMaxX = bestRunCenter
  while (leftMaxX > col.minX && hasInk[leftMaxX] === 0) {
    leftMaxX--
  }
  let rightMinX = bestRunCenter
  while (rightMinX < col.maxX && hasInk[rightMinX] === 0) {
    rightMinX++
  }

  if (
    hasLetterStrokePattern(hasInk, col.minX, leftMaxX) &&
    hasLetterStrokePattern(hasInk, rightMinX, col.maxX)
  ) {
    return [
      { minX: col.minX, maxX: leftMaxX },
      { minX: rightMinX, maxX: col.maxX }
    ]
  }

  return [col]
}

/**
 * Obtiene los límites verticales [minY, maxY] de la hoja desde los metadatos del preprocesador
 * o calculándolos directamente si el canvas provino sin anotación previa.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @returns {{ minY: number, maxY: number }}
 */
export function detectPaperVerticalBounds(canvas) {
  if (!canvas || !canvas.width || !canvas.height) {
    return { minY: 0, maxY: 0 }
  }
  const height = canvas.height
  if (canvas.__paperBounds) {
    return {
      minY: Math.max(0, canvas.__paperBounds.minY ?? 0),
      maxY: Math.min(height - 1, canvas.__paperBounds.maxY ?? height - 1)
    }
  }

  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return { minY: 0, maxY: height - 1 }
    const { data } = ctx.getImageData(0, 0, canvas.width, height)
    const grayscale = new Uint8ClampedArray(canvas.width * height)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      grayscale[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    }
    const { topY, bottomY } = detectPaperVerticalBoundsFromGrayscale(grayscale, canvas.width, height)
    return { minY: topY, maxY: Math.max(topY, bottomY - 1) }
  } catch {
    return { minY: 0, maxY: height - 1 }
  }
}

/**
 * Analiza la distribución 2D de tinta en el canvas preprocesado (Exp C): reutiliza `canvas.__cleanInkMask`
 * cuando está disponible (con fallback limpio a umbral en escala de grises), detecta el canal central
 * de 2 columnas y segmenta cada columna respetando bandas altas y límites de la hoja.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @returns {{ blocks: Array<{ minX: number, maxX: number, minY: number, maxY: number }>, centralGutterX: number|null, paperBounds: { minY: number, maxY: number } }}
 */
function analyzeCanvasInkLayout(canvas) {
  if (!canvas || !canvas.width || !canvas.height) {
    return { blocks: [], centralGutterX: null, paperBounds: { minY: 0, maxY: 0 } }
  }
  const width = canvas.width
  const height = canvas.height
  const { minY: paperMinY, maxY: paperMaxY } = detectPaperVerticalBounds(canvas)
  const paperH = Math.max(1, paperMaxY - paperMinY + 1)

  try {
    let inkMask = null
    const cleanMaskObj = canvas.__cleanInkMask
    if (
      cleanMaskObj?.data &&
      cleanMaskObj.width === width &&
      cleanMaskObj.height === height
    ) {
      inkMask = cleanMaskObj.data
    } else {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return { blocks: [], centralGutterX: null, paperBounds: { minY: paperMinY, maxY: paperMaxY } }
      }
      const { data } = ctx.getImageData(0, 0, width, height)
      const marginX = Math.max(6, Math.floor(width * 0.015))
      const maxSafeX = width - marginX
      const colDarkTotals = new Int32Array(width)
      const rawMask = new Uint8Array(width * height)

      for (let y = paperMinY; y <= paperMaxY; y++) {
        const rowOff = y * width
        for (let x = marginX; x < maxSafeX; x++) {
          const lum = data[(rowOff + x) * 4]
          if (lum < 152 && lum > 8) {
            rawMask[rowOff + x] = 1
            colDarkTotals[x]++
          }
        }
      }

      const maxColDensity = paperH * 0.28
      for (let y = paperMinY; y <= paperMaxY; y++) {
        const rowOff = y * width
        for (let x = marginX; x < maxSafeX; x++) {
          if (rawMask[rowOff + x] === 1 && colDarkTotals[x] > maxColDensity) {
            rawMask[rowOff + x] = 0
          }
        }
      }
      inkMask = rawMask
    }

    const centralGutterX = detectCentralColumnGutter(inkMask, width, height, paperMinY, paperMaxY)
    let blocks = []
    if (centralGutterX !== null) {
      const leftBlocks = segmentColumnLinesFromMask(inkMask, width, paperMinY, paperMaxY, 0, centralGutterX)
      const rightBlocks = segmentColumnLinesFromMask(inkMask, width, paperMinY, paperMaxY, centralGutterX, width)
      blocks = [...leftBlocks, ...rightBlocks]
    } else {
      blocks = segmentColumnLinesFromMask(inkMask, width, paperMinY, paperMaxY, 0, width)
    }

    return {
      blocks,
      centralGutterX,
      paperBounds: { minY: paperMinY, maxY: paperMaxY }
    }
  } catch (err) {
    console.warn('No se pudo analizar distribución de tinta 2D:', err)
    return { blocks: [], centralGutterX: null, paperBounds: { minY: paperMinY, maxY: paperMaxY } }
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
  const padY = Math.min(10, Math.max(4, Math.round(boxHeight * 0.12)))
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

    if (yOverlap / minH >= 0.35 && yOverlap / inkH >= 0.45 && xOverlap / minW >= 0.35) {
      return true
    }
  }

  return false
}

/**
 * Encuentra todos los bloques 2D de tinta que se solapan espacialmente con un rectángulo dado.
 *
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} rawBbox
 * @param {Array<{ minX: number, minY: number, maxX: number, maxY: number }>} inkBlocks
 * @returns {Array<{ minX: number, minY: number, maxX: number, maxY: number }>}
 */
function findOverlappingInkBlocks(rawBbox, inkBlocks) {
  const rawW = Math.max(1, rawBbox.maxX - rawBbox.minX)
  const rawH = Math.max(1, rawBbox.maxY - rawBbox.minY)

  return inkBlocks.filter((inkBlock) => {
    const inkW = Math.max(1, inkBlock.maxX - inkBlock.minX)
    const inkH = Math.max(1, inkBlock.maxY - inkBlock.minY)
    const yOverlap = Math.max(0, Math.min(inkBlock.maxY, rawBbox.maxY) - Math.max(inkBlock.minY, rawBbox.minY))
    const xOverlap = Math.max(0, Math.min(inkBlock.maxX, rawBbox.maxX) - Math.max(inkBlock.minX, rawBbox.minX))
    const minH = Math.max(1, Math.min(inkH, rawH))
    const minW = Math.max(1, Math.min(inkW, rawW))

    return yOverlap / minH >= 0.35 && xOverlap / minW >= 0.35
  })
}

/**
 * Determina si dos cajas/bloques están apilados verticalmente en la misma columna horizontal,
 * evitando fusionar en un solo renglón palabras escritas una debajo de la otra (ej. proteinuria / albuminuria).
 *
 * @param {{ minX: number, maxX: number, centerY: number, height: number }} a
 * @param {{ minX: number, maxX: number, centerY: number, height: number }} b
 * @returns {boolean}
 */
function areElementsVerticallyStacked(a, b) {
  const xOverlap = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
  const minW = Math.max(1, Math.min(a.maxX - a.minX, b.maxX - b.minX))
  const minH = Math.max(1, Math.min(a.height, b.height))
  return xOverlap / minW >= 0.45 && Math.abs(a.centerY - b.centerY) >= minH * 0.55
}

/**
 * Agrupa ítems de palabras detectadas por PaddleOCR en renglones y columnas enriquecidos,
 * prioriza la segmentación 2D de tinta + canal central de columnas para evitar que bloques
 * parciales absorban dos columnas y calcula el recorte + firma visual de cada bloque.
 *
 * @param {Array<{ poly: Array<[number, number]|{x: number, y: number}>, text: string, score: number }>} items
 * @param {HTMLCanvasElement|null} [sourceCanvas=null]
 * @returns {Array<{ text: string, confidence: number, bbox: Object, rowIndex: number, colIndex: number, totalColsInRow: number, needsBlockOcr: boolean, visualHash: string, cropDataUrl: string|null, cropStorageDataUrl: string|null }>}
 */
export function groupPaddleItemsIntoRichLines(items = [], sourceCanvas = null) {
  const hasItems = Array.isArray(items) && items.length > 0
  if (!hasItems && !sourceCanvas) return []

  const inkLayout = sourceCanvas
    ? analyzeCanvasInkLayout(sourceCanvas)
    : { blocks: [], centralGutterX: null, paperBounds: null }
  const { blocks: inkBlocks, centralGutterX, paperBounds } = inkLayout

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

          if (paperBounds && (centerY < paperBounds.minY || centerY > paperBounds.maxY)) {
            return null
          }

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
      const verticallyStacked = currentLine.some((b) => areElementsVerticallyStacked(box, b))

      if (!verticallyStacked && Math.abs(box.centerY - avgLineY) <= Math.max(12, avgLineH * 0.6)) {
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
        const crossesCentralGutter =
          centralGutterX !== null &&
          segMaxX <= centralGutterX + 12 &&
          box.minX >= centralGutterX - 12 &&
          gapPx >= 12
        const isColumnSplit =
          crossesCentralGutter ||
          (gapPx >= whiteStopThreshold &&
            (!hasInk || hasContinuousWhiteGap(hasInk, segMaxX, box.minX, minWhiteRun)))

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

        // Priorizar bloques 2D independientes si este segmento abarca 2 o más columnas/bandas detectadas
        const matchedInkBlocks = findOverlappingInkBlocks(rawBbox, inkBlocks)
        if (matchedInkBlocks.length >= 2) {
          for (const inkBlk of matchedInkBlocks) {
            const subBoxes = seg.filter((b) => {
              const bCenter = (b.minX + b.maxX) / 2
              const bCenterY = (b.minY + b.maxY) / 2
              const bWidth = b.maxX - b.minX
              const crossesInkCut =
                centralGutterX !== null &&
                b.minX < centralGutterX - 10 &&
                b.maxX > centralGutterX + 10
              return (
                !crossesInkCut &&
                bWidth <= (sourceCanvas?.width || 1200) * 0.45 &&
                bCenter >= inkBlk.minX - 12 &&
                bCenter <= inkBlk.maxX + 12 &&
                bCenterY >= inkBlk.minY - 12 &&
                bCenterY <= inkBlk.maxY + 12
              )
            })
            const subText = subBoxes.map((b) => b.text).filter(Boolean).join(' ').trim()
            const subConf =
              subBoxes.length > 0
                ? Math.round(subBoxes.reduce((acc, b) => acc + b.score, 0) / subBoxes.length)
                : 0
            rawBlocks.push({
              text: subText,
              confidence: subConf,
              needsBlockOcr: true,
              bbox: inkBlk
            })
          }
          return
        }

        const segWidth = rawBbox.maxX - rawBbox.minX
        const splitWhiteGap = sourceCanvas?.width
          ? Math.max(whiteStopThreshold, Math.round(sourceCanvas.width * 0.085))
          : whiteStopThreshold
        const spansCentralGutter =
          sourceCanvas &&
          centralGutterX !== null &&
          rawBbox.minX < centralGutterX - sourceCanvas.width * 0.06 &&
          rawBbox.maxX > centralGutterX + sourceCanvas.width * 0.06

        // Si un único polígono abarca dos o más columnas o cruza el canal central, dividirlo antes de expandir
        if (sourceCanvas && hasInk && (segWidth > sourceCanvas.width * 0.32 || spansCentralGutter)) {
          let subCols = segmentRowIntoInkColumns(
            hasInk,
            sourceCanvas.width,
            Math.max(0, rawBbox.minX - 18),
            Math.min(sourceCanvas.width - 1, rawBbox.maxX + 18),
            splitWhiteGap
          )
          if (subCols.length === 1 && centralGutterX !== null) {
            subCols = splitBlockAtCentralGutter(hasInk, subCols[0], centralGutterX, sourceCanvas.width)
          }
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
        let leftBoundX = prevSeg ? Math.max(...prevSeg.map((b) => b.maxX)) + 8 : 0
        let rightBoundX = nextSeg
          ? Math.min(...nextSeg.map((b) => b.minX)) - 8
          : sourceCanvas?.width || rawBbox.maxX

        // Evitar que la expansión horizontal invada bloques de tinta vecinos o cruce el canal central
        const segH = Math.max(1, rawBbox.maxY - rawBbox.minY)
        for (const inkBlk of inkBlocks) {
          const yOv = Math.max(0, Math.min(inkBlk.maxY, rawBbox.maxY) - Math.max(inkBlk.minY, rawBbox.minY))
          const minH = Math.max(1, Math.min(segH, inkBlk.maxY - inkBlk.minY))
          if (yOv / minH < 0.35) continue

          if (inkBlk.maxX < rawBbox.minX - 10) {
            leftBoundX = Math.max(leftBoundX, inkBlk.maxX + 6)
          } else if (inkBlk.minX > rawBbox.maxX + 10) {
            rightBoundX = Math.min(rightBoundX, inkBlk.minX - 6)
          }
        }

        if (centralGutterX !== null) {
          if (rawBbox.maxX <= centralGutterX + 16) {
            rightBoundX = Math.min(rightBoundX, centralGutterX - 6)
          } else if (rawBbox.minX >= centralGutterX - 16) {
            leftBoundX = Math.max(leftBoundX, centralGutterX + 6)
          }
        }

        let bbox = hasInk
          ? expandSegmentBoundsUntilWhite(
              rawBbox,
              hasInk,
              sourceCanvas.width,
              leftBoundX,
              rightBoundX,
              whiteStopThreshold
            )
          : rawBbox

        const preInkBbox = { ...bbox }
        let fallbackOcrBbox = null

        if (matchedInkBlocks.length === 1) {
          const singleInk = matchedInkBlocks[0]
          const singleH = singleInk.maxY - singleInk.minY
          if (singleH <= segH * 2.2) {
            bbox = {
              ...bbox,
              minY: Math.min(bbox.minY, singleInk.minY),
              maxY: Math.max(bbox.maxY, singleInk.maxY)
            }
          } else if (segH < singleH * 0.75 && singleH <= 140) {
            fallbackOcrBbox = preInkBbox
            bbox = {
              minX: Math.min(bbox.minX, singleInk.minX),
              minY: singleInk.minY,
              maxX: Math.max(bbox.maxX, singleInk.maxX),
              maxY: singleInk.maxY
            }
          }
          if (segH > singleH * 1.28 && singleH >= 20) {
            const vPad = Math.min(8, Math.round(singleH * 0.12))
            bbox = {
              ...bbox,
              minY: Math.max(bbox.minY, singleInk.minY - vPad),
              maxY: Math.min(bbox.maxY, singleInk.maxY + vPad)
            }
          }
        }

        const expandedWidth = bbox.maxX - bbox.minX
        const wasSignificantlyExpanded = expandedWidth > segWidth * 1.25 + 25
        rawBlocks.push({
          text: segText,
          confidence: avgConf,
          needsBlockOcr: segText.length < 2 || avgConf < 78 || wasSignificantlyExpanded,
          bbox,
          fallbackOcrBbox
        })
      })
    }
  }

  // Combinar con bloques de tinta detectados en 2D que PaddleOCR omitió (filas cursivas o columnas faltantes)
  if (sourceCanvas) {
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
    const blkGeom = {
      minX: blk.bbox.minX,
      maxX: blk.bbox.maxX,
      centerY: blk.centerY,
      height: blk.height
    }
    const verticallyStacked = activeRow.some((b) =>
      areElementsVerticallyStacked(blkGeom, {
        minX: b.bbox.minX,
        maxX: b.bbox.maxX,
        centerY: b.centerY,
        height: b.height
      })
    )
    if (!verticallyStacked && Math.abs(blk.centerY - avgY) <= Math.max(14, avgH * 0.65)) {
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
        fallbackOcrBbox: block.fallbackOcrBbox || null,
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
 * Ordena elementos de OCR de izquierda a derecha y extrae texto limpio y confianza promedio.
 *
 * @param {Array} resItems
 * @returns {{ text: string, confidence: number }}
 */
function extractJoinedTextFromOcrItems(resItems = []) {
  const sortedItems = [...resItems].sort((a, b) => {
    const ax = Array.isArray(a?.poly?.[0]) ? a.poly[0][0] : a?.poly?.[0]?.x || 0
    const bx = Array.isArray(b?.poly?.[0]) ? b.poly[0][0] : b?.poly?.[0]?.x || 0
    return ax - bx
  })
  const text = cleanRecognizedOcrText(sortedItems.map((it) => it?.text || '').join(' '))
  const confidence =
    sortedItems.length > 0
      ? Math.round(
          (sortedItems.reduce((acc, it) => acc + (it?.score || 0), 0) / sortedItems.length) * 100
        )
      : 0
  return { text, confidence }
}

/**
 * Extrae el recorte manual seleccionado por Admisión desde un rectángulo normalizado [0..1],
 * calcula su huella visual/recortes y ejecuta reconocimiento PaddleOCR local sobre ese bloque.
 *
 * @param {string|HTMLImageElement|HTMLCanvasElement|Blob|File} imageSource
 * @param {{ x: number, y: number, w: number, h: number }} normalizedRect
 * @returns {Promise<{ text: string, confidence: number, bbox: Object, visualHash: string, cropDataUrl: string|null, cropStorageDataUrl: string|null }>}
 */
export async function recognizeManualCropFromImage(imageSource, normalizedRect) {
  if (!imageSource || !normalizedRect) {
    throw new Error('Debe proporcionar una imagen y un rectángulo de recorte válido.')
  }

  const img = await loadImageElement(imageSource)
  const w = img.naturalWidth || img.width || 0
  const h = img.naturalHeight || img.height || 0
  if (!w || !h) {
    throw new Error('No se pudieron leer las dimensiones de la imagen para recortar.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo de recorte.')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)

  const nx = Math.max(0, Math.min(1, Number(normalizedRect.x) || 0))
  const ny = Math.max(0, Math.min(1, Number(normalizedRect.y) || 0))
  const nw = Math.max(0.01, Math.min(1 - nx, Number(normalizedRect.w) || 0.1))
  const nh = Math.max(0.01, Math.min(1 - ny, Number(normalizedRect.h) || 0.05))

  const minX = Math.max(0, Math.floor(nx * w))
  const minY = Math.max(0, Math.floor(ny * h))
  const maxX = Math.min(w, Math.max(minX + 8, Math.ceil((nx + nw) * w)))
  const maxY = Math.min(h, Math.max(minY + 8, Math.ceil((ny + nh) * h)))
  const bbox = { minX, minY, maxX, maxY }

  const visualHash = computeBlockVisualSignature(canvas, bbox)
  const cropDataUrl = cropLineFromCanvas(canvas, bbox, {
    maxWidth: 760,
    maxHeight: 96,
    quality: 0.82
  })
  const rawStorageUrl = cropLineFromCanvas(canvas, bbox, {
    maxWidth: 420,
    maxHeight: 52,
    quality: 0.65
  })
  const cropStorageDataUrl = embedVisualHashInDataUrl(rawStorageUrl, visualHash)

  let detectedText = ''
  let detectedConf = 0

  try {
    const blockCanvas = createPaddedBlockCanvasForOcr(canvas, bbox)
    if (blockCanvas) {
      const ocr = await getPaddleOcrInstance()
      const blockResults = await ocr.predict([blockCanvas], {
        textDetThresh: 0.2,
        textDetBoxThresh: 0.28,
        textDetUnclipRatio: 1.65,
        textRecScoreThresh: 0.15
      })
      const joinedRes = extractJoinedTextFromOcrItems(blockResults?.[0]?.items || [])
      detectedText = joinedRes.text
      detectedConf = joinedRes.confidence
    }
  } catch (err) {
    console.warn('Reconocimiento PaddleOCR de recorte manual falló parcialmente:', err)
  }

  const effectiveText =
    detectedText.length >= 2
      ? sanitizeRecipeLine(detectedText) || '[Manuscrito a revisar]'
      : '[Manuscrito a revisar]'

  return {
    text: effectiveText,
    confidence: detectedText.length >= 2 ? detectedConf : 0,
    bbox,
    visualHash,
    cropDataUrl,
    cropStorageDataUrl
  }
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

  // 3. Primera pasada global con umbrales equilibrados para manuscritos sin disparar ruido del papel
  const [result] = await ocr.predict(preprocessed.canvas, {
    textDetThresh: 0.25,
    textDetBoxThresh: 0.4,
    textDetUnclipRatio: 1.5,
    textRecScoreThresh: 0.2
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
          textDetThresh: 0.22,
          textDetBoxThresh: 0.32,
          textDetUnclipRatio: 1.6,
          textRecScoreThresh: 0.18
        }
      )

      for (let jobPos = 0; jobPos < retryJobs.length; jobPos++) {
        const job = retryJobs[jobPos]
        const firstPassBlock = extractJoinedTextFromOcrItems(blockResults?.[jobPos]?.items || [])
        let joined = firstPassBlock.text
        let avgBlockConf = firstPassBlock.confidence

        if (joined.length < 2 && groupedRichLines[job.idx].fallbackOcrBbox) {
          const fbCanvas = createPaddedBlockCanvasForOcr(
            preprocessed.canvas,
            groupedRichLines[job.idx].fallbackOcrBbox
          )
          if (fbCanvas) {
            const fbResults = await ocr.predict([fbCanvas], {
              textDetThresh: 0.22,
              textDetBoxThresh: 0.32,
              textDetUnclipRatio: 1.6,
              textRecScoreThresh: 0.18
            })
            const fbPassBlock = extractJoinedTextFromOcrItems(fbResults?.[0]?.items || [])
            joined = fbPassBlock.text
            avgBlockConf = fbPassBlock.confidence
          }
        }

        const existingClean = cleanRecognizedOcrText(groupedRichLines[job.idx].text)
        const existingConf = groupedRichLines[job.idx].confidence || 0
        const wouldTruncateExisting =
          (existingClean.length >= 3 &&
            joined.length < existingClean.length &&
            avgBlockConf < existingConf + 15) ||
          (existingClean.length >= 6 && avgBlockConf < existingConf + 10)
        if (
          joined.length >= 2 &&
          !wouldTruncateExisting &&
          (existingClean.length < 2 ||
            avgBlockConf > existingConf ||
            joined.length > existingClean.length + 2)
        ) {
          groupedRichLines[job.idx].text = joined
          groupedRichLines[job.idx].confidence = avgBlockConf
        }
      }
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
    preprocessedDataUrl: preprocessed.dataUrl,
    preprocessedWidth: preprocessed.width,
    preprocessedHeight: preprocessed.height
  }
}
