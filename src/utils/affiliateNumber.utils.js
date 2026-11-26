/**
 * Utilidades para manejo compuesto del N° de afiliado (<base>-<sufijo de 2 dígitos>).
 * Ejemplos: "34567-00", "34567-01", "50949036" -> base "50949036", suffix "00".
 */

/**
 * Normaliza el sufijo del número de afiliado a exactamente 2 dígitos.
 * '' -> '00', '1' -> '01', '05' -> '05'.
 */
export function normalizeAffiliateSuffix(suffix) {
  const digits = String(suffix ?? '').replace(/\D/g, '').slice(0, 2)
  if (!digits) return '00'
  return digits.padStart(2, '0')
}

/**
 * Separa un número de afiliado compuesto o legacy en { base, suffix }.
 * - "34567-00" -> { base: '34567', suffix: '00' }
 * - "04-8921-02" -> { base: '048921', suffix: '02' }
 * - "50949036" -> { base: '50949036', suffix: '00' }
 * - "" -> { base: '', suffix: '' }
 */
export function splitAffiliateNumber(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return { base: '', suffix: '' }
  }

  if (raw.includes('-')) {
    const parts = raw.split('-')
    const lastPart = parts[parts.length - 1].trim()
    const beforeLastDigits = parts.slice(0, -1).join('').replace(/\D/g, '')

    if (beforeLastDigits && /^\d{0,2}$/.test(lastPart)) {
      return {
        base: beforeLastDigits,
        suffix: normalizeAffiliateSuffix(lastPart)
      }
    }

    const allDigits = raw.replace(/\D/g, '')
    if (!allDigits) {
      return { base: '', suffix: '' }
    }
    return { base: allDigits, suffix: '00' }
  }

  const digits = raw.replace(/\D/g, '')
  if (!digits) {
    return { base: '', suffix: '' }
  }

  return { base: digits, suffix: '00' }
}

/**
 * Compone el número de afiliado completo a partir de base y sufijo.
 * Si base no tiene dígitos, retorna ''.
 */
export function composeAffiliateNumber(base, suffix) {
  const cleanBase = String(base ?? '').replace(/\D/g, '')
  if (!cleanBase) return ''
  const paddedSuffix = normalizeAffiliateSuffix(suffix)
  return `${cleanBase}-${paddedSuffix}`
}
