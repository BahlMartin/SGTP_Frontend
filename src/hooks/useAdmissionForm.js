import { useState, useCallback } from 'react'
import { INITIAL_ADMISSION_FORM_STATE } from '../constants/admision.constants'
import { validatePersonName, validateDni } from '../utils/validators'

/**
 * Hook para gestionar el estado, validaciones reactivas y reseteo
 * del formulario de ingreso y clasificación de pacientes en Admisión.
 */
export function useAdmissionForm() {
  const [formData, setFormData] = useState(INITIAL_ADMISSION_FORM_STATE)
  const [validationErrors, setValidationErrors] = useState({})

  /**
   * Actualiza un campo individual y descarta su error en tiempo real.
   */
  const handleFieldChange = useCallback((fieldName, fieldValue) => {
    setFormData((previousFormData) => ({
      ...previousFormData,
      [fieldName]: fieldValue,
      ...(
        ['dni', 'nombre', 'apellido', 'numeroAfiliado'].includes(fieldName) &&
        previousFormData[fieldName] !== fieldValue
          ? { pacienteId: null }
          : {}
      )
    }))

    setValidationErrors((previousErrors) => {
      if (!previousErrors[fieldName]) {
        return previousErrors
      }
      const updatedErrors = { ...previousErrors }
      delete updatedErrors[fieldName]
      return updatedErrors
    })
  }, [])

  /**
   * Agrega o remueve un estudio del listado seleccionado.
   */
  const handleToggleStudy = useCallback((study) => {
    setFormData((previousFormData) => {
      const alreadySelected = previousFormData.selectedStudies.some(
        (selectedStudy) => selectedStudy.id === study.id
      )
      const updatedStudies = alreadySelected
        ? previousFormData.selectedStudies.filter(
            (selectedStudy) => selectedStudy.id !== study.id
          )
        : [...previousFormData.selectedStudies, study]

      return {
        ...previousFormData,
        selectedStudies: updatedStudies
      }
    })
  }, [])

  /**
   * Reemplaza por completo la lista de estudios (por ejemplo, al escanear con OCR).
   */
  const handleSetStudies = useCallback((studiesList) => {
    setFormData((previousFormData) => ({
      ...previousFormData,
      selectedStudies: Array.isArray(studiesList)
        ? studiesList.map((study) => (
            typeof study === 'string'
              ? { id: null, nombre: study }
              : { id: study.id ?? null, nombre: study.nombre || study.name || '' }
          ))
        : []
    }))
  }, [])

  /**
   * Carga los datos seleccionados desde la búsqueda de pacientes preexistentes.
   */
  const handleLoadPatient = useCallback((patientData) => {
    if (!patientData) return

    setFormData((previousFormData) => ({
      ...previousFormData,
      pacienteId: patientData.id_paciente || patientData.id || null,
      dni: patientData.dni || '',
      numeroAfiliado: patientData.numeroAfiliado || '',
      nombre: patientData.nombre || '',
      apellido: patientData.apellido || ''
    }))

    setValidationErrors({})
  }, [])

  /**
   * Valida exhaustivamente todos los campos del formulario.
   * Retorna true si es válido, o false si contiene errores.
   */
  const validateAdmissionForm = useCallback(() => {
    const calculatedErrors = {}

    const dniValidationResult = validateDni(formData.dni)
    if (!dniValidationResult.isValid) {
      calculatedErrors.dni = dniValidationResult.error
    }

    const nameValidationResult = validatePersonName(formData.nombre)
    if (!nameValidationResult.isValid) {
      calculatedErrors.nombre = nameValidationResult.error
    }

    const surnameValidationResult = validatePersonName(formData.apellido)
    if (!surnameValidationResult.isValid) {
      calculatedErrors.apellido = surnameValidationResult.error
    }

    if (
      formData.selectedTriage === 'Otro' &&
      (!formData.justificacionOtro || formData.justificacionOtro.trim().length < 5)
    ) {
      calculatedErrors.justificacion = 'La categoría "Otro" exige una justificación técnica obligatoria.'
    }

    setValidationErrors(calculatedErrors)
    return Object.keys(calculatedErrors).length === 0
  }, [formData])

  /**
   * Restablece el formulario a sus valores por defecto y limpia errores.
   */
  const resetAdmissionForm = useCallback(() => {
    setFormData(INITIAL_ADMISSION_FORM_STATE)
    setValidationErrors({})
  }, [])

  return {
    formData,
    validationErrors,
    handleFieldChange,
    handleToggleStudy,
    handleSetStudies,
    handleLoadPatient,
    validateAdmissionForm,
    resetAdmissionForm
  }
}
