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
 * Preprocesa una imagen de orden médica para maximizar la legibilidad con Tesseract OCR.
 * Pasos:
 * 1. Escala a una resolución estándar de OCR (máx. 1800px).
 * 2. Conversión a escala de grises ponderada.
 * 3. Expansión del rango dinámico (Auto-contraste / Histogram Stretching).
 * 4. Binarización adaptativa Otsu (texto negro nítido sobre fondo blanco puro).
 *
 * @param {File|Blob|string|HTMLImageElement|HTMLVideoElement} imageSource
 * @param {Object} options
 * @param {number} [options.targetWidth=1600] Ancho máximo recomendado para recetas
 * @param {number} [options.minWidth=1200] Ancho mínimo objetivo (amplía recortes pequeños)
 * @param {boolean} [options.binarize=false] Si se aplica binarización estricta blanco y negro
 * @returns {Promise<{ canvas: HTMLCanvasElement, dataUrl: string, blob: Blob, width: number, height: number, thresholdUsed: number|null }>}
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

  let thresholdUsed = null

  if (binarize) {
    // Modo 1: Binarización estricta Otsu (ideal solo para textos impresos nítidos)
    thresholdUsed = computeOtsuThreshold(grayscale, totalPixels)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const val = grayscale[j] < thresholdUsed ? 0 : 255
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
    }
  } else {
    // Modo 2: Normalización Local Adaptativa de Fondo por Imagen Integral.
    // Remueve sombras, arrugas de papel e iluminación despareja comparando cada píxel contra
    // la media local, blanqueando el fondo (255) y preservando los trazos cursivos oscuros.
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

    const radius = Math.max(16, Math.round(Math.min(width, height) * 0.075))
    const noiseFloor = 7

    for (let y = 0; y < height; y++) {
      const y1 = Math.max(0, y - radius)
      const y2 = Math.min(height - 1, y + radius)
      const r1 = y1 * stride
      const r2 = (y2 + 1) * stride
      const rowOffset = y * width

      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - radius)
        const x2 = Math.min(width - 1, x + radius)
        const count = (x2 - x1 + 1) * (y2 - y1 + 1)
        const sum =
          integral[r2 + x2 + 1] -
          integral[r1 + x2 + 1] -
          integral[r2 + x1] +
          integral[r1 + x1]
        const localMean = sum / count
        const gray = grayscale[rowOffset + x]
        const diff = localMean - gray

        let val = 255
        if (diff > noiseFloor && localMean > 45) {
          const normInk = Math.min(1, (diff - noiseFloor) / Math.max(28, localMean * 0.38))
          val = Math.max(0, Math.round(255 * (1 - Math.pow(normInk, 0.85))))
        } else if (localMean <= 45) {
          val = gray
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

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

  return {
    canvas,
    dataUrl,
    blob,
    width,
    height,
    thresholdUsed
  }
}
