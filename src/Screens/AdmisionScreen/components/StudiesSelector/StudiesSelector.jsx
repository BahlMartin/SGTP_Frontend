import React, { useState, useEffect } from 'react'
import { Sparkles, Check, PlusCircle } from 'lucide-react'
import { AVAILABLE_STUDIES } from '../../../../constants/admision.constants'
import { fetchStudiesApi } from '../../../../services/studyService'
import './StudiesSelector.css'

/**
 * Componente para selección de estudios médicos solicitados
 * sincronizado con el catálogo de Estudios del backend y disparador del modal OCR.
 */
export default function StudiesSelector({
  selectedStudies = [],
  onToggleStudy = () => {},
  onOpenOcrModal = () => {}
}) {
  const [studiesCatalog, setStudiesCatalog] = useState(AVAILABLE_STUDIES)

  useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      try {
        const studiesFromApi = await fetchStudiesApi()
        if (isMounted && Array.isArray(studiesFromApi) && studiesFromApi.length > 0) {
          const names = studiesFromApi.map((s) => s.nombre)
          setStudiesCatalog(names)
        }
      } catch (err) {
        console.warn('Utilizando catálogo local de estudios:', err)
      }
    }
    loadCatalog()
    return () => {
      isMounted = false
    }
  }, [])

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
        {studiesCatalog.map((studyName) => {
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
