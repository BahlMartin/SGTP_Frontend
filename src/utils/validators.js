/**
 * Valida nombres y apellidos sanitarios:
 * - Mínimo 2 caracteres
 * - Solo caracteres alfabéticos, espacios y tildes (sin números ni símbolos especiales)
 */
export function validatePersonName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'El campo es obligatorio.' }
  }
  const trimmed = name.trim()
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Debe contener al menos 2 caracteres.' }
  }
  // Expresión regular que admite letras latinas, tildes, diéresis y espacios
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/
  if (!nameRegex.test(trimmed)) {
    return { isValid: false, error: 'No se permiten números ni caracteres especiales.' }
  }
  return { isValid: true, error: null }
}

/**
 * Valida DNI: numérico, entre 6 y 9 dígitos
 */
export function validateDni(dni) {
  if (!dni) return { isValid: false, error: 'El DNI es obligatorio.' }
  const clean = String(dni).trim()
  if (!/^\d{6,9}$/.test(clean)) {
    return { isValid: false, error: 'El DNI debe contener entre 6 y 9 dígitos numéricos.' }
  }
  return { isValid: true, error: null }
}

/**
 * Valida ventana inmutable de 24 horas desde la emisión del ticket
 */
export function isWithin24HourWindow(fechaEmision) {
  if (!fechaEmision) return false
  const emisionTime = new Date(fechaEmision).getTime()
  const now = new Date().getTime()
  const hoursDiff = (now - emisionTime) / (1000 * 60 * 60)
  return hoursDiff <= 24
}
