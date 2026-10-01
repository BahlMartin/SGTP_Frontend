import React from 'react'
import { Sparkles, Check, PlusCircle } from 'lucide-react'
import { AVAILABLE_STUDIES } from '../../../../constants/admision.constants'
import './StudiesSelector.css'

/**
 * Componente para selección de estudios médicos solicitados
 * mediante chips de acceso rápido y disparador del modal de escaneo OCR con IA.
 */
export default function StudiesSelector({
  selectedStudies = [],
  onToggleStudy = () => {},
  onOpenOcrModal = () => {}
}) {
  return (
    <div className="studies-selector">
      <div className="studies-selector__header">
        <label className="studies-selector__label">Estudios solicitados</label>
        <button
          type="button"
          className="studies-selector__ocr-btn"
          onClick={onOpenOcrModal}
        >
          <Sparkles size={16} />
          Escanear Receta con IA (OCR)
        </button>
      </div>

      <div className="studies-selector__tags">
        {AVAILABLE_STUDIES.map((studyName) => {
          const isSelected = selectedStudies.includes(studyName)

          return (
            <button
              type="button"
              key={studyName}
              className={`studies-selector__chip ${isSelected ? 'studies-selector__chip--active' : ''}`}
              onClick={() => onToggleStudy(studyName)}
              aria-pressed={isSelected}
            >
              {isSelected ? <Check size={14} /> : <PlusCircle size={14} />}
              {studyName}
            </button>
          )
        })}
      </div>

      {selectedStudies.length > 0 && (
        <div className="studies-selector__summary">
          <span>Cargados ({selectedStudies.length}): </span>
          <strong>{selectedStudies.join(', ')}</strong>
        </div>
      )}
    </div>
  )
}
