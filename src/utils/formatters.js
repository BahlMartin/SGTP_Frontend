const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

function getArgentinaDateParts(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).reduce((parts, part) => {
    if (part.type !== 'literal') parts[part.type] = part.value
    return parts
  }, {})
}

/**
 * Formatea una fecha u objeto ISO string a formato estricto dd/mm/aaaa
 */
export function formatDateDDMMAAAA(dateInput) {
  if (!dateInput) return '--/--/----'
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateInput))
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`
  }

  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return '--/--/----'

  const { day, month, year } = getArgentinaDateParts(date)
  return `${day}/${month}/${year}`
}

/**
 * Formatea a hora hh:mm
 */
export function formatTimeHHMM(dateInput) {
  if (!dateInput) return '--:--'
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return '--:--'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(date)
}

export function getArgentinaDateString(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(date.getTime())) return ''
  const { year, month, day } = getArgentinaDateParts(date)
  return `${year}-${month}-${day}`
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

/**
 * Devuelve la fecha local en formato estricto YYYY-MM-DD
 * compensando la diferencia de huso horario local.
 */
export function getTodayLocalDateString(referenceDate = new Date()) {
  const safeDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
  return getArgentinaDateString(safeDate)
}
