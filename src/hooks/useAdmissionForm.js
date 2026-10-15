import { useState, useCallback } from 'react'
import { INITIAL_ADMISSION_FORM_STATE } from '../constants/admision.constants'
import { validatePersonName, validateDni } from '../utils/validators'

const PREFIX_TO_TRIAGE_MAP = {
  G: 'Guardia',
  Med: 'Medicos',
  Ext: 'Extraccion sin turno',
  Csl: 'Otro'
}

/**
 * Hook para gestionar el estado, validaciones reactivas y reseteo
 * del formulario de ingreso y clasificación de pacientes en Admisión.
 */
export function useAdmissionForm() {
  const [formData, setFormData] = useState(INITIAL_ADMISSION_FORM_STATE)
  const [validationErrors, setValidationErrors] = useState({})
  const [existingPatient, setExistingPatient] = useState(null)

  /**
   * Actualiza un campo individual y valida en tiempo real.
   */
  const handleFieldChange = useCallback((fieldName, fieldValue) => {
    setFormData((previousFormData) => ({
      ...previousFormData,
      [fieldName]: fieldValue,
      ...(
        ['dni', 'nombre', 'apellido', 'numeroAfiliado', 'obraSocial'].includes(fieldName) &&
        previousFormData[fieldName] !== fieldValue
          ? { pacienteId: null }
          : {}
      ),
      ...(
        fieldName === 'prefijoLlamado' && PREFIX_TO_TRIAGE_MAP[fieldValue]
          ? { selectedTriage: PREFIX_TO_TRIAGE_MAP[fieldValue] }
          : {}
      )
    }))

    setValidationErrors((previousErrors) => {
      const updatedErrors = { ...previousErrors }
      delete updatedErrors[fieldName]

      // Validación reactiva: si el paciente ya existe en el sistema y se ingresa un número de afiliado distinto
      if (fieldName === 'numeroAfiliado' && existingPatient) {
        const originalAffiliate = String(
          existingPatient.numeroAfiliado || existingPatient.num_obra_social || ''
        ).trim()
        const newAffiliate = String(fieldValue).trim()
        if (originalAffiliate && newAffiliate && originalAffiliate !== newAffiliate) {
          updatedErrors.numeroAfiliado = `El N° de afiliado no coincide con el registrado (${originalAffiliate}) para este DNI.`
        }
      }

      if (fieldName === 'dni' && existingPatient) {
        if (String(fieldValue).trim() !== String(existingPatient.dni).trim()) {
          setExistingPatient(null)
        }
      }

      return updatedErrors
    })
  }, [existingPatient])

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

    setExistingPatient(patientData)
    setFormData((previousFormData) => ({
      ...previousFormData,
      pacienteId: patientData.id_paciente || patientData.id || null,
      dni: String(patientData.dni || ''),
      numeroAfiliado: String(patientData.numeroAfiliado || patientData.num_obra_social || ''),
      nombre: patientData.nombre || '',
      apellido: patientData.apellido || patientData.apellidos || '',
      obraSocial: patientData.obra_social || patientData.obraSocial || 'IOMA'
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

    if (!formData.obraSocial || !formData.obraSocial.trim()) {
      calculatedErrors.obraSocial = 'El nombre de la obra social es obligatorio.'
    }

    // Regla de Integridad: Si el paciente está registrado previamente, el N° de afiliado debe coincidir
    if (existingPatient && existingPatient.dni) {
      const originalAffiliate = String(
        existingPatient.numeroAfiliado || existingPatient.num_obra_social || ''
      ).trim()
      const currentAffiliate = String(formData.numeroAfiliado || '').trim()
      if (originalAffiliate && currentAffiliate && originalAffiliate !== currentAffiliate) {
        calculatedErrors.numeroAfiliado = `El N° de afiliado no coincide con el registrado (${originalAffiliate}) para este DNI.`
      }
    }

    if (!formData.numeroLlamado || !String(formData.numeroLlamado).trim()) {
      calculatedErrors.numeroLlamado = 'El número de llamado es obligatorio.'
    } else if (!/^\d{1,4}$/.test(String(formData.numeroLlamado).trim())) {
      calculatedErrors.numeroLlamado = 'El número de llamado debe ser un valor numérico de hasta 4 dígitos.'
    }

    if (
      formData.selectedTriage === 'Otro' &&
      (!formData.justificacionOtro || formData.justificacionOtro.trim().length < 5)
    ) {
      calculatedErrors.justificacion = 'La categoría "Otro" exige una justificación técnica obligatoria.'
    }

    setValidationErrors(calculatedErrors)
    return Object.keys(calculatedErrors).length === 0
  }, [formData, existingPatient])

  /**
   * Restablece el formulario a sus valores por defecto y limpia errores.
   */
  const resetAdmissionForm = useCallback(() => {
    setFormData(INITIAL_ADMISSION_FORM_STATE)
    setValidationErrors({})
    setExistingPatient(null)
  }, [])

  return {
    formData,
    validationErrors,
    existingPatient,
    handleFieldChange,
    handleToggleStudy,
    handleSetStudies,
    handleLoadPatient,
    validateAdmissionForm,
    resetAdmissionForm
  }
}
