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
 * @param {number} [options.targetWidth=1600] Ancho objetivo recomendado para recetas
 * @param {boolean} [options.binarize=true] Si se aplica binarización estricta blanco y negro
 * @returns {Promise<{ canvas: HTMLCanvasElement, dataUrl: string, blob: Blob }>}
 */
export async function preprocessRecipeImage(imageSource, options = {}) {
  const { targetWidth = 1600, binarize = false } = options
  const img = await loadImageElement(imageSource)

  // 1. Escalar preservando aspecto
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height

  if (width > targetWidth) {
    const scale = targetWidth / width
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // Dibujar imagen original
  ctx.drawImage(img, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const totalPixels = width * height
  const grayscale = new Uint8ClampedArray(totalPixels)
  const histogram = new Int32Array(256)

  // 2. Escala de grises (Luminancia ponderada ITU-R BT.601) y cálculo de histograma
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    grayscale[j] = gray
    histogram[gray]++
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
    // Modo 2 (Recomendado para recetas y cursiva): Escala de Grises Adaptativa.
    // Utiliza corte por percentiles (2% para tinta oscura, 95% para papel de fondo).
    // Blanquea sombras de papel y fondos sucios pero MANTIENE los trazos continuos
    // del bolígrafo con degradados antialiased, impidiendo que Tesseract descarte las palabras.
    const lowLimit = Math.floor(totalPixels * 0.02)
    const highLimit = Math.floor(totalPixels * 0.95)

    let count = 0
    let pLow = 0
    let pHigh = 255

    for (let t = 0; t < 256; t++) {
      count += histogram[t]
      if (count >= lowLimit && pLow === 0) {
        pLow = t
      }
      if (count >= highLimit) {
        pHigh = t
        break
      }
    }

    if (pHigh <= pLow + 15) {
      pLow = 0
      pHigh = 255
    }

    const range = pHigh - pLow
    const lut = new Uint8ClampedArray(256)
    for (let t = 0; t < 256; t++) {
      if (t <= pLow) {
        lut[t] = 0
      } else if (t >= pHigh) {
        lut[t] = 255
      } else {
        const norm = (t - pLow) / range
        // Curva gamma (1.25) para dar cuerpo a la tinta de bolígrafo tenue
        lut[t] = Math.round(Math.pow(norm, 1.25) * 255)
      }
    }

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const val = lut[grayscale[j]]
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
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
