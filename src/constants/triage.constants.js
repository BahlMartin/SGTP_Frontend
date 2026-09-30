/**
 * Definición y metadatos de las categorías de Triage del sistema SGTP.
 * Contiene únicamente información de dominio (identificadores, códigos y prioridades).
 * Los estilos visuales se gestionan mediante CSS.
 */
export const TRIAGE_CATEGORIES = {
  GUARDIA: {
    id: 'guardia',
    key: 'Guardia',
    code: '1',
    label: '1. Guardia',
    subtitle: 'Maxima urgencia',
    priority: 1
  },
  MEDICOS: {
    id: 'medicos',
    key: 'Medicos',
    code: '2',
    label: '2. Medicos',
    subtitle: 'Urgente',
    priority: 2
  },
  DISCAPACIDAD: {
    id: 'discapacidad',
    key: 'Discapacidad',
    code: '3',
    label: '3. Discapacidad',
    subtitle: 'Prioritario',
    priority: 3
  },
  ONCOLOGIA: {
    id: 'oncologia',
    key: 'Oncologia',
    code: '4',
    label: '4. Oncologia',
    subtitle: 'Programado',
    priority: 4
  },
  EXTRACCION_CON_TURNO: {
    id: 'extraccion_con_turno',
    key: 'Extraccion con turno',
    code: '5',
    label: '5. Extraccion con turno',
    subtitle: 'Demanda Espontanea',
    priority: 5
  },
  EXTRACCION_SIN_TURNO: {
    id: 'extraccion_sin_turno',
    key: 'Extraccion sin turno',
    code: '6',
    label: '6. Extraccion sin turno',
    subtitle: 'Demanda Espontanea',
    priority: 6
  },
  OTRO: {
    id: 'otro',
    key: 'Otro',
    code: '7',
    label: '7. Otro',
    subtitle: 'Requiere Justificacion',
    priority: 7,
    requiresJustification: true
  }
}

export const TRIAGE_LIST = Object.values(TRIAGE_CATEGORIES)

/**
 * Obtiene los metadatos de una categoría de triage por su key o id.
 * Retorna la categoría OTRO si no existe coincidencia.
 */
export function getTriageInfo(categoryKey) {
  if (!categoryKey) return TRIAGE_CATEGORIES.OTRO
  const found = TRIAGE_LIST.find(
    (category) =>
      category.key.toLowerCase() === categoryKey.toLowerCase() ||
      category.id.toLowerCase() === categoryKey.toLowerCase()
  )
  return found || TRIAGE_CATEGORIES.OTRO
}
