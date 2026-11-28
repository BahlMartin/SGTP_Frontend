import { useState, useCallback, useEffect } from 'react'
import { INITIAL_ADMISSION_FORM_STATE } from '../constants/admision.constants'
import { validatePersonName, validateDni } from '../utils/validators'
import {
  normalizeAffiliateSuffix,
  splitAffiliateNumber,
  composeAffiliateNumber
} from '../utils/affiliateNumber.utils'

export const ADMISSION_FORM_DRAFT_STORAGE_KEY = 'sgtp_admision_form_draft'
export const ADMISSION_STATE_CHANGED_EVENT = 'sgtp:admision_state_changed'

const PREFIX_TO_TRIAGE_MAP = {
  G: 'Guardia',
  Med: 'Médicos',
  Ext: 'Extracción sin turno',
  Csl: 'Otro'
}

function createReservationToken() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Fallback para entornos sin crypto.randomUUID
  }
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getNormalizedAffiliateComparable(value) {
  const { base, suffix } = splitAffiliateNumber(value)
  return composeAffiliateNumber(base, suffix)
}

function readAdmissionFormDraft() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem(ADMISSION_FORM_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function getInitialAffiliateParts(draft) {
  if (draft && (draft.numeroAfiliadoBase !== undefined || draft.numeroAfiliadoSufijo !== undefined)) {
    return {
      base: String(draft.numeroAfiliadoBase ?? '').replace(/\D/g, ''),
      suffix: String(draft.numeroAfiliadoSufijo ?? '').replace(/\D/g, '').slice(0, 2)
    }
  }
  if (draft?.formData?.numeroAfiliado) {
    return splitAffiliateNumber(draft.formData.numeroAfiliado)
  }
  return { base: '', suffix: '' }
}

function isAdmissionDraftEmpty(formData, existingPatient, numeroAfiliadoBase = '', numeroAfiliadoSufijo = '') {
  if (existingPatient) return false
  if (!formData || typeof formData !== 'object') return true

  return (
    !formData.pacienteId &&
    !String(formData.dni || '').trim() &&
    !String(formData.numeroAfiliado || '').trim() &&
    !String(numeroAfiliadoBase || '').trim() &&
    !String(numeroAfiliadoSufijo || '').trim() &&
    !String(formData.nombre || '').trim() &&
    !String(formData.apellido || '').trim() &&
    (formData.obraSocial ?? INITIAL_ADMISSION_FORM_STATE.obraSocial) ===
      INITIAL_ADMISSION_FORM_STATE.obraSocial &&
    (formData.prefijoLlamado || INITIAL_ADMISSION_FORM_STATE.prefijoLlamado) ===
      INITIAL_ADMISSION_FORM_STATE.prefijoLlamado &&
    !String(formData.numeroLlamado || '').trim() &&
    (formData.selectedTriage || INITIAL_ADMISSION_FORM_STATE.selectedTriage) ===
      INITIAL_ADMISSION_FORM_STATE.selectedTriage &&
    !String(formData.justificacionOtro || '').trim() &&
    (!Array.isArray(formData.selectedStudies) || formData.selectedStudies.length === 0)
  )
}

function notifyAdmisionStateChanged() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ADMISSION_STATE_CHANGED_EVENT))
    }
  } catch {
    // Ignorar en entornos sin window
  }
}

/**
 * Hook para gestionar el estado, validaciones reactivas y reseteo
 * del formulario de ingreso y clasificación de pacientes en Admisión.
 */
export function useAdmissionForm() {
  const [formData, setFormData] = useState(() => {
    const draft = readAdmissionFormDraft()
    if (draft?.formData && typeof draft.formData === 'object') {
      const initialParts = getInitialAffiliateParts(draft)
      const composed = composeAffiliateNumber(initialParts.base, initialParts.suffix)
      return {
        ...INITIAL_ADMISSION_FORM_STATE,
        ...draft.formData,
        numeroAfiliado: composed || String(draft.formData.numeroAfiliado || ''),
        selectedStudies: Array.isArray(draft.formData.selectedStudies)
          ? draft.formData.selectedStudies
          : []
      }
    }
    return INITIAL_ADMISSION_FORM_STATE
  })
  const [numeroAfiliadoBase, setNumeroAfiliadoBase] = useState(() => {
    const draft = readAdmissionFormDraft()
    return getInitialAffiliateParts(draft).base
  })
  const [numeroAfiliadoSufijo, setNumeroAfiliadoSufijo] = useState(() => {
    const draft = readAdmissionFormDraft()
    return getInitialAffiliateParts(draft).suffix
  })
  const [reservationToken, setReservationToken] = useState(() => {
    const draft = readAdmissionFormDraft()
    return typeof draft?.reservationToken === 'string' && draft.reservationToken.trim()
      ? draft.reservationToken.trim()
      : createReservationToken()
  })
  const [validationErrors, setValidationErrors] = useState({})
  const [existingPatient, setExistingPatient] = useState(() => {
    const draft = readAdmissionFormDraft()
    return draft?.existingPatient && typeof draft.existingPatient === 'object'
      ? draft.existingPatient
      : null
  })

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (isAdmissionDraftEmpty(formData, existingPatient, numeroAfiliadoBase, numeroAfiliadoSufijo)) {
          window.localStorage.removeItem(ADMISSION_FORM_DRAFT_STORAGE_KEY)
        } else {
          window.localStorage.setItem(
            ADMISSION_FORM_DRAFT_STORAGE_KEY,
            JSON.stringify({
              formData,
              existingPatient,
              numeroAfiliadoBase,
              numeroAfiliadoSufijo,
              reservationToken
            })
          )
        }
      }
    } catch (error) {
      console.warn('No se pudo persistir el borrador de admisión:', error)
    }
    notifyAdmisionStateChanged()
  }, [formData, existingPatient, numeroAfiliadoBase, numeroAfiliadoSufijo, reservationToken])

  const resetReservationToken = useCallback(() => {
    const nextToken = createReservationToken()
    setReservationToken(nextToken)
    return nextToken
  }, [])

  const applyAffiliateMismatchCheck = useCallback(
    (updatedErrors, nextComposed) => {
      if (!existingPatient) return updatedErrors
      const originalRaw = String(
        existingPatient.numeroAfiliado || existingPatient.num_obra_social || ''
      ).trim()
      const originalComparable = getNormalizedAffiliateComparable(originalRaw)
      const currentComparable = getNormalizedAffiliateComparable(nextComposed)
      if (originalComparable && currentComparable && originalComparable !== currentComparable) {
        updatedErrors.numeroAfiliado = `El N° de afiliado no coincide con el registrado (${originalRaw}) para este DNI.`
      }
      return updatedErrors
    },
    [existingPatient]
  )

  /**
   * Actualiza un campo individual y valida en tiempo real.
   */
  const handleFieldChange = useCallback((fieldName, fieldValue) => {
    if (fieldName === 'numeroAfiliado') {
      const parts = splitAffiliateNumber(fieldValue)
      const composed = composeAffiliateNumber(parts.base, parts.suffix)
      setNumeroAfiliadoBase(parts.base)
      setNumeroAfiliadoSufijo(parts.suffix)
      setFormData((previousFormData) => ({
        ...previousFormData,
        numeroAfiliado: composed,
        ...(previousFormData.numeroAfiliado !== composed ? { pacienteId: null } : {})
      }))
      setValidationErrors((previousErrors) => {
        const updatedErrors = { ...previousErrors }
        delete updatedErrors.numeroAfiliado
        return applyAffiliateMismatchCheck(updatedErrors, composed)
      })
      return
    }

    setFormData((previousFormData) => ({
      ...previousFormData,
      [fieldName]: fieldValue,
      ...(
        ['dni', 'nombre', 'apellido', 'obraSocial'].includes(fieldName) &&
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

      if (fieldName === 'dni' && existingPatient) {
        if (String(fieldValue).trim() !== String(existingPatient.dni).trim()) {
          setExistingPatient(null)
        }
      }

      return updatedErrors
    })
  }, [existingPatient, applyAffiliateMismatchCheck])

  const handleAffiliateBaseChange = useCallback(
    (rawBaseValue) => {
      const cleanBase = String(rawBaseValue ?? '').replace(/\D/g, '')
      const composed = composeAffiliateNumber(cleanBase, numeroAfiliadoSufijo)
      setNumeroAfiliadoBase(cleanBase)
      setFormData((previousFormData) => ({
        ...previousFormData,
        numeroAfiliado: composed,
        ...(previousFormData.numeroAfiliado !== composed ? { pacienteId: null } : {})
      }))
      setValidationErrors((previousErrors) => {
        const updatedErrors = { ...previousErrors }
        delete updatedErrors.numeroAfiliado
        return applyAffiliateMismatchCheck(updatedErrors, composed)
      })
    },
    [numeroAfiliadoSufijo, applyAffiliateMismatchCheck]
  )

  const handleAffiliateSuffixChange = useCallback(
    (rawSuffixValue) => {
      const cleanSuffix = String(rawSuffixValue ?? '').replace(/\D/g, '').slice(0, 2)
      const composed = composeAffiliateNumber(numeroAfiliadoBase, cleanSuffix)
      setNumeroAfiliadoSufijo(cleanSuffix)
      setFormData((previousFormData) => ({
        ...previousFormData,
        numeroAfiliado: composed,
        ...(previousFormData.numeroAfiliado !== composed ? { pacienteId: null } : {})
      }))
      setValidationErrors((previousErrors) => {
        const updatedErrors = { ...previousErrors }
        delete updatedErrors.numeroAfiliado
        return applyAffiliateMismatchCheck(updatedErrors, composed)
      })
    },
    [numeroAfiliadoBase, applyAffiliateMismatchCheck]
  )

  const handleAffiliateSuffixBlur = useCallback(() => {
    const cleanBase = String(numeroAfiliadoBase ?? '').replace(/\D/g, '')
    if (!cleanBase) {
      setNumeroAfiliadoSufijo('')
      setFormData((previousFormData) => ({
        ...previousFormData,
        numeroAfiliado: ''
      }))
      return
    }

    const paddedSuffix = normalizeAffiliateSuffix(numeroAfiliadoSufijo)
    const composed = composeAffiliateNumber(cleanBase, paddedSuffix)
    setNumeroAfiliadoSufijo(paddedSuffix)
    setFormData((previousFormData) => ({
      ...previousFormData,
      numeroAfiliado: composed
    }))
    setValidationErrors((previousErrors) => {
      const updatedErrors = { ...previousErrors }
      delete updatedErrors.numeroAfiliado
      return applyAffiliateMismatchCheck(updatedErrors, composed)
    })
  }, [numeroAfiliadoBase, numeroAfiliadoSufijo, applyAffiliateMismatchCheck])

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
   * Fusiona sin duplicar los estudios escaneados con los previamente seleccionados en Admisión.
   */
  const handleSetStudies = useCallback((studiesList) => {
    setFormData((previousFormData) => {
      const merged = []
      const seenIds = new Set()
      const seenNames = new Set()

      const appendUnique = (study) => {
        if (!study) return
        const normalized =
          typeof study === 'string'
            ? { id: null, nombre: study }
            : { id: study.id ?? null, nombre: study.nombre || study.name || '' }
        const nameKey = String(normalized.nombre || '').trim().toLowerCase()

        if (normalized.id !== null && normalized.id !== undefined) {
          if (seenIds.has(normalized.id)) return
          seenIds.add(normalized.id)
          if (nameKey) seenNames.add(nameKey)
          merged.push(normalized)
        } else if (nameKey && !seenNames.has(nameKey)) {
          seenNames.add(nameKey)
          merged.push(normalized)
        }
      }

      for (const existing of previousFormData.selectedStudies || []) {
        appendUnique(existing)
      }
      if (Array.isArray(studiesList)) {
        for (const incoming of studiesList) {
          appendUnique(incoming)
        }
      }

      return {
        ...previousFormData,
        selectedStudies: merged
      }
    })
  }, [])

  /**
   * Carga los datos seleccionados desde la búsqueda de pacientes preexistentes.
   */
  const handleLoadPatient = useCallback((patientData) => {
    if (!patientData) return

    const rawAffiliate = String(patientData.numeroAfiliado || patientData.num_obra_social || '')
    const { base, suffix } = splitAffiliateNumber(rawAffiliate)
    const composed = composeAffiliateNumber(base, suffix)

    setExistingPatient(patientData)
    setNumeroAfiliadoBase(base)
    setNumeroAfiliadoSufijo(suffix)
    setFormData((previousFormData) => ({
      ...previousFormData,
      pacienteId: patientData.id_paciente || patientData.id || null,
      dni: String(patientData.dni || ''),
      numeroAfiliado: composed,
      nombre: patientData.nombre || '',
      apellido: patientData.apellido || patientData.apellidos || '',
      obraSocial: patientData.obra_social || patientData.obraSocial || 'IOMA'
    }))

    setValidationErrors({})
  }, [])

  /**
   * Valida exhaustivamente todos los campos del formulario.
   * Retorna un objeto con isValid y el mapa de errores calculados.
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

    const cleanBase = String(numeroAfiliadoBase || '').replace(/\D/g, '')
    if (!cleanBase) {
      calculatedErrors.numeroAfiliado = 'El número de afiliado es obligatorio.'
    } else if (existingPatient && existingPatient.dni) {
      // Regla de Integridad: Si el paciente está registrado previamente, el N° de afiliado debe coincidir
      const originalRaw = String(
        existingPatient.numeroAfiliado || existingPatient.num_obra_social || ''
      ).trim()
      const originalComparable = getNormalizedAffiliateComparable(originalRaw)
      const currentComparable = composeAffiliateNumber(cleanBase, numeroAfiliadoSufijo)
      if (originalComparable && currentComparable && originalComparable !== currentComparable) {
        calculatedErrors.numeroAfiliado = `El N° de afiliado no coincide con el registrado (${originalRaw}) para este DNI.`
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
    return {
      isValid: Object.keys(calculatedErrors).length === 0,
      errors: calculatedErrors
    }
  }, [formData, existingPatient, numeroAfiliadoBase, numeroAfiliadoSufijo])

  /**
   * Restablece únicamente los campos editables manteniendo el turno convocado activo
   * (prefijo, número de llamado y DNI) para evitar dejar turnos huérfanos en atención.
   */
  const clearEditableFieldsKeepTurno = useCallback((turnoDefaults = null) => {
    setFormData((previousFormData) => {
      const keptPrefix =
        turnoDefaults?.prefijoLlamado ||
        previousFormData.prefijoLlamado ||
        INITIAL_ADMISSION_FORM_STATE.prefijoLlamado
      const keptNumber =
        turnoDefaults?.numeroLlamado !== undefined && turnoDefaults?.numeroLlamado !== null
          ? String(turnoDefaults.numeroLlamado)
          : String(previousFormData.numeroLlamado || '')
      const keptDni =
        turnoDefaults?.dni !== undefined && turnoDefaults?.dni !== null
          ? String(turnoDefaults.dni)
          : String(previousFormData.dni || '')

      return {
        ...INITIAL_ADMISSION_FORM_STATE,
        prefijoLlamado: keptPrefix,
        numeroLlamado: keptNumber,
        dni: keptDni,
        selectedTriage:
          PREFIX_TO_TRIAGE_MAP[keptPrefix] || INITIAL_ADMISSION_FORM_STATE.selectedTriage
      }
    })
    setNumeroAfiliadoBase('')
    setNumeroAfiliadoSufijo('')
    setValidationErrors({})
    setExistingPatient(null)
  }, [])

  /**
   * Restablece el formulario a sus valores por defecto y limpia errores y borrador persistido.
   */
  const resetAdmissionForm = useCallback(() => {
    setFormData(INITIAL_ADMISSION_FORM_STATE)
    setNumeroAfiliadoBase('')
    setNumeroAfiliadoSufijo('')
    setValidationErrors({})
    setExistingPatient(null)
    setReservationToken(createReservationToken())
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(ADMISSION_FORM_DRAFT_STORAGE_KEY)
      }
    } catch (error) {
      console.warn('No se pudo limpiar el borrador de admisión:', error)
    }
    notifyAdmisionStateChanged()
  }, [])

  return {
    formData,
    numeroAfiliadoBase,
    numeroAfiliadoSufijo,
    reservationToken,
    validationErrors,
    existingPatient,
    handleFieldChange,
    handleAffiliateBaseChange,
    handleAffiliateSuffixChange,
    handleAffiliateSuffixBlur,
    handleToggleStudy,
    handleSetStudies,
    handleLoadPatient,
    validateAdmissionForm,
    resetAdmissionForm,
    resetReservationToken,
    clearEditableFieldsKeepTurno,
    resetEditableFields: clearEditableFieldsKeepTurno
  }
}
