/**
 * Utilidad de Preprocesamiento Óptico en Canvas para Recetas Médicas.
 * Transforma fotografías y escaneos de órdenes médicas (con sombras, papel arrugado o bajo contraste)
 * en imágenes binarizadas de alto contraste optimizadas para reconocimiento con Tesseract.js.
 */

/**
 * Carga una fuente de imagen (File, Blob, string DataURL, Image, Video) en un HTMLImageElement.
 * @param {File|Blob|string|HTMLImageElement|HTMLVideoElement} source
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement && source.complete) {
      resolve(source)
      return
    }

    if (source instanceof HTMLVideoElement) {
      const canvas = document.createElement('canvas')
      canvas.width = source.videoWidth || 1920
      canvas.height = source.videoHeight || 1080
      const ctx = canvas.getContext('2d')
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = (err) => reject(new Error('Error al capturar fotograma de video: ' + err))
      img.src = canvas.toDataURL('image/jpeg', 0.95)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    let objectUrl = null
    if (source instanceof Blob || source instanceof File) {
      objectUrl = URL.createObjectURL(source)
      img.src = objectUrl
    } else if (typeof source === 'string') {
      img.src = source
    } else {
      reject(new Error('Formato de fuente de imagen no compatible.'))
      return
    }

    img.onload = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
      resolve(img)
    }

    img.onerror = (err) => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
      reject(new Error('No se pudo cargar la imagen proporcionada: ' + err))
    }
  })
}

/**
 * Calcula el umbral óptimo de binarización utilizando el método Otsu sobre un histograma en escala de grises.
 * @param {Uint8ClampedArray} grayscaleData
 * @param {number} totalPixels
 * @returns {number} Umbral óptimo entre 0 y 255
 */
function computeOtsuThreshold(grayscaleData, totalPixels) {
  const histogram = new Int32Array(256)
  for (let i = 0; i < totalPixels; i++) {
    histogram[grayscaleData[i]]++
  }

  let sum = 0
  for (let t = 0; t < 256; t++) {
    sum += t * histogram[t]
  }

  let sumB = 0
  let weightB = 0
  let maxVariance = 0
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    weightB += histogram[t]
    if (weightB === 0) continue

    const weightF = totalPixels - weightB
    if (weightF === 0) break

    sumB += t * histogram[t]
    const meanB = sumB / weightB
    const meanF = (sum - sumB) / weightF

    const varianceBetween = weightB * weightF * Math.pow(meanB - meanF, 2)
    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween
      threshold = t
    }
  }

  return threshold
}

/**
 * Calcula la luminancia media rectangular en torno a (x, y) mediante la imagen integral.
 *
 * @param {Float64Array} integral
 * @param {number} stride
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} radiusX
 * @param {number} radiusY
 * @returns {number}
 */
function computeIntegralWindowMean(integral, stride, width, height, x, y, radiusX, radiusY) {
  const x1 = Math.max(0, x - radiusX)
  const x2 = Math.min(width - 1, x + radiusX)
  const y1 = Math.max(0, y - radiusY)
  const y2 = Math.min(height - 1, y + radiusY)
  const count = (x2 - x1 + 1) * (y2 - y1 + 1)
  const sum =
    integral[(y2 + 1) * stride + x2 + 1] -
    integral[y1 * stride + x2 + 1] -
    integral[(y2 + 1) * stride + x1] +
    integral[y1 * stride + x1]
  return sum / Math.max(1, count)
}

/**
 * Detecta los límites verticales [topY, bottomY] de la hoja de papel en fotos de página completa,
 * excluyendo bordes oscuros de mesa, ropa o calzado en la parte superior e inferior sin afectar
 * recortes ceñidos (height < 400).
 *
 * @param {Uint8ClampedArray} grayscale
 * @param {number} width
 * @param {number} height
 * @returns {{ topY: number, bottomY: number }}
 */
export function detectPaperVerticalBoundsFromGrayscale(grayscale, width, height) {
  if (!grayscale || height < 400 || width < 100) {
    return { topY: 0, bottomY: height }
  }

  const startX = Math.floor(width * 0.12)
  const endX = Math.ceil(width * 0.88)
  const spanX = Math.max(1, endX - startX)
  const dark95Frac = new Float32Array(height)
  const rowBrightHalf = new Uint8Array(height)
  const isDarkBg = new Uint8Array(height)

  for (let y = 0; y < height; y++) {
    const rowOff = y * width
    let dark95Count = 0
    let bright150Count = 0
    for (let x = startX; x < endX; x++) {
      const g = grayscale[rowOff + x]
      if (g < 95) dark95Count++
      if (g >= 150) bright150Count++
    }
    const dFrac = dark95Count / spanX
    dark95Frac[y] = dFrac
    rowBrightHalf[y] = bright150Count >= spanX * 0.5 ? 1 : 0
    // dark95 >= 0.5 implies p50 < 95, plus check overall dark background bands
    if (dFrac >= 0.3) {
      isDarkBg[y] = 1
    }
  }

  let topY = 0
  const maxTopScan = Math.floor(height * 0.28)
  let topDarkCount = 0
  let lastTopDark = -1
  for (let y = 0; y < maxTopScan; y++) {
    if (isDarkBg[y]) {
      topDarkCount++
      lastTopDark = y
    }
  }
  if (topDarkCount >= 12 && lastTopDark >= 0) {
    let y = lastTopDark + 1
    const topLimit = Math.min(height, lastTopDark + 60)
    while (y < topLimit) {
      if (rowBrightHalf[y] && dark95Frac[y] < 0.08) {
        break
      }
      y++
    }
    topY = y
  }

  let bottomY = height
  const minBotScan = Math.floor(height * 0.65)
  let botDarkCount = 0
  let firstBotDark = -1
  for (let y = minBotScan; y < height; y++) {
    if (isDarkBg[y]) {
      botDarkCount++
      if (firstBotDark === -1) firstBotDark = y
    }
  }
  if (botDarkCount >= 12 && firstBotDark >= 0) {
    let found = firstBotDark
    let cleanStreak = 0
    const limitY = Math.max(topY + 100, Math.floor(height * 0.55))
    for (let y = firstBotDark; y > limitY; y--) {
      if (dark95Frac[y] < 0.075) {
        cleanStreak++
        if (cleanStreak >= 8) {
          found = y + cleanStreak - 1
          break
        }
      } else {
        cleanStreak = 0
      }
    }
    bottomY = found
  }

  if (bottomY - topY < height * 0.35) {
    return { topY: 0, bottomY: height }
  }

  return { topY, bottomY }
}

/**
 * Preprocesa una imagen de orden médica para maximizar la legibilidad con Tesseract / PaddleOCR.
 * Pasos:
 * 1. Escala a una resolución estándar de OCR (máx. 1600px, mín. 1200px).
 * 2. Conversión a escala de grises ponderada y detección de límites verticales de la hoja.
 * 3. Normalización adaptativa local combinando ventana anisotrópica anti-pliegues + ventana macro.
 *
 * @param {File|Blob|string|HTMLImageElement|HTMLVideoElement} imageSource
 * @param {Object} options
 * @param {number} [options.targetWidth=1600] Ancho máximo recomendado para recetas
 * @param {number} [options.minWidth=1200] Ancho mínimo objetivo (amplía recortes pequeños)
 * @param {boolean} [options.binarize=false] Si se aplica binarización estricta blanco y negro
 * @returns {Promise<{ canvas: HTMLCanvasElement, dataUrl: string, blob: Blob, width: number, height: number, thresholdUsed: number|null, paperBounds: { topY: number, bottomY: number } }>}
 */
export async function preprocessRecipeImage(imageSource, options = {}) {
  const { targetWidth = 1600, minWidth = 1200, binarize = false } = options
  const img = await loadImageElement(imageSource)

  // 1. Escalar preservando aspecto (reduce fotos grandes y amplía recortes chicos para cursiva)
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height

  if (width > targetWidth) {
    const scale = targetWidth / width
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  } else if (width > 0 && width < minWidth) {
    const scale = Math.min(3.5, minWidth / width)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Dibujar imagen original escalada
  ctx.drawImage(img, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const totalPixels = width * height
  const grayscale = new Uint8ClampedArray(totalPixels)

  // 2. Escala de grises (Luminancia ponderada ITU-R BT.601)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    grayscale[j] = gray
  }

  // 2b. Detectar límites verticales de la hoja blanca (`paperBounds`) excluyendo mesas, piso o zapatos oscuros
  const { topY, bottomY } = detectPaperVerticalBoundsFromGrayscale(grayscale, width, height)
  const paperMinY = topY
  const paperMaxY = Math.max(paperMinY, bottomY - 1)

  let thresholdUsed = null

  if (binarize) {
    // Modo 1: Binarización estricta Otsu (ideal solo para textos impresos nítidos)
    thresholdUsed = computeOtsuThreshold(grayscale, totalPixels)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const y = Math.floor(j / width)
      const val = (y < paperMinY || y > paperMaxY)
        ? 255
        : grayscale[j] < thresholdUsed
          ? 0
          : 255
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
    }
  } else {
    // Modo 2: Normalización Local Adaptativa Anisotrópica de Fondo por Imagen Integral.
    // Ventana angosta en X para absorber pliegues horizontales del papel en el canal entre columnas,
    // y más alta en Y para abarcar el cuerpo de las letras cursivas sin ahuecar los trazos.
    const stride = width + 1
    const integral = new Float64Array((height + 1) * stride)

    for (let y = 0; y < height; y++) {
      let rowSum = 0
      const srcRow = y * width
      const dstRow = (y + 1) * stride
      const prevRow = y * stride
      for (let x = 0; x < width; x++) {
        rowSum += grayscale[srcRow + x]
        integral[dstRow + x + 1] = integral[prevRow + x + 1] + rowSum
      }
    }

    const radiusXAniso = Math.max(14, Math.round(width * 0.016))
    const radiusYAniso = Math.max(24, Math.round(height * 0.032))
    const radiusMacro = Math.max(16, Math.round(Math.min(width, height) * 0.075))

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width
      const outsidePaper = y < paperMinY || y > paperMaxY

      for (let x = 0; x < width; x++) {
        let val = 255
        if (!outsidePaper) {
          const meanAniso = computeIntegralWindowMean(
            integral,
            stride,
            width,
            height,
            x,
            y,
            radiusXAniso,
            radiusYAniso
          )
          const meanMacro = computeIntegralWindowMean(
            integral,
            stride,
            width,
            height,
            x,
            y,
            radiusMacro,
            radiusMacro
          )
          const localMean = 0.72 * meanAniso + 0.28 * meanMacro
          const gray = grayscale[rowOffset + x]
          const diff = localMean - gray
          const isShadowZone = localMean < 138
          const adaptiveNoiseFloor = isShadowZone
            ? Math.max(10, Math.min(18, Math.round(localMean * 0.11)))
            : 19
          const adaptiveDivisor = isShadowZone
            ? Math.max(30, localMean * 0.35)
            : Math.max(42, localMean * 0.48)

          if (diff > adaptiveNoiseFloor && localMean > 45) {
            const normInk = Math.min(1, (diff - adaptiveNoiseFloor) / adaptiveDivisor)
            val = Math.max(0, Math.round(255 * (1 - Math.pow(normInk, 1.12))))
          } else if (localMean <= 45) {
            val = gray
          }
        }

        const idx = (rowOffset + x) * 4
        data[idx] = val
        data[idx + 1] = val
        data[idx + 2] = val
        data[idx + 3] = 255
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
  canvas.__paperBounds = { minY: paperMinY, maxY: paperMaxY }

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

  return {
    canvas,
    dataUrl,
    blob,
    width,
    height,
    paperBounds: { minY: paperMinY, maxY: paperMaxY },
    thresholdUsed
  }
}
