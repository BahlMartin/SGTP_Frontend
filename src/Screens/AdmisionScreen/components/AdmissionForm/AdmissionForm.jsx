import React, { useState, useEffect, useRef } from 'react'
import { UserPlus, UserCheck, RotateCcw, X } from 'lucide-react'
import TriageSelector from '../TriageSelector/TriageSelector'
import StudiesSelector from '../StudiesSelector/StudiesSelector'
import PatientDropdown from '../../../../components/PatientDropdown/PatientDropdown'
import { searchPatientsApi } from '../../../../services/ticketService'
import './AdmissionForm.css'

/**
 * Formulario principal de ingreso y clasificación de pacientes en Admisión.
 * Contiene datos demográficos, selector de triage, estudios médicos y emisión de tickets.
 */
export default function AdmissionForm({
  formData,
  validationErrors = {},
  ticketNumberError = '',
  admissionError = '',
  existingPatient = null,
  onLoadPatient = () => {},
  onFieldChange = () => {},
  onToggleStudy = () => {},
  onOpenOcrModal = () => {},
  onSubmitForm = () => {},
  onResetForm = () => {},
  isSubmitting = false
}) {
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const searchRequestIdRef = useRef(0)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleDniInputChange = (event) => {
    const numericOnlyValue = event.target.value.replace(/\D/g, '')
    onFieldChange('dni', numericOnlyValue)

    if (numericOnlyValue.length >= 2) {
      setIsSearching(true)
      setShowDropdown(true)
      const currentRequestId = ++searchRequestIdRef.current

      searchPatientsApi(numericOnlyValue)
        .then((results) => {
          if (searchRequestIdRef.current === currentRequestId) {
            setSearchResults(results || [])
          }
        })
        .catch(() => {
          if (searchRequestIdRef.current === currentRequestId) {
            setSearchResults([])
          }
        })
        .finally(() => {
          if (searchRequestIdRef.current === currentRequestId) {
            setIsSearching(false)
          }
        })
    } else {
      searchRequestIdRef.current += 1
      setSearchResults([])
      setShowDropdown(false)
      setIsSearching(false)
    }
  }

  const handleSelectPatient = (patient) => {
    onLoadPatient(patient)
    setShowDropdown(false)
    setSearchResults([])
  }

  const handleResetForm = () => {
    setSearchResults([])
    setShowDropdown(false)
    searchRequestIdRef.current += 1
    onResetForm()
  }

  return (
    <div className="admission-form-card">
      <div className="admission-form-card__header">
        <div className="admission-form-card__header-title-group">
          <UserPlus size={24} className="admission-form-card__icon" />
          <h2 className="admission-form-card__title">Ingreso y clasificacion de pacientes</h2>
        </div>
        <button
          type="button"
          className="admission-form__reset-btn admission-form__reset-btn--header"
          onClick={handleResetForm}
          title="Borrar todos los datos y volver a empezar"
          aria-label="Limpiar formulario"
          disabled={isSubmitting}
        >
          <RotateCcw size={15} />
          <span>Limpiar formulario</span>
        </button>
      </div>

      <form onSubmit={onSubmitForm} className="admission-form" noValidate>
        {/* Fila 1: DNI y Número de Llamado (sistema externo) */}
        <div className="admission-form__row">
          <div className="admission-form__field admission-form__field--relative" ref={dropdownRef}>
            <div className="admission-form__label-wrapper">
              <label htmlFor="admission-patient-dni" className="admission-form__label">
                DNI
              </label>
              {existingPatient && String(existingPatient.dni) === formData.dni && (
                <span className="admission-form__patient-badge">
                  <UserCheck size={12} /> {existingPatient.nombre} {existingPatient.apellido}
                  <button
                    type="button"
                    className="admission-form__badge-clear-btn"
                    onClick={handleResetForm}
                    title="Descartar paciente y limpiar formulario"
                    aria-label="Descartar paciente seleccionado"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
            <input
              id="admission-patient-dni"
              type="text"
              className={`admission-form__input ${
                validationErrors.dni ? 'admission-form__input--error' : ''
              }`}
              placeholder="ej: 38472910"
              value={formData.dni}
              onChange={handleDniInputChange}
              onFocus={() => {
                if (formData.dni?.length >= 2 && searchResults.length > 0) {
                  setShowDropdown(true)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowDropdown(false)
              }}
              autoComplete="off"
              aria-invalid={Boolean(validationErrors.dni)}
            />
            {validationErrors.dni && (
              <span className="admission-form__error-text">{validationErrors.dni}</span>
            )}

            {/* Dropdown predictivo de coincidencia de paciente */}
            <PatientDropdown
              isOpen={showDropdown && formData.dni?.length >= 2}
              isSearching={isSearching}
              results={searchResults}
              emptyMessage="Sin registros previos con este DNI (Paciente nuevo)"
              onSelectPatient={handleSelectPatient}
            />
          </div>

          <div className="admission-form__field">
            <label htmlFor="admission-call-seq" className="admission-form__label">
              N° de llamado (sistema externo)
            </label>
            <div
              className={`admission-form__call-group ${
                ticketNumberError ? 'admission-form__call-group--error' : ''
              }`}
            >
              <select
                id="admission-call-prefix"
                className="admission-form__prefix-select"
                value={formData.prefijoLlamado || 'Ext'}
                onChange={(event) => onFieldChange('prefijoLlamado', event.target.value)}
                aria-label="Prefijo de llamado externo"
              >
                <option value="Ext">Ext (Extracción)</option>
                <option value="G">G (Guardia)</option>
                <option value="Med">Med (Médicos)</option>
                <option value="Csl">Csl (Consulta)</option>
              </select>

              <span className="admission-form__call-dash">-</span>

              <input
                id="admission-call-seq"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className="admission-form__seq-input"
                placeholder="ej: 01"
                value={formData.numeroLlamado || ''}
                onChange={(event) => {
                  const numericOnly = event.target.value.replace(/\D/g, '')
                  onFieldChange('numeroLlamado', numericOnly)
                }}
                aria-invalid={Boolean(ticketNumberError)}
              />
            </div>
            {ticketNumberError && (
              <span className="admission-form__error-text" role="alert">
                {ticketNumberError}
              </span>
            )}
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

        {/* Fila 3: Nombre de la obra social y número de afiliado */}
        <div className="admission-form__row">
          <div className="admission-form__field">
            <label htmlFor="admission-patient-obra-social" className="admission-form__label">
              Nombre de la obra social
            </label>
            <input
              id="admission-patient-obra-social"
              type="text"
              className={`admission-form__input ${
                validationErrors.obraSocial ? 'admission-form__input--error' : ''
              }`}
              placeholder="ej: IOMA"
              value={formData.obraSocial ?? 'IOMA'}
              onChange={(event) => onFieldChange('obraSocial', event.target.value)}
              aria-invalid={Boolean(validationErrors.obraSocial)}
            />
            {validationErrors.obraSocial && (
              <span className="admission-form__error-text">{validationErrors.obraSocial}</span>
            )}
          </div>

          <div className="admission-form__field">
            <label htmlFor="admission-patient-numero-afiliado" className="admission-form__label">
              N° de afiliado
            </label>
            <input
              id="admission-patient-numero-afiliado"
              type="text"
              inputMode="numeric"
              className={`admission-form__input ${
                validationErrors.numeroAfiliado ? 'admission-form__input--error' : ''
              }`}
              placeholder="Número de afiliado"
              value={formData.numeroAfiliado}
              onChange={(event) =>
                onFieldChange('numeroAfiliado', event.target.value.replace(/\D/g, ''))
              }
              pattern="[0-9]*"
              autoComplete="off"
              aria-invalid={Boolean(validationErrors.numeroAfiliado)}
            />
            {validationErrors.numeroAfiliado && (
              <span className="admission-form__error-text">{validationErrors.numeroAfiliado}</span>
            )}
          </div>
        </div>

        {admissionError && (
          <div className="admission-form__alert" role="alert" aria-live="assertive">
            {admissionError}
          </div>
        )}

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

        {/* Acciones del Formulario */}
        <div className="admission-form__actions">
          <button
            type="button"
            className="admission-form__reset-btn"
            onClick={handleResetForm}
            disabled={isSubmitting}
            title="Borrar todos los datos del formulario y volver a empezar"
          >
            <RotateCcw size={16} />
            <span>Limpiar / Volver a empezar</span>
          </button>

          <button
            type="submit"
            className="admission-form__submit-btn"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Generando ticket...' : 'Emitir Ticket Asistencial'}
          </button>
        </div>
      </form>
    </div>
  )
}
