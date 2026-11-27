/**
 * Utilidad de Preprocesamiento Óptico en Canvas para Recetas Médicas (Pipeline Exp C).
 * Transforma fotografías y escaneos de órdenes médicas (con resaltador flúor, transparencia
 * del reverso, sombras, papel arrugado o inclinación) en imágenes limpias y enderezadas
 * optimizadas para reconocimiento local con PaddleOCR.
 */

const NEON_DILATE_OFFSETS = (() => {
  const offsets = []
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy <= 5) {
        offsets.push([dx, dy])
      }
    }
  }
  return offsets
})()

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
 * Calcula el percentil exacto (interpolación lineal) de un histograma entero de 256 valores.
 * @param {Int32Array} hist
 * @param {number} totalCount
 * @param {number} p Percentil en [0..100]
 * @returns {number}
 */
function percentileFromHistogram256(hist, totalCount, p) {
  if (totalCount <= 0) return 0
  const rank = (p / 100) * (totalCount - 1)
  const lowIdx = Math.floor(rank)
  const highIdx = Math.ceil(rank)
  let acc = 0
  let lowVal = 0
  let highVal = 0
  let foundLow = false

  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (!foundLow && acc > lowIdx) {
      lowVal = v
      foundLow = true
    }
    if (acc > highIdx) {
      highVal = v
      break
    }
  }

  if (lowIdx === highIdx) return lowVal
  const frac = rank - lowIdx
  return lowVal + (highVal - lowVal) * frac
}

/**
 * Paso A (Exp C): Suprime trazos de resaltador fluorescente (verde/amarillo/lima o rosa/magenta)
 * en espacio HSV antes de la conversión a escala de grises, preservando tinta azul y negra oscura.
 *
 * @param {Uint8ClampedArray|Uint8Array} rgbaData Buffer RGBA modificado in-place
 * @param {number} width
 * @param {number} height
 * @returns {{ replacedCount: number, paperRgb: [number, number, number] }}
 */
export function suppressNeonHighlighterRGBA(rgbaData, width, height) {
  const totalPixels = width * height
  if (!rgbaData || totalPixels <= 0) {
    return { replacedCount: 0, paperRgb: [235, 235, 235] }
  }

  const vChannel = new Uint8Array(totalPixels)
  const neonMask = new Uint8Array(totalPixels)
  let anyNeon = false

  for (let j = 0, i = 0; j < totalPixels; j++, i += 4) {
    const r = rgbaData[i]
    const g = rgbaData[i + 1]
    const b = rgbaData[i + 2]

    const max = r >= g ? (r >= b ? r : b) : g >= b ? g : b
    const min = r <= g ? (r <= b ? r : b) : g <= b ? g : b
    vChannel[j] = max

    if (max < 150) continue
    const delta = max - min
    if (delta === 0) continue

    // Saturación en escala [0..255] equivalente a OpenCV S >= 85
    if (delta * 255 < 85 * max) continue

    let hDeg
    if (max === r) {
      hDeg = 60 * ((g - b) / delta)
      if (hDeg < 0) hDeg += 360
    } else if (max === g) {
      hDeg = 60 * ((b - r) / delta + 2)
    } else {
      hDeg = 60 * ((r - g) / delta + 4)
    }

    // Verde/amarillo/lima: H in [40°..196°] (OpenCV 20..98) | Rosa/magenta: H in [290°..356°] (OpenCV 145..178)
    // Birome azul oscura (H ~ 200°..260° y V bajo) queda completamente intacta.
    if ((hDeg >= 40 && hDeg <= 196) || (hDeg >= 290 && hDeg <= 356)) {
      neonMask[j] = 1
      anyNeon = true
    }
  }

  if (!anyNeon) {
    return { replacedCount: 0, paperRgb: [235, 235, 235] }
  }

  // Dilatar máscara flúor con radio 2px (disco 5x5) para capturar halos antialias
  const dilated = new Uint8Array(totalPixels)
  for (let y = 0; y < height; y++) {
    const rowOff = y * width
    for (let x = 0; x < width; x++) {
      if (neonMask[rowOff + x] !== 1) continue
      for (let k = 0; k < NEON_DILATE_OFFSETS.length; k++) {
        const nx = x + NEON_DILATE_OFFSETS[k][0]
        const ny = y + NEON_DILATE_OFFSETS[k][1]
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          dilated[ny * width + nx] = 1
        }
      }
    }
  }

  // Proteger tinta oscura (V < 135) y estimar color mediano del papel en píxeles brillantes sin resaltador
  const histR = new Int32Array(256)
  const histG = new Int32Array(256)
  const histB = new Int32Array(256)
  let brightCount = 0

  for (let j = 0, i = 0; j < totalPixels; j++, i += 4) {
    if (dilated[j] === 1 && vChannel[j] >= 135) {
      // Será reemplazado por el color del papel
      continue
    }
    dilated[j] = 0
    if (vChannel[j] >= 140) {
      histR[rgbaData[i]]++
      histG[rgbaData[i + 1]]++
      histB[rgbaData[i + 2]]++
      brightCount++
    }
  }

  const paperR = brightCount > 0 ? Math.round(percentileFromHistogram256(histR, brightCount, 50)) : 235
  const paperG = brightCount > 0 ? Math.round(percentileFromHistogram256(histG, brightCount, 50)) : 235
  const paperB = brightCount > 0 ? Math.round(percentileFromHistogram256(histB, brightCount, 50)) : 235

  let replacedCount = 0
  for (let j = 0, i = 0; j < totalPixels; j++, i += 4) {
    if (dilated[j] === 1) {
      rgbaData[i] = paperR
      rgbaData[i + 1] = paperG
      rgbaData[i + 2] = paperB
      replacedCount++
    }
  }

  return { replacedCount, paperRgb: [paperR, paperG, paperB] }
}

/**
 * Pasada 1D horizontal O(1)-por-píxel (van Herk / Gil-Werman) para máximo o mínimo deslizante.
 * @param {Uint8Array|Uint8ClampedArray} src
 * @param {Uint8Array} dst
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @param {boolean} isMax
 * @param {Uint8Array} prefixBuf Buffer reutilizable de tamaño >= width
 * @param {Uint8Array} suffixBuf Buffer reutilizable de tamaño >= width
 */
function slidingExtremumHorizontal(src, dst, width, height, radius, isMax, prefixBuf, suffixBuf) {
  if (radius <= 0 || width <= 1) {
    dst.set(src)
    return
  }

  const k = 2 * radius + 1
  const lastBlockStart = Math.floor((width - 1) / k) * k

  for (let y = 0; y < height; y++) {
    const rowOff = y * width

    if (isMax) {
      for (let x = 0; x < width; x++) {
        const v = src[rowOff + x]
        prefixBuf[x] = x % k === 0 ? v : v > prefixBuf[x - 1] ? v : prefixBuf[x - 1]
      }
      for (let x = width - 1; x >= 0; x--) {
        const v = src[rowOff + x]
        suffixBuf[x] =
          x === width - 1 || (x + 1) % k === 0
            ? v
            : v > suffixBuf[x + 1]
              ? v
              : suffixBuf[x + 1]
      }
      for (let x = 0; x < width; x++) {
        const a = x > radius ? x - radius : 0
        const b = x + radius < width ? x + radius : width - 1
        if (a === 0 && b < k) {
          dst[rowOff + x] = prefixBuf[b]
        } else if (b === width - 1 && a >= lastBlockStart) {
          dst[rowOff + x] = suffixBuf[a]
        } else {
          const sa = suffixBuf[a]
          const pb = prefixBuf[b]
          dst[rowOff + x] = sa >= pb ? sa : pb
        }
      }
    } else {
      for (let x = 0; x < width; x++) {
        const v = src[rowOff + x]
        prefixBuf[x] = x % k === 0 ? v : v < prefixBuf[x - 1] ? v : prefixBuf[x - 1]
      }
      for (let x = width - 1; x >= 0; x--) {
        const v = src[rowOff + x]
        suffixBuf[x] =
          x === width - 1 || (x + 1) % k === 0
            ? v
            : v < suffixBuf[x + 1]
              ? v
              : suffixBuf[x + 1]
      }
      for (let x = 0; x < width; x++) {
        const a = x > radius ? x - radius : 0
        const b = x + radius < width ? x + radius : width - 1
        if (a === 0 && b < k) {
          dst[rowOff + x] = prefixBuf[b]
        } else if (b === width - 1 && a >= lastBlockStart) {
          dst[rowOff + x] = suffixBuf[a]
        } else {
          const sa = suffixBuf[a]
          const pb = prefixBuf[b]
          dst[rowOff + x] = sa <= pb ? sa : pb
        }
      }
    }
  }
}

/**
 * Pasada 1D vertical O(1)-por-píxel (van Herk / Gil-Werman) con acceso secuencial por filas (L1-friendly).
 * @param {Uint8Array} src
 * @param {Uint8Array} dst
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @param {boolean} isMax
 * @param {Uint8Array} prefixImg Buffer reutilizable de tamaño width * height
 * @param {Uint8Array} suffixImg Buffer reutilizable de tamaño width * height
 */
function slidingExtremumVertical(src, dst, width, height, radius, isMax, prefixImg, suffixImg) {
  if (radius <= 0 || height <= 1) {
    dst.set(src)
    return
  }

  const k = 2 * radius + 1
  const lastBlockStart = Math.floor((height - 1) / k) * k

  if (isMax) {
    for (let y = 0; y < height; y++) {
      const rowOff = y * width
      if (y % k === 0) {
        prefixImg.set(src.subarray(rowOff, rowOff + width), rowOff)
      } else {
        const prevOff = rowOff - width
        for (let x = 0; x < width; x++) {
          const v = src[rowOff + x]
          const p = prefixImg[prevOff + x]
          prefixImg[rowOff + x] = v >= p ? v : p
        }
      }
    }
    for (let y = height - 1; y >= 0; y--) {
      const rowOff = y * width
      if (y === height - 1 || (y + 1) % k === 0) {
        suffixImg.set(src.subarray(rowOff, rowOff + width), rowOff)
      } else {
        const nextOff = rowOff + width
        for (let x = 0; x < width; x++) {
          const v = src[rowOff + x]
          const s = suffixImg[nextOff + x]
          suffixImg[rowOff + x] = v >= s ? v : s
        }
      }
    }
    for (let y = 0; y < height; y++) {
      const a = y > radius ? y - radius : 0
      const b = y + radius < height ? y + radius : height - 1
      const dstOff = y * width
      if (a === 0 && b < k) {
        const bOff = b * width
        dst.set(prefixImg.subarray(bOff, bOff + width), dstOff)
      } else if (b === height - 1 && a >= lastBlockStart) {
        const aOff = a * width
        dst.set(suffixImg.subarray(aOff, aOff + width), dstOff)
      } else {
        const aOff = a * width
        const bOff = b * width
        for (let x = 0; x < width; x++) {
          const sa = suffixImg[aOff + x]
          const pb = prefixImg[bOff + x]
          dst[dstOff + x] = sa >= pb ? sa : pb
        }
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      const rowOff = y * width
      if (y % k === 0) {
        prefixImg.set(src.subarray(rowOff, rowOff + width), rowOff)
      } else {
        const prevOff = rowOff - width
        for (let x = 0; x < width; x++) {
          const v = src[rowOff + x]
          const p = prefixImg[prevOff + x]
          prefixImg[rowOff + x] = v <= p ? v : p
        }
      }
    }
    for (let y = height - 1; y >= 0; y--) {
      const rowOff = y * width
      if (y === height - 1 || (y + 1) % k === 0) {
        suffixImg.set(src.subarray(rowOff, rowOff + width), rowOff)
      } else {
        const nextOff = rowOff + width
        for (let x = 0; x < width; x++) {
          const v = src[rowOff + x]
          const s = suffixImg[nextOff + x]
          suffixImg[rowOff + x] = v <= s ? v : s
        }
      }
    }
    for (let y = 0; y < height; y++) {
      const a = y > radius ? y - radius : 0
      const b = y + radius < height ? y + radius : height - 1
      const dstOff = y * width
      if (a === 0 && b < k) {
        const bOff = b * width
        dst.set(prefixImg.subarray(bOff, bOff + width), dstOff)
      } else if (b === height - 1 && a >= lastBlockStart) {
        const aOff = a * width
        dst.set(suffixImg.subarray(aOff, aOff + width), dstOff)
      } else {
        const aOff = a * width
        const bOff = b * width
        for (let x = 0; x < width; x++) {
          const sa = suffixImg[aOff + x]
          const pb = prefixImg[bOff + x]
          dst[dstOff + x] = sa <= pb ? sa : pb
        }
      }
    }
  }
}

/**
 * Paso B (Exp C): Cierre morfológico separable rápido (dilatación max + erosión min, ventana 2r+1 x 2r+1)
 * para estimar el fondo local del papel eliminando transparencia del reverso y sombras.
 *
 * @param {Uint8ClampedArray|Uint8Array} gray
 * @param {number} width
 * @param {number} height
 * @param {number} [radius=12]
 * @returns {Uint8Array}
 */
export function morphologicalClosingGray(gray, width, height, radius = 12) {
  const totalPixels = width * height
  const tmp1 = new Uint8Array(totalPixels)
  const tmp2 = new Uint8Array(totalPixels)
  const prefixRow = new Uint8Array(width)
  const suffixRow = new Uint8Array(width)
  const prefixImg = new Uint8Array(totalPixels)
  const suffixImg = new Uint8Array(totalPixels)

  // Dilatación (max horizontal -> max vertical)
  slidingExtremumHorizontal(gray, tmp1, width, height, radius, true, prefixRow, suffixRow)
  slidingExtremumVertical(tmp1, tmp2, width, height, radius, true, prefixImg, suffixImg)

  // Erosión (min horizontal -> min vertical)
  slidingExtremumHorizontal(tmp2, tmp1, width, height, radius, false, prefixRow, suffixRow)
  slidingExtremumVertical(tmp1, tmp2, width, height, radius, false, prefixImg, suffixImg)

  return tmp2
}

/**
 * Paso B2 (Exp C): Calcula `cleanGray` a partir de la sustracción morfológica `bg - gray`,
 * normalización adaptativa basada en p99 y recorte de márgenes fuera del papel.
 *
 * @param {Uint8ClampedArray|Uint8Array} gray
 * @param {Uint8Array} bg
 * @param {number} width
 * @param {number} height
 * @param {number} [paperMinY=0]
 * @param {number} [paperMaxY=height - 1]
 * @returns {{ cleanGray: Uint8ClampedArray, p99: number, noiseFloor: number, maxResp: number }}
 */
export function computeCleanGrayFromClosing(
  gray,
  bg,
  width,
  height,
  paperMinY = 0,
  paperMaxY = height - 1
) {
  const totalPixels = width * height
  const strokeResp = new Uint8Array(totalPixels)
  const hist = new Int32Array(256)
  let paperPixelCount = 0

  const minY = Math.max(0, paperMinY)
  const maxY = Math.min(height - 1, paperMaxY)
  const bx = Math.max(6, Math.floor(width * 0.015))
  const maxSafeX = Math.max(bx, width - bx)

  for (let y = minY; y <= maxY; y++) {
    const rowOff = y * width
    for (let x = 0; x < width; x++) {
      const idx = rowOff + x
      const diff = bg[idx] > gray[idx] ? bg[idx] - gray[idx] : 0
      strokeResp[idx] = diff
      hist[diff]++
      paperPixelCount++
    }
  }

  const p99 = percentileFromHistogram256(hist, paperPixelCount, 99.0)
  const noiseFloor = Math.max(24, Math.min(42, p99 * 0.23))
  const maxResp = Math.max(noiseFloor + 30, p99 * 0.95)
  const denom = Math.max(1e-6, maxResp - noiseFloor)

  const respToGray = new Uint8Array(256)
  for (let r = 0; r < 256; r++) {
    if (r <= noiseFloor) {
      respToGray[r] = 255
    } else {
      const norm = Math.min(1, (r - noiseFloor) / denom)
      respToGray[r] = Math.max(0, Math.min(255, Math.round(255 * (1 - Math.pow(norm, 0.92)))))
    }
  }

  const cleanGray = new Uint8ClampedArray(totalPixels)
  cleanGray.fill(255)

  for (let y = minY; y <= maxY; y++) {
    const rowOff = y * width
    for (let x = bx; x < maxSafeX; x++) {
      const idx = rowOff + x
      cleanGray[idx] = respToGray[strokeResp[idx]]
    }
  }

  return { cleanGray, p99, noiseFloor, maxResp }
}

/**
 * Paso C (Exp C): Construye una máscara binaria limpia (`cleanInk`) mediante componentes 8-conectadas,
 * eliminando motas (<12px), líneas verticales de borde de página y manchas sólidas en los márgenes,
 * mientras excluye óvalos/corchetes gigantes del margen derecho SOLO de la máscara de segmentación
 * sin borrarlos de `cleanGray`.
 *
 * @param {Uint8ClampedArray} cleanGray Modificado in-place para limpiar motas/bordes/dedos
 * @param {number} width
 * @param {number} height
 * @param {number} [paperMinY=0]
 * @param {number} [paperMaxY=height - 1]
 * @returns {Uint8Array} Máscara binaria `cleanInk` (0 o 1)
 */
export function cleanInkMaskAndGray(
  cleanGray,
  width,
  height,
  paperMinY = 0,
  paperMaxY = height - 1
) {
  const totalPixels = width * height
  const bx = Math.max(6, Math.floor(width * 0.015))
  const by = Math.max(6, Math.floor(height * 0.01))
  const yStart = Math.max(by, paperMinY)
  const yEnd = Math.min(height - 1 - by, paperMaxY)
  const xEnd = width - bx

  const rawInk = new Uint8Array(totalPixels)
  let inkCount = 0

  for (let y = yStart; y <= yEnd; y++) {
    const rowOff = y * width
    for (let x = bx; x < xEnd; x++) {
      const idx = rowOff + x
      if (cleanGray[idx] < 192) {
        rawInk[idx] = 1
        inkCount++
      }
    }
  }

  const cleanInk = new Uint8Array(totalPixels)
  if (inkCount === 0) {
    return cleanInk
  }

  const labels = new Int32Array(totalPixels)
  const stack = new Int32Array(inkCount)
  // Acciones por etiqueta: 0 = borrar de máscara y cleanGray, 1 = conservar en ambos, 2 = omitir solo de máscara
  let actionsCap = 4096
  let labelActions = new Uint8Array(actionsCap)
  let currentLabel = 0

  const tallRuleH = height * 0.4
  const thinRuleW = width * 0.035
  const maxBlobW = width * 0.14
  const minBlobH = height * 0.08
  const giantOvalH = height * 0.38
  const rightMarginX = width * 0.6

  for (let y = yStart; y <= yEnd; y++) {
    const rowOff = y * width
    for (let x = bx; x < xEnd; x++) {
      const startIdx = rowOff + x
      if (rawInk[startIdx] !== 1 || labels[startIdx] !== 0) continue

      currentLabel++
      if (currentLabel >= actionsCap) {
        actionsCap *= 2
        const grown = new Uint8Array(actionsCap)
        grown.set(labelActions)
        labelActions = grown
      }

      let sp = 0
      stack[sp++] = startIdx
      labels[startIdx] = currentLabel

      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let area = 0

      while (sp > 0) {
        const cur = stack[--sp]
        area++
        const cy = (cur / width) | 0
        const cx = cur - cy * width

        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        const nyMin = cy > yStart ? cy - 1 : yStart
        const nyMax = cy < yEnd ? cy + 1 : yEnd
        const nxMin = cx > bx ? cx - 1 : bx
        const nxMax = cx < xEnd - 1 ? cx + 1 : xEnd - 1

        for (let ny = nyMin; ny <= nyMax; ny++) {
          const nRowOff = ny * width
          for (let nx = nxMin; nx <= nxMax; nx++) {
            const nIdx = nRowOff + nx
            if (rawInk[nIdx] === 1 && labels[nIdx] === 0) {
              labels[nIdx] = currentLabel
              stack[sp++] = nIdx
            }
          }
        }
      }

      const cw = maxX - minX + 1
      const ch = maxY - minY + 1
      const fillRatio = area / Math.max(1, cw * ch)
      const touchesLR = minX <= bx + 4 || maxX >= width - bx - 5

      if (area < 12) {
        labelActions[currentLabel] = 0
      } else if (ch > tallRuleH && cw < thinRuleW) {
        labelActions[currentLabel] = 0
      } else if (touchesLR && fillRatio > 0.48 && cw < maxBlobW && ch > minBlobH) {
        labelActions[currentLabel] = 0
      } else if (ch > giantOvalH && fillRatio < 0.1 && minX > rightMarginX) {
        // Excluir óvalos/corchetes gigantes del margen derecho SOLO de la máscara de segmentación
        labelActions[currentLabel] = 2
      } else {
        labelActions[currentLabel] = 1
      }
    }
  }

  for (let y = yStart; y <= yEnd; y++) {
    const rowOff = y * width
    for (let x = bx; x < xEnd; x++) {
      const idx = rowOff + x
      const lbl = labels[idx]
      if (lbl === 0) continue
      const act = labelActions[lbl]
      if (act === 0) {
        cleanGray[idx] = 255
      } else if (act === 1) {
        cleanInk[idx] = 1
      }
    }
  }

  // Asegurar márgenes exteriores limpios en cleanGray
  for (let y = 0; y < height; y++) {
    const rowOff = y * width
    for (let x = 0; x < bx; x++) {
      cleanGray[rowOff + x] = 255
    }
    for (let x = xEnd; x < width; x++) {
      cleanGray[rowOff + x] = 255
    }
  }

  return cleanInk
}

/**
 * Paso D (Exp C): Estima el ángulo de inclinación de la receta mediante perfil de proyección
 * horizontal rápido sobre puntos de tinta submuestreados (~480px de ancho), con guarda estadística
 * (|ángulo| >= 1.25° y mejora >= +8% respecto a 0°).
 *
 * Convención de signo (idéntica a OpenCV `getRotationMatrix2D`):
 *   - ángulo positivo = rotación antihoraria (CCW)
 *   - ángulo negativo = rotación horaria (CW)
 *   Para aplicar en HTML5 Canvas 2D: `ctx.rotate((-angle * Math.PI) / 180)`.
 *
 * @param {Uint8Array} cleanInk Máscara binaria (0 o 1)
 * @param {number} width
 * @param {number} height
 * @returns {{ angle: number, bestAngle: number, shouldRotate: boolean, bestScore: number, zeroScore: number }}
 */
export function estimateDeskewAngle(cleanInk, width, height) {
  if (!cleanInk || width < 40 || height < 40) {
    return { angle: 0, bestAngle: 0, shouldRotate: false, bestScore: 0, zeroScore: 0 }
  }

  const smallW = Math.min(480, width)
  const sc = smallW / width
  const smallH = Math.max(1, Math.round(height * sc))
  const binCounts = new Uint16Array(smallW * smallH)

  for (let y = 0; y < height; y++) {
    const sy = Math.min(smallH - 1, Math.floor(y * sc))
    const srcRow = y * width
    const dstRow = sy * smallW
    for (let x = 0; x < width; x++) {
      if (cleanInk[srcRow + x] > 0) {
        const sx = Math.min(smallW - 1, Math.floor(x * sc))
        binCounts[dstRow + sx]++
      }
    }
  }

  const invArea = (1 / sc) * (1 / sc)
  const minBinHits = Math.max(1, Math.floor(invArea * 0.1))
  let smallInkTotal = 0
  for (let i = 0; i < binCounts.length; i++) {
    if (binCounts[i] >= minBinHits) smallInkTotal++
  }

  if (smallInkTotal < 50) {
    return { angle: 0, bestAngle: 0, shouldRotate: false, bestScore: 0, zeroScore: 0 }
  }

  const maxPoints = 22000
  const stride = smallInkTotal > maxPoints ? Math.ceil(smallInkTotal / maxPoints) : 1
  const estPts = Math.ceil(smallInkTotal / stride)
  const ptsX = new Float32Array(estPts)
  const ptsY = new Float32Array(estPts)
  const cx = smallW / 2
  const cy = smallH / 2

  let ptCount = 0
  let seen = 0
  for (let sy = 0; sy < smallH; sy++) {
    const rowOff = sy * smallW
    for (let sx = 0; sx < smallW; sx++) {
      if (binCounts[rowOff + sx] >= minBinHits) {
        if (seen % stride === 0 && ptCount < estPts) {
          ptsX[ptCount] = sx - cx
          ptsY[ptCount] = sy - cy
          ptCount++
        }
        seen++
      }
    }
  }

  const proj = new Float64Array(smallH)
  const degToRad = Math.PI / 180

  const scoreAngle = (angDeg) => {
    proj.fill(0)
    const rad = angDeg * degToRad
    const cosA = Math.cos(rad)
    const sinA = Math.sin(rad)

    for (let i = 0; i < ptCount; i++) {
      const ry = Math.round(-sinA * ptsX[i] + cosA * ptsY[i] + cy)
      if (ry >= 0 && ry < smallH) {
        proj[ry] += 1
      }
    }

    let sum = 0
    for (let y = 0; y < smallH; y++) {
      sum += proj[y]
    }
    const mean = sum / smallH

    let varSum = 0
    let gradSqSum = 0
    for (let y = 0; y < smallH; y++) {
      const d = proj[y] - mean
      varSum += d * d
      if (y > 0) {
        const g = proj[y] - proj[y - 1]
        gradSqSum += g * g
      }
    }

    const variance = varSum / smallH
    const gradMeanSq = smallH > 1 ? gradSqSum / (smallH - 1) : 0
    return variance + 0.5 * gradMeanSq
  }

  const zeroScore = scoreAngle(0)
  let bestAng = 0
  let bestScore = zeroScore

  for (let ang = -15; ang <= 15; ang += 1) {
    const scVal = scoreAngle(ang)
    if (scVal > bestScore) {
      bestScore = scVal
      bestAng = ang
    }
  }

  const fineStart = bestAng - 1.5
  const fineEnd = bestAng + 1.5
  for (let ang = fineStart; ang <= fineEnd + 1e-6; ang += 0.25) {
    const roundedAng = Math.round(ang * 100) / 100
    const scVal = scoreAngle(roundedAng)
    if (scVal > bestScore) {
      bestScore = scVal
      bestAng = roundedAng
    }
  }

  const shouldRotate = Math.abs(bestAng) >= 1.25 && zeroScore > 0 && bestScore >= zeroScore * 1.08

  return {
    angle: shouldRotate ? bestAng : 0,
    bestAngle: bestAng,
    shouldRotate,
    bestScore,
    zeroScore
  }
}

/**
 * Rota una máscara binaria (0 o 1) por vecino más cercano usando la misma convención
 * antihoraria (CCW) que `estimateDeskewAngle` y la transformación equivalente de Canvas.
 *
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} angleDeg
 * @returns {Uint8Array}
 */
export function rotateBinaryMaskNearest(mask, width, height, angleDeg) {
  const out = new Uint8Array(width * height)
  if (!mask || Math.abs(angleDeg) < 1e-4) {
    if (mask) out.set(mask)
    return out
  }

  const rad = (angleDeg * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)
  const cx = width / 2
  const cy = height / 2

  for (let y = 0; y < height; y++) {
    const ody = y - cy
    const baseSrcX = -sinA * ody + cx
    const baseSrcY = cosA * ody + cy
    const dstRow = y * width

    for (let x = 0; x < width; x++) {
      const odx = x - cx
      const srcX = Math.round(cosA * odx + baseSrcX)
      const srcY = Math.round(sinA * odx + baseSrcY)
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        out[dstRow + x] = mask[srcY * width + srcX]
      }
    }
  }

  return out
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
 * Preprocesa una imagen de orden médica para maximizar la legibilidad con PaddleOCR (Pipeline Exp C).
 * Pasos (binarize=false):
 * 1. Escala a una resolución estándar de OCR (máx. 1600px, mín. 1200px).
 * 2. Supresión HSV de resaltador fluorescente (preservando birome azul y tinta oscura).
 * 3. Escala de grises ponderada + detección de límites verticales de la hoja (`paperBounds`).
 * 4. Sustracción morfológica separable de fondo (cierre 25x25 O(1)/px) + normalización p99.
 * 5. Limpieza de artefactos por componentes 8-conectadas y generación de máscara limpia (`__cleanInkMask`).
 * 6. Deskew automático por perfil de proyección con guarda estadística (±15°, |ang|>=1.25°, +8%).
 *
 * @param {File|Blob|string|HTMLImageElement|HTMLVideoElement} imageSource
 * @param {Object} options
 * @param {number} [options.targetWidth=1600] Ancho máximo recomendado para recetas
 * @param {number} [options.minWidth=1200] Ancho mínimo objetivo (amplía recortes pequeños)
 * @param {boolean} [options.binarize=false] Si se aplica binarización estricta blanco y negro
 * @returns {Promise<{ canvas: HTMLCanvasElement, dataUrl: string, blob: Blob, width: number, height: number, thresholdUsed: number|null, paperBounds: { minY: number, maxY: number }, deskewAngle: number }>}
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

  let outCanvas = document.createElement('canvas')
  outCanvas.width = width
  outCanvas.height = height
  const ctx = outCanvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Dibujar imagen original escalada
  ctx.drawImage(img, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const totalPixels = width * height

  // Paso A (Exp C): Supresión de resaltador fluorescente en HSV antes de pasar a grises
  if (!binarize) {
    suppressNeonHighlighterRGBA(data, width, height)
  }

  // 2. Escala de grises (Luminancia ponderada ITU-R BT.601)
  const grayscale = new Uint8ClampedArray(totalPixels)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    grayscale[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }

  // 2b. Detectar límites verticales de la hoja blanca (`paperBounds`) excluyendo mesas, piso o zapatos oscuros
  const { topY, bottomY } = detectPaperVerticalBoundsFromGrayscale(grayscale, width, height)
  const paperMinY = topY
  const paperMaxY = Math.max(paperMinY, bottomY - 1)

  let thresholdUsed = null
  let appliedAngle = 0
  let finalInkMask = null

  if (binarize) {
    // Modo 1: Binarización estricta Otsu (ideal solo para textos impresos nítidos)
    thresholdUsed = computeOtsuThreshold(grayscale, totalPixels)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const y = (j / width) | 0
      const val =
        y < paperMinY || y > paperMaxY ? 255 : grayscale[j] < thresholdUsed ? 0 : 255
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
  } else {
    // Modo 2 (Exp C): Cierre morfológico separable (25x25, r=12) + limpieza de artefactos + deskew guardado
    const bg = morphologicalClosingGray(grayscale, width, height, 12)
    const { cleanGray } = computeCleanGrayFromClosing(
      grayscale,
      bg,
      width,
      height,
      paperMinY,
      paperMaxY
    )

    // Paso C: Máscara binaria limpia y supresión de motas/reglas verticales/manchas de borde
    const cleanInk = cleanInkMaskAndGray(cleanGray, width, height, paperMinY, paperMaxY)

    for (let j = 0, i = 0; j < totalPixels; j++, i += 4) {
      const val = cleanGray[j]
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)

    // Paso D: Deskew con guarda estadística
    const deskew = estimateDeskewAngle(cleanInk, width, height)
    if (deskew.shouldRotate) {
      appliedAngle = deskew.angle
      const rotCanvas = document.createElement('canvas')
      rotCanvas.width = width
      rotCanvas.height = height
      const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true })
      if (rotCtx) {
        rotCtx.imageSmoothingEnabled = true
        rotCtx.imageSmoothingQuality = 'high'
        rotCtx.fillStyle = '#ffffff'
        rotCtx.fillRect(0, 0, width, height)
        rotCtx.translate(width / 2, height / 2)
        rotCtx.rotate((-appliedAngle * Math.PI) / 180)
        rotCtx.translate(-width / 2, -height / 2)
        rotCtx.drawImage(outCanvas, 0, 0)
        outCanvas = rotCanvas
        finalInkMask = rotateBinaryMaskNearest(cleanInk, width, height, appliedAngle)
      } else {
        appliedAngle = 0
        finalInkMask = cleanInk
      }
    } else {
      finalInkMask = cleanInk
    }
  }

  outCanvas.__paperBounds = { minY: paperMinY, maxY: paperMaxY }
  outCanvas.__cleanInkMask = finalInkMask ? { data: finalInkMask, width, height } : null
  outCanvas.__deskewAngle = appliedAngle

  const dataUrl = outCanvas.toDataURL('image/png')
  const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, 'image/png'))

  return {
    canvas: outCanvas,
    dataUrl,
    blob,
    width,
    height,
    paperBounds: { minY: paperMinY, maxY: paperMaxY },
    thresholdUsed,
    deskewAngle: appliedAngle
  }
}
