/**
 * Constantes y valores por defecto para el módulo de Admisión.
 */

export const AVAILABLE_STUDIES = [
  'Hemograma',
  'Bioquimica',
  'Orina',
  'Cultivo',
  'Glucemia',
  'Coagulograma'
]

export const CALL_PREFIXES = [
  { value: 'Ext', label: 'Ext (Extracción)' },
  { value: 'G', label: 'G (Guardia)' },
  { value: 'Med', label: 'Med (Médicos)' },
  { value: 'Csl', label: 'Csl (Consulta)' }
]

export const INITIAL_ADMISSION_FORM_STATE = {
  pacienteId: null,
  dni: '',
  numeroAfiliado: '',
  nombre: '',
  apellido: '',
  prefijoLlamado: 'Ext',
  numeroLlamado: '',
  selectedTriage: 'Guardia',
  justificacionOtro: '',
  selectedStudies: []
}
