/**
 * Formatea una fecha u objeto ISO string a formato estricto dd/mm/aaaa
 */
export function formatDateDDMMAAAA(dateInput) {
  if (!dateInput) return '--/--/----'
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return '--/--/----'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

/**
 * Formatea a hora hh:mm
 */
export function formatTimeHHMM(dateInput) {
  if (!dateInput) return '--:--'
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return '--:--'

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Calcula diferencia en minutos entre dos marcas temporales
 */
export function calculateMinutesDiff(startInput, endInput) {
  if (!startInput || !endInput) return null
  const start = new Date(startInput).getTime()
  const end = new Date(endInput).getTime()
  if (isNaN(start) || isNaN(end) || end < start) return null
  return Math.round((end - start) / 60000)
}

/**
 * Formatea minutos a cadena legible (ej: "14 min" o "1h 10m")
 */
export function formatDurationHuman(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '—'
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Devuelve la marca temporal actual en formato UTC ISO 8601
 */
export function getCurrentUtcIso() {
  return new Date().toISOString()
}
