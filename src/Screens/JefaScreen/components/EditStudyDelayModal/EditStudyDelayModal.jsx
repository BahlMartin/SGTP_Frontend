import React, { useState, useEffect } from 'react'
import { X, Clock, AlertTriangle, CheckCircle, Calendar } from 'lucide-react'
import './EditStudyDelayModal.css'

const QUICK_DELAYS = [
  { label: '12 hs (Guardia)', hours: 12 },
  { label: '24 hs (1 día)', hours: 24 },
  { label: '48 hs (2 días)', hours: 48 },
  { label: '72 hs (3 días)', hours: 72 },
  { label: '96 hs (4 días)', hours: 96 },
  { label: '120 hs (5 días)', hours: 120 }
]

export default function EditStudyDelayModal({
  isOpen = false,
  study = null,
  onClose = () => {},
  onSave = async () => {}
}) {
  const [hours, setHours] = useState(24)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (study) {
      setHours(Number(study.demora_horas) || 24)
      setErrorMsg('')
    }
  }, [study, isOpen])

  if (!isOpen || !study) return null

  const daysEquivalent = (hours / 24).toFixed(1).replace('.0', '')
  const displayCode = study.codigo_practica || study.codigo || study.codigo_nomenclador || study.id

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    const numericHours = parseInt(hours, 10)
    if (isNaN(numericHours) || numericHours < 1 || numericHours > 720) {
      setErrorMsg('Por favor ingrese un tiempo válido entre 1 y 720 horas (máx. 30 días).')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        ...study,
        demora_horas: numericHours
      })
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Error al actualizar el tiempo de demora del estudio.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="study-delay-modal__backdrop"
      onClick={() => !isSaving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-delay-modal-title"
    >
      <div className="study-delay-modal__card" onClick={(e) => e.stopPropagation()}>
        <header className="study-delay-modal__header">
          <div className="study-delay-modal__title-box">
            <div className="study-delay-modal__icon-wrap">
              <Clock className="study-delay-modal__icon" size={20} />
            </div>
            <div>
              <h3 id="study-delay-modal-title" className="study-delay-modal__title">
                Tiempo de procesamiento del estudio
              </h3>
              <p className="study-delay-modal__subtitle">
                Configuración para cálculo automático de retiro en Box
              </p>
            </div>
          </div>
          <button
            type="button"
            className="study-delay-modal__close-btn"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="study-delay-modal__form">
          {errorMsg && (
            <div className="study-delay-modal__error" role="alert">
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Información del Estudio */}
          <div className="study-delay-modal__study-info">
            <div className="study-delay-modal__study-name-box">
              <span className="study-delay-modal__study-label">PRÁCTICA BIOQUÍMICA</span>
              <strong className="study-delay-modal__study-name">{study.nombre}</strong>
            </div>
            <div className="study-delay-modal__study-meta">
              <span className="study-delay-modal__code-pill">Cód. {displayCode}</span>
              {study.seccion && (
                <span className="study-delay-modal__section-pill">
                  {study.seccion}
                </span>
              )}
            </div>
          </div>

          {/* Input de Horas */}
          <div className="study-delay-modal__field">
            <label htmlFor="delay-hours-input" className="study-delay-modal__label">
              Demora estimada de resultados (en horas):
            </label>
            <div className="study-delay-modal__input-wrapper">
              <input
                id="delay-hours-input"
                type="number"
                min="1"
                max="720"
                step="1"
                className="study-delay-modal__input"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
                autoFocus
                disabled={isSaving}
              />
              <span className="study-delay-modal__unit">horas</span>
            </div>
          </div>

          {/* Botones de selección rápida */}
          <div className="study-delay-modal__quick-group">
            <span className="study-delay-modal__quick-title">Opciones sugeridas estándar:</span>
            <div className="study-delay-modal__quick-pills">
              {QUICK_DELAYS.map((preset) => (
                <button
                  key={preset.hours}
                  type="button"
                  className={`study-delay-modal__quick-pill ${
                    Number(hours) === preset.hours ? 'study-delay-modal__quick-pill--active' : ''
                  }`}
                  onClick={() => setHours(preset.hours)}
                  disabled={isSaving}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tarjeta explicativa de cálculo hábil */}
          <div className="study-delay-modal__calc-preview">
            <Calendar size={18} className="study-delay-modal__calc-icon" />
            <div className="study-delay-modal__calc-text">
              <strong>Equivale a ~{daysEquivalent} {Number(daysEquivalent) === 1 ? 'día hábil' : 'días hábiles'}</strong>
              <p>
                Al finalizar la extracción en Box, SGTP tomará el estudio de mayor demora de la orden y proyectará la fecha de entrega de lunes a viernes (posponiendo al lunes si cae sábado o domingo).
              </p>
            </div>
          </div>

          <footer className="study-delay-modal__footer">
            <button
              type="button"
              className="study-delay-modal__btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="study-delay-modal__btn-submit"
              disabled={isSaving}
            >
              <CheckCircle size={16} />
              {isSaving ? 'Guardando...' : 'Guardar tiempo de demora'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

