export const TRIAGE_CATEGORIES = {
  GUARDIA: {
    id: 'guardia',
    key: 'Guardia',
    code: '1',
    label: '1. Guardia',
    subtitle: 'Maxima urgencia',
    priority: 1,
    color: '#ef4444',
    bgBadge: '#fee2e2',
    textColor: '#991b1b'
  },
  MEDICOS: {
    id: 'medicos',
    key: 'Medicos',
    code: '2',
    label: '2. Medicos',
    subtitle: 'Urgente',
    priority: 2,
    color: '#f97316',
    bgBadge: '#ffedd5',
    textColor: '#9a3412'
  },
  DISCAPACIDAD: {
    id: 'discapacidad',
    key: 'Discapacidad',
    code: '3',
    label: '3. Discapacidad',
    subtitle: 'Prioritario',
    priority: 3,
    color: '#eab308',
    bgBadge: '#fef9c3',
    textColor: '#854d0e'
  },
  ONCOLOGIA: {
    id: 'oncologia',
    key: 'Oncologia',
    code: '4',
    label: '4. Oncologia',
    subtitle: 'Programado',
    priority: 4,
    color: '#0284c7',
    bgBadge: '#e0f2fe',
    textColor: '#075985'
  },
  EXTRACCION_CON_TURNO: {
    id: 'extraccion_con_turno',
    key: 'Extraccion con turno',
    code: '5',
    label: '5. Extraccion con turno',
    subtitle: 'Demanda Espontanea',
    priority: 5,
    color: '#22c55e',
    bgBadge: '#dcfce7',
    textColor: '#166534'
  },
  EXTRACCION_SIN_TURNO: {
    id: 'extraccion_sin_turno',
    key: 'Extraccion sin turno',
    code: '6',
    label: '6. Extraccion sin turno',
    subtitle: 'Demanda Espontanea',
    priority: 6,
    color: '#a855f7',
    bgBadge: '#f3e8ff',
    textColor: '#6b21a8'
  },
  OTRO: {
    id: 'otro',
    key: 'Otro',
    code: '7',
    label: '7. Otro',
    subtitle: 'Requiere Justificacion',
    priority: 7,
    color: '#64748b',
    bgBadge: '#f1f5f9',
    textColor: '#334155',
    requiresJustification: true
  }
}

export const TRIAGE_LIST = Object.values(TRIAGE_CATEGORIES)

export function getTriageInfo(categoryKey) {
  if (!categoryKey) return TRIAGE_CATEGORIES.OTRO
  const found = TRIAGE_LIST.find(
    (t) => t.key.toLowerCase() === categoryKey.toLowerCase() || t.id.toLowerCase() === categoryKey.toLowerCase()
  )
  return found || TRIAGE_CATEGORIES.OTRO
}

/**
 * Ordena la cola multibox por severidad de triage (menor número = mayor urgencia).
 * Si tienen la misma urgencia, prioriza al paciente que lleva más tiempo en espera (FIFO).
 */
export function sortQueueByPriority(tickets) {
  return [...tickets].sort((a, b) => {
    const infoA = getTriageInfo(a.clasificacion_triage)
    const infoB = getTriageInfo(b.clasificacion_triage)

    if (infoA.priority !== infoB.priority) {
      return infoA.priority - infoB.priority
    }

    const timeA = new Date(a.fecha_hora_admision || 0).getTime()
    const timeB = new Date(b.fecha_hora_admision || 0).getTime()
    return timeA - timeB
  })
}
