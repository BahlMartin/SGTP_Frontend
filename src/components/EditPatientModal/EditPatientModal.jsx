import React, { useState, useEffect } from 'react'
import { AlertCircle, X, Check, UserPen, Loader2 } from 'lucide-react'
import {
  splitAffiliateNumber,
  composeAffiliateNumber,
  normalizeAffiliateSuffix
} from '../../utils/affiliateNumber.utils'
import './EditPatientModal.css'

function getInitialFormData(patient) {
  if (!patient) {
    return {
      nombre: '',
      apellidos: '',
      dni: '',
      obra_social: 'IOMA',
      num_obra_social_base: '',
      num_obra_social_sufijo: ''
    }
  }

  const rawAffiliate = patient.num_obra_social || patient.numeroAfiliado || ''
  const { base, suffix } = splitAffiliateNumber(rawAffiliate)

  return {
    nombre: patient.nombre || '',
    apellidos: patient.apellidos || patient.apellido || '',
    dni: patient.dni ? String(patient.dni) : '',
    obra_social: patient.obra_social || patient.obraSocial || 'IOMA',
    num_obra_social_base: base,
    num_obra_social_sufijo: suffix
  }
}

export default function EditPatientModal({
  isOpen = true,
  patient,
  onClose,
  onSubmit
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(patient))
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setFormData(getInitialFormData(patient))
    setErrorMessage('')
  }, [patient])

  // Cierre con tecla Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !patient) return null

  const patientId = patient.id_paciente || patient.id

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'dni' ? value.replace(/\D/g, '') : value
    }))
  }

  const handleAffiliateBaseChange = (e) => {
    const cleanBase = e.target.value.replace(/\D/g, '')
    setFormData((prev) => ({
      ...prev,
      num_obra_social_base: cleanBase
    }))
  }

  const handleAffiliateSuffixChange = (e) => {
    const cleanSuffix = e.target.value.replace(/\D/g, '').slice(0, 2)
    setFormData((prev) => ({
      ...prev,
      num_obra_social_sufijo: cleanSuffix
    }))
  }

  const handleAffiliateBlur = () => {
    setFormData((prev) => {
      const cleanBase = String(prev.num_obra_social_base || '').replace(/\D/g, '')
      if (!cleanBase) {
        return { ...prev, num_obra_social_sufijo: '' }
      }
      return {
        ...prev,
        num_obra_social_sufijo: normalizeAffiliateSuffix(prev.num_obra_social_sufijo)
      }
    })
  }

  const validateForm = () => {
    if (!formData.nombre.trim() || formData.nombre.trim().length < 2) {
      return 'El nombre es obligatorio y debe contener al menos 2 letras.'
    }
    if (!formData.apellidos.trim() || formData.apellidos.trim().length < 2) {
      return 'El apellido es obligatorio y debe contener al menos 2 letras.'
    }
    const cleanDni = Number(String(formData.dni).replace(/\D/g, ''))
    if (!cleanDni || cleanDni <= 0) {
      return 'El DNI es obligatorio y debe ser un número válido positivo.'
    }
    if (!formData.obra_social.trim()) {
      return 'Debe especificar la obra social o cobertura médica (ej: IOMA, OSDE).'
    }
    if (!String(formData.num_obra_social_base || '').replace(/\D/g, '')) {
      return 'El número de afiliado es obligatorio.'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    const validationError = validateForm()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    const composedAffiliate = composeAffiliateNumber(
      formData.num_obra_social_base,
      formData.num_obra_social_sufijo
    )

    setIsSaving(true)
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        apellidos: formData.apellidos.trim(),
        dni: Number(String(formData.dni).replace(/\D/g, '')),
        obra_social: formData.obra_social.trim(),
        num_obra_social: composedAffiliate
      }

      await onSubmit(patientId, payload)
    } catch (err) {
      console.error('Error al actualizar paciente:', err)
      // Extrae mensajes amigables de DRF si existen
      let msg = err.message || 'Error al actualizar los datos del paciente.'
      if (err.data && typeof err.data === 'object') {
        const firstKey = Object.keys(err.data)[0]
        if (firstKey) {
          const detail = Array.isArray(err.data[firstKey]) ? err.data[firstKey][0] : err.data[firstKey]
          msg = `${firstKey.toUpperCase()}: ${detail}`
        }
      }
      setErrorMessage(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="edit-patient-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-patient-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose?.()
      }}
    >
      <div className="edit-patient-modal__card">
        <button
          type="button"
          className="edit-patient-modal__close-btn"
          onClick={onClose}
          disabled={isSaving}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        <div className="edit-patient-modal__header">
          <div className="edit-patient-modal__icon-badge">
            <UserPen size={22} />
          </div>
          <div>
            <h3 id="edit-patient-title" className="edit-patient-modal__title">
              Modificar datos del paciente
            </h3>
            <p className="edit-patient-modal__subtitle">
              Actualizá la filiación y cobertura clínica en la base de datos.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="edit-patient-modal__error" role="alert">
            <AlertCircle size={16} className="edit-patient-modal__error-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="edit-patient-modal__form">
          <div className="edit-patient-modal__grid-2">
            <div className="edit-patient-modal__field">
              <label htmlFor="edit-patient-nombre">Nombre(s) *</label>
              <input
                id="edit-patient-nombre"
                name="nombre"
                type="text"
                required
                disabled={isSaving}
                placeholder="Nombre del paciente"
                value={formData.nombre}
                onChange={handleChange}
              />
            </div>

            <div className="edit-patient-modal__field">
              <label htmlFor="edit-patient-apellidos">Apellido(s) *</label>
              <input
                id="edit-patient-apellidos"
                name="apellidos"
                type="text"
                required
                disabled={isSaving}
                placeholder="Apellido del paciente"
                value={formData.apellidos}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="edit-patient-modal__field">
            <label htmlFor="edit-patient-dni">DNI / Documento *</label>
            <input
              id="edit-patient-dni"
              name="dni"
              type="text"
              inputMode="numeric"
              required
              disabled={isSaving}
              placeholder="Número de documento (solo dígitos)"
              value={formData.dni}
              onChange={handleChange}
            />
          </div>

          <div className="edit-patient-modal__grid-2">
            <div className="edit-patient-modal__field">
              <label htmlFor="edit-patient-obra-social">Obra Social / Cobertura *</label>
              <input
                id="edit-patient-obra-social"
                name="obra_social"
                type="text"
                required
                disabled={isSaving}
                placeholder="ej: IOMA, OSDE, PAMI"
                value={formData.obra_social}
                onChange={handleChange}
              />
            </div>

            <div className="edit-patient-modal__field">
              <label htmlFor="edit-patient-num-afiliado">N° de Afiliado *</label>
              <div className="edit-patient-modal__affiliate-group">
                <input
                  id="edit-patient-num-afiliado"
                  name="num_obra_social_base"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  disabled={isSaving}
                  className="edit-patient-modal__affiliate-base"
                  placeholder="ej: 34567"
                  value={formData.num_obra_social_base}
                  onChange={handleAffiliateBaseChange}
                  onBlur={handleAffiliateBlur}
                />
                <span className="edit-patient-modal__affiliate-dash">-</span>
                <input
                  id="edit-patient-num-afiliado-sufijo"
                  name="num_obra_social_sufijo"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  required
                  disabled={isSaving}
                  className="edit-patient-modal__affiliate-suffix"
                  placeholder="00"
                  aria-label="Sufijo de número de afiliado"
                  value={formData.num_obra_social_sufijo}
                  onChange={handleAffiliateSuffixChange}
                  onBlur={handleAffiliateBlur}
                />
              </div>
            </div>
          </div>

          <div className="edit-patient-modal__actions">
            <button
              type="button"
              className="edit-patient-modal__btn edit-patient-modal__btn--cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="edit-patient-modal__btn edit-patient-modal__btn--submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="edit-patient-modal__spinner" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
