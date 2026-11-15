/**
 * Normaliza espacios en los extremos de un renglón de OCR sin filtrar ni recortar su contenido.
 * El descarte o ponderación de encabezados y ruido queda a criterio del personal de admisión
 * (y del aprendizaje registrado en la base de datos).
 *
 * @param {string} rawLine
 * @returns {string|null}
 */
export function sanitizeRecipeLine(rawLine) {
  const trimmed = String(rawLine || '').trim()
  return trimmed.length >= 2 ? trimmed : null
}

/**
 * Conserva todos los renglones detectados por OCR sin aplicar filtros de ruido en el cliente.
 *
 * @param {string[]} rawLines
 * @returns {string[]}
 */
export function sanitizeRecipeLines(rawLines = []) {
  const cleanLines = []

  for (const line of rawLines) {
    const clean = sanitizeRecipeLine(line)
    if (clean) {
      cleanLines.push(clean)
    }
  }

  return cleanLines
}
