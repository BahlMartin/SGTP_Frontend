import React from 'react'
import { TRIAGE_LIST } from '../../../../constants/triage.constants'
import './TriageSelector.css'

/**
 * Componente para selección de categoría de Triage y captura
 * condicional de justificación técnica si se elige "Otro".
 */
export default function TriageSelector({
  selectedTriage = 'Guardia',
  justificationText = '',
  justificationError = null,
  onSelectTriage = () => {},
  onChangeJustification = () => {}
}) {
  return (
    <div className="triage-selector">
      <label className="triage-selector__label">Categoría de triage</label>

      <div className="triage-selector__grid" role="radiogroup" aria-label="Categorías de triage">
        {TRIAGE_LIST.map((triageItem) => {
          const isSelected = selectedTriage === triageItem.key

          return (
            <button
              type="button"
              key={triageItem.id}
              role="radio"
              aria-checked={isSelected}
              className={`triage-selector__card ${isSelected ? 'triage-selector__card--selected' : ''}`}
              onClick={() => onSelectTriage(triageItem.key)}
            >
              <span className={`triage-selector__dot triage-selector__dot--${triageItem.id}`} />
              <div className="triage-selector__text">
                <span className="triage-selector__item-label">{triageItem.label}</span>
                <span className="triage-selector__item-desc">{triageItem.subtitle}</span>
              </div>
            </button>
          )
        })}
      </div>

      {selectedTriage === 'Otro' && (
        <div className="triage-selector__justification">
          <label htmlFor="admission-justification-otro" className="triage-selector__justification-label">
            Justificación técnica requerida:
          </label>
          <textarea
            id="admission-justification-otro"
            className={`triage-selector__justification-input ${
              justificationError ? 'triage-selector__justification-input--error' : ''
            }`}
            rows={2}
            placeholder="Indique motivo clínico o derivación especial..."
            value={justificationText}
            onChange={(event) => onChangeJustification(event.target.value)}
          />
          {justificationError && (
            <span className="triage-selector__error-text">{justificationError}</span>
          )}
        </div>
      )}
    </div>
  )
}
