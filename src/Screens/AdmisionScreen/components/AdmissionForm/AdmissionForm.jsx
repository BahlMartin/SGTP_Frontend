import React from 'react'
import { UserPlus } from 'lucide-react'
import TriageSelector from '../TriageSelector/TriageSelector'
import StudiesSelector from '../StudiesSelector/StudiesSelector'
import './AdmissionForm.css'

/**
 * Formulario principal de ingreso y clasificación de pacientes en Admisión.
 * Contiene datos demográficos, selector de triage, estudios médicos y emisión de tickets.
 */
export default function AdmissionForm({
  formData,
  validationErrors = {},
  onFieldChange = () => {},
  onToggleStudy = () => {},
  onOpenOcrModal = () => {},
  onSubmitForm = () => {},
  isSubmitting = false
}) {
  const handleDniInputChange = (event) => {
    const numericOnlyValue = event.target.value.replace(/\D/g, '')
    onFieldChange('dni', numericOnlyValue)
  }

  return (
    <div className="admission-form-card">
      <div className="admission-form-card__header">
        <UserPlus size={24} className="admission-form-card__icon" />
        <h2 className="admission-form-card__title">Ingreso y clasificacion de pacientes</h2>
      </div>

      <form onSubmit={onSubmitForm} className="admission-form" noValidate>
        {/* Fila 1: DNI y Obra Social */}
        <div className="admission-form__row">
          <div className="admission-form__field">
            <label htmlFor="admission-patient-dni" className="admission-form__label">
              DNI
            </label>
            <input
              id="admission-patient-dni"
              type="text"
              className={`admission-form__input ${
                validationErrors.dni ? 'admission-form__input--error' : ''
              }`}
              placeholder="ej: 38472910"
              value={formData.dni}
              onChange={handleDniInputChange}
              aria-invalid={Boolean(validationErrors.dni)}
            />
            {validationErrors.dni && (
              <span className="admission-form__error-text">{validationErrors.dni}</span>
            )}
          </div>

          <div className="admission-form__field">
            <label htmlFor="admission-patient-obrasocial" className="admission-form__label">
              Obra social
            </label>
            <input
              id="admission-patient-obrasocial"
              type="text"
              className="admission-form__input"
              placeholder="ej: OSDE, PAMI, IOMA"
              value={formData.obraSocial}
              onChange={(event) => onFieldChange('obraSocial', event.target.value)}
            />
          </div>
        </div>

        {/* Fila 2: Nombre y Apellido */}
        <div className="admission-form__row">
          <div className="admission-form__field">
            <label htmlFor="admission-patient-name" className="admission-form__label">
              Nombre
            </label>
            <input
              id="admission-patient-name"
              type="text"
              className={`admission-form__input ${
                validationErrors.nombre ? 'admission-form__input--error' : ''
              }`}
              placeholder="Nombre del paciente"
              value={formData.nombre}
              onChange={(event) => onFieldChange('nombre', event.target.value)}
              aria-invalid={Boolean(validationErrors.nombre)}
            />
            {validationErrors.nombre && (
              <span className="admission-form__error-text">{validationErrors.nombre}</span>
            )}
          </div>

          <div className="admission-form__field">
            <label htmlFor="admission-patient-surname" className="admission-form__label">
              Apellido
            </label>
            <input
              id="admission-patient-surname"
              type="text"
              className={`admission-form__input ${
                validationErrors.apellido ? 'admission-form__input--error' : ''
              }`}
              placeholder="Apellido del paciente"
              value={formData.apellido}
              onChange={(event) => onFieldChange('apellido', event.target.value)}
              aria-invalid={Boolean(validationErrors.apellido)}
            />
            {validationErrors.apellido && (
              <span className="admission-form__error-text">{validationErrors.apellido}</span>
            )}
          </div>
        </div>

        {/* Fila 3: Número de Llamado (sistema externo) */}
        <div className="admission-form__row admission-form__row--center">
          <div className="admission-form__field admission-form__field--center">
            <label htmlFor="admission-external-call-number" className="admission-form__label">
              N° de llamado(sistema externo)
            </label>
            <input
              id="admission-external-call-number"
              type="text"
              className="admission-form__input admission-form__input--center"
              placeholder="ej: 104"
              value={formData.numLlamado}
              onChange={(event) => onFieldChange('numLlamado', event.target.value)}
            />
          </div>
        </div>

        {/* Categoría de Triage */}
        <TriageSelector
          selectedTriage={formData.selectedTriage}
          justificationText={formData.justificacionOtro}
          justificationError={validationErrors.justificacion}
          onSelectTriage={(triageKey) => {
            onFieldChange('selectedTriage', triageKey)
            if (triageKey !== 'Otro') {
              onFieldChange('justificacionOtro', '')
            }
          }}
          onChangeJustification={(justificationValue) =>
            onFieldChange('justificacionOtro', justificationValue)
          }
        />

        {/* Estudios Solicitados */}
        <StudiesSelector
          selectedStudies={formData.selectedStudies}
          onToggleStudy={onToggleStudy}
          onOpenOcrModal={onOpenOcrModal}
        />

        {/* Botón de Emisión */}
        <button
          type="submit"
          className="admission-form__submit-btn"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Generando ticket...' : 'Emitir Ticket Asistencial'}
        </button>
      </form>
    </div>
  )
}
