/**
 * Utilidad de sanitización y limpieza de líneas de texto extraídas por OCR.
 * Descarta encabezados no médicos, firmas, datos administrativos y ruido de recetarios.
 *
 * @param {string[]} rawLines
 * @returns {string[]} Líneas candidatas a nombres de prácticas o estudios
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
