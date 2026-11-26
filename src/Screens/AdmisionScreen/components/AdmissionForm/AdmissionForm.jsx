import React, { useState, useEffect, useRef } from 'react'
import { UserPlus, UserCheck, RotateCcw, AlertTriangle, Bell, UserX } from 'lucide-react'
import TriageSelector from '../TriageSelector/TriageSelector'
import StudiesSelector from '../../../../components/StudiesSelector/StudiesSelector'
import PatientDropdown from '../../../../components/PatientDropdown/PatientDropdown'
import { searchPatientsApi } from '../../../../services/ticketService'
import { splitAffiliateNumber, composeAffiliateNumber, normalizeAffiliateSuffix } from '../../../../utils/affiliateNumber.utils'
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
  unregisteredPatientAlert = '',
  onCallNextPatient = () => {},
  hasPendingTurnos = false,
  pendingTurnosCount = 0,
  isCallingTurno = false,
  hasActiveTurno = false,
  isReceptionTurnActive = false,
  onCallNumberBlur = () => {},
  onCancelActiveTurno = () => {},
  onLoadPatient = () => {},
  onFieldChange = () => {},
  numeroAfiliadoBase,
  numeroAfiliadoSufijo,
  onAffiliateBaseChange,
  onAffiliateSuffixChange,
  onAffiliateSuffixBlur,
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
  const searchTimeoutRef = useRef(null)
  const searchAbortRef = useRef(null)

  const fallbackParts = splitAffiliateNumber(formData.numeroAfiliado)
  const effectiveAffiliateBase =
    numeroAfiliadoBase !== undefined ? numeroAfiliadoBase : fallbackParts.base
  const effectiveAffiliateSuffix =
    numeroAfiliadoSufijo !== undefined ? numeroAfiliadoSufijo : fallbackParts.suffix

  const handleBaseChange = (rawVal) => {
    if (onAffiliateBaseChange) {
      onAffiliateBaseChange(rawVal)
    } else {
      const cleanBase = String(rawVal || '').replace(/\D/g, '')
      onFieldChange('numeroAfiliado', composeAffiliateNumber(cleanBase, effectiveAffiliateSuffix))
    }
  }

  const handleSuffixChange = (rawVal) => {
    if (onAffiliateSuffixChange) {
      onAffiliateSuffixChange(rawVal)
    } else {
      const cleanSuffix = String(rawVal || '').replace(/\D/g, '').slice(0, 2)
      onFieldChange('numeroAfiliado', composeAffiliateNumber(effectiveAffiliateBase, cleanSuffix))
    }
  }

  const handleSuffixBlur = () => {
    if (onAffiliateSuffixBlur) {
      onAffiliateSuffixBlur()
    } else if (effectiveAffiliateBase) {
      const padded = normalizeAffiliateSuffix(effectiveAffiliateSuffix)
      onFieldChange('numeroAfiliado', composeAffiliateNumber(effectiveAffiliateBase, padded))
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
      }
    }
  }, [])

  const handleDniInputChange = (event) => {
    const numericOnlyValue = event.target.value.replace(/\D/g, '')
    onFieldChange('dni', numericOnlyValue)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
      searchAbortRef.current = null
    }

    if (numericOnlyValue.length >= 2) {
      setIsSearching(true)
      setShowDropdown(true)
      const currentRequestId = ++searchRequestIdRef.current

      searchTimeoutRef.current = setTimeout(() => {
        const controller = new AbortController()
        searchAbortRef.current = controller

        searchPatientsApi(numericOnlyValue, { scope: 'dni', signal: controller.signal })
          .then((results) => {
            if (searchRequestIdRef.current === currentRequestId) {
              setSearchResults(results || [])
              setShowDropdown(true)
            }
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return
            if (searchRequestIdRef.current === currentRequestId) {
              setSearchResults([])
            }
          })
          .finally(() => {
            if (searchRequestIdRef.current === currentRequestId) {
              setIsSearching(false)
            }
          })
      }, 250)
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
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
      searchAbortRef.current = null
    }
    setSearchResults([])
    setShowDropdown(false)
    setIsSearching(false)
    searchRequestIdRef.current += 1
    onResetForm()
  }

  const isCallLocked = Boolean(isReceptionTurnActive)

  return (
    <div className="admission-form-card">
      <div className="admission-form-card__header">
        <div className="admission-form-card__header-title-group">
          <UserPlus size={24} className="admission-form-card__icon" />
          <h2 className="admission-form-card__title">Ingreso y clasificación de pacientes</h2>
        </div>
        <div className="admission-form-card__header-actions">
          <button
            type="button"
            className="admission-form__call-next-btn"
            onClick={onCallNextPatient}
            disabled={isSubmitting || isCallingTurno || !hasPendingTurnos || hasActiveTurno}
            title={
              hasActiveTurno
                ? 'Ya hay un paciente en atención. Emita el ticket o cancele el turno actual antes de llamar a otro.'
                : hasPendingTurnos
                  ? `Llamar al siguiente paciente en espera (${pendingTurnosCount} pendientes)`
                  : 'No hay pacientes en cola de espera de recepción'
            }
            aria-label="Llamar al siguiente paciente en espera"
          >
            <Bell
              size={15}
              className={hasPendingTurnos && !hasActiveTurno ? 'admission-form__call-next-icon--pulse' : ''}
            />
            <span>{isCallingTurno ? 'Llamando...' : 'Llamar al siguiente'}</span>
          </button>

          <button
            type="button"
            className="admission-form__cancel-turno-btn"
            onClick={onCancelActiveTurno}
            disabled={isSubmitting || (!hasActiveTurno && !formData.dni && !formData.numeroLlamado)}
            title={
              hasActiveTurno
                ? 'Cancelar el turno del paciente actual por ausencia y limpiar formulario'
                : 'Cancelar y limpiar datos del formulario'
            }
            aria-label="Cancelar turno y limpiar formulario"
          >
            <UserX size={15} />
            <span>Cancelar</span>
          </button>

          <button
            type="button"
            className="admission-form__reset-btn admission-form__reset-btn--header"
            onClick={handleResetForm}
            title={
              hasActiveTurno
                ? 'Limpiar los campos editables manteniendo el turno convocado activo (use Cancelar para liberar el turno)'
                : 'Borrar todos los datos y volver a empezar'
            }
            aria-label="Limpiar formulario"
            disabled={isSubmitting}
          >
            <RotateCcw size={15} />
            <span>Limpiar formulario</span>
          </button>
        </div>
      </div>

      <form onSubmit={onSubmitForm} className="admission-form" noValidate>
        {unregisteredPatientAlert && (
          <div className="admission-form__unregistered-alert" role="alert">
            <AlertTriangle size={20} className="admission-form__unregistered-alert-icon" />
            <div className="admission-form__unregistered-alert-text">
              <strong>Paciente no registrado:</strong> {unregisteredPatientAlert}
            </div>
          </div>
        )}
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
              N° de llamado (sistema externo) <span className="admission-form__required-dot">*</span>
            </label>
            <div
              className={`admission-form__call-group ${
                isCallLocked ? 'admission-form__call-group--locked' : ''
              } ${
                (ticketNumberError || validationErrors.numeroLlamado)
                  ? 'admission-form__call-group--error'
                  : ''
              }`}
            >
              <select
                id="admission-call-prefix"
                className="admission-form__prefix-select"
                value={formData.prefijoLlamado || 'Ext'}
                disabled={isCallLocked || isSubmitting}
                onChange={(event) => onFieldChange('prefijoLlamado', event.target.value)}
                onBlur={(event) => {
                  if (!isCallLocked) onCallNumberBlur(event)
                }}
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
                readOnly={isCallLocked}
                disabled={isCallLocked || isSubmitting}
                onChange={(event) => {
                  if (isCallLocked) return
                  const numericOnly = event.target.value.replace(/\D/g, '')
                  onFieldChange('numeroLlamado', numericOnly)
                }}
                onBlur={(event) => {
                  if (!isCallLocked) onCallNumberBlur(event)
                }}
                aria-required="true"
                aria-readonly={isCallLocked}
                aria-invalid={Boolean(ticketNumberError || validationErrors.numeroLlamado)}
              />
            </div>
            {(ticketNumberError || validationErrors.numeroLlamado) && (
              <span className="admission-form__error-text" role="alert">
                {ticketNumberError || validationErrors.numeroLlamado}
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
              N° de afiliado <span className="admission-form__required-dot">*</span>
            </label>
            <div
              className={`admission-form__call-group ${
                validationErrors.numeroAfiliado ? 'admission-form__call-group--error' : ''
              }`}
            >
              <input
                id="admission-patient-numero-afiliado"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="admission-form__affiliate-base-input"
                placeholder="ej: 34567"
                value={effectiveAffiliateBase}
                onChange={(event) => handleBaseChange(event.target.value)}
                onBlur={handleSuffixBlur}
                autoComplete="off"
                aria-required="true"
                aria-invalid={Boolean(validationErrors.numeroAfiliado)}
              />

              <span className="admission-form__call-dash">-</span>

              <input
                id="admission-patient-numero-afiliado-sufijo"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                className="admission-form__affiliate-suffix-input"
                placeholder="00"
                value={effectiveAffiliateSuffix}
                onChange={(event) => handleSuffixChange(event.target.value)}
                onBlur={handleSuffixBlur}
                autoComplete="off"
                aria-label="Sufijo de número de afiliado"
                aria-required="true"
                aria-invalid={Boolean(validationErrors.numeroAfiliado)}
              />
            </div>
            {validationErrors.numeroAfiliado && (
              <span className="admission-form__error-text" role="alert">
                {validationErrors.numeroAfiliado}
              </span>
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
          showOcrButton={true}
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
