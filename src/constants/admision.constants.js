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
  pacienteId: null,
  dni: '',
  numeroAfiliado: '',
  nombre: '',
  apellido: '',
  numLlamado: '',
  selectedTriage: 'Guardia',
  justificacionOtro: '',
  selectedStudies: []
}
