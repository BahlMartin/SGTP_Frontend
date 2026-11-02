import { getArgentinaDateString } from './formatters.js'

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const getLabel = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (value && typeof value === 'object') {
    return String(value.nombre || value.name || value.label || '').trim()
  }
  return ''
}

const getStudyValue = (study, detail, keys) => {
  for (const key of keys) {
    const value = getLabel(detail?.[key]) || getLabel(study?.[key])
    if (value) return value
  }
  return ''
}

const resolveSample = (study, detail) => {
  const rawSample = normalize(
    getStudyValue(study, detail, ['tipo_muestra', 'muestra', 'sample_type', 'sample'])
  ).replace(/[_-]+/g, ' ')

  if (['sangre', 'edta', 'citrato', 'suero', 'jeringa'].includes(rawSample)) {
    return { key: 'sangre', label: 'Sangre' }
  }
  if (rawSample === 'orina') return { key: 'orina', label: 'Orina' }
  if (rawSample === 'materia fecal') return { key: 'materia fecal', label: 'Materia fecal' }
  return { key: 'otros', label: 'Otros' }
}

const toRows = (counts, keyName, labelName) =>
  Array.from(counts, ([key, value]) => ({
    [keyName]: key,
    [labelName]: value.label,
    total_estudios: value.total
  }))

export function computePerformedStudySummaries(tickets = [], targetDate = null) {
  const sectionCounts = new Map()
  const sampleCounts = new Map()
  const studyCounts = new Map()
  const samples = [
    { key: 'sangre', label: 'Sangre' },
    { key: 'orina', label: 'Orina' },
    { key: 'materia fecal', label: 'Materia fecal' },
    { key: 'otros', label: 'Otros' }
  ]

  samples.forEach(({ key, label }) => sampleCounts.set(key, { label, total: 0 }))

  tickets.forEach((ticket) => {
    const ticketStatus = normalize(ticket.estado_backend || ticket.estado)
    if (ticketStatus !== 'atendido' && ticketStatus !== 'finalizado') return
    if (
      targetDate &&
      (!ticket.fecha_hora_admision ||
        getArgentinaDateString(ticket.fecha_hora_admision) !== targetDate)
    ) {
      return
    }

    const rawStudies = Array.isArray(ticket.estudios_raw) && ticket.estudios_raw.length > 0
      ? ticket.estudios_raw
      : Array.isArray(ticket.estudios)
        ? ticket.estudios
        : []

    rawStudies.forEach((study) => {
      if (normalize(study?.estado) === 'cancelado') return

      const detail = study?.estudio_detalle || study?.study_detail || {}
      const studyName =
        getLabel(detail.nombre || detail.name) ||
        getLabel(study?.nombre || study?.name) ||
        (typeof study === 'string' ? study.trim() : '')
      if (!studyName) return

      const sectionLabel =
        getStudyValue(study, detail, [
          'nombre_seccion',
          'seccion_nombre',
          'seccion_detalle',
          'seccion',
          'section_name',
          'section'
        ]) ||
        'Sin sección'
      const sectionKey = normalize(sectionLabel).replace(/\s+/g, '_')
      const section = sectionCounts.get(sectionKey) || { label: sectionLabel, total: 0 }
      section.total += 1
      sectionCounts.set(sectionKey, section)

      const studyReference = study?.estudio
      const studyId = String(
        detail.id ||
          (studyReference && typeof studyReference === 'object'
            ? studyReference.id
            : studyReference) ||
          study?.id ||
          studyName
      )
      const studyCount = studyCounts.get(studyId) || {
        nombre: studyName,
        total: 0,
        codigo: detail.codigo || study?.codigo || '',
        demora_horas: detail.demora_horas || study?.demora_horas || 24
      }
      studyCount.total += 1
      studyCounts.set(studyId, studyCount)

      const sample = resolveSample(study, detail)
      const sampleCount = sampleCounts.get(sample.key)
      sampleCount.total += 1
    })
  })

  return {
    bySection: toRows(sectionCounts, 'seccion_key', 'nombre_seccion'),
    bySample: toRows(sampleCounts, 'muestra_key', 'nombre_muestra'),
    byStudy: Array.from(studyCounts, ([id, study]) => ({ id, ...study }))
  }
}
