const PERSON_NAME_FIELDS = [
  'nombre',
  'apellidos',
  'apellido',
  'primerNombre',
  'nombre_completo',
  'nombreCompleto',
  'paciente_nombre',
  'paciente_apellido',
  'personal_admision_nombre',
  'personal_box_nombre'
]

export function normalizePersonName(value) {
  if (typeof value !== 'string') return value

  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-AR')
    .replace(/(^|[\s'-])(\p{L})/gu, (_, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase('es-AR')}`
    )
}

export function normalizePersonFields(person) {
  if (!person || typeof person !== 'object') return person

  const normalizedPerson = { ...person }
  for (const field of PERSON_NAME_FIELDS) {
    if (typeof normalizedPerson[field] === 'string') {
      normalizedPerson[field] = normalizePersonName(normalizedPerson[field])
    }
  }
  return normalizedPerson
}
