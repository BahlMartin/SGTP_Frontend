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

export const INITIAL_ADMISSION_FORM_STATE = {
  dni: '',
  obraSocial: '',
  nombre: '',
  apellido: '',
  numLlamado: '',
  selectedTriage: 'Guardia',
  justificacionOtro: '',
  selectedStudies: []
}
