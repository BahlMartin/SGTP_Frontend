import React, { useEffect, useRef, useState } from 'react'
import { Check, Search, Sparkles, X } from 'lucide-react'
import { fetchStudiesApi } from '../../../../services/studyService'
import './StudiesSelector.css'

/**
 * Componente para buscar y seleccionar estudios médicos solicitados.
 */
export default function StudiesSelector({
  selectedStudies = [],
  onToggleStudy = () => {},
  onOpenOcrModal = () => {}
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [studiesResults, setStudiesResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchContainerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (mouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(mouseEvent.target)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) {
      return undefined
    }

    let isCurrentSearch = true
    const searchTimeout = setTimeout(async () => {
      try {
        const studiesFromApi = await fetchStudiesApi(query)
        if (isCurrentSearch) {
          const studyNames = studiesFromApi
            .map((study) => (typeof study === 'string' ? study : study.nombre))
            .filter(Boolean)
          setStudiesResults(studyNames)
        }
      } catch (error) {
        console.error('Error al buscar estudios:', error)
        if (isCurrentSearch) {
          setStudiesResults([])
          setSearchError('No se pudo buscar en el catálogo de estudios. Intente nuevamente.')
        }
      } finally {
        if (isCurrentSearch) {
          setIsSearching(false)
        }
      }
    }, 250)

    return () => {
      isCurrentSearch = false
      clearTimeout(searchTimeout)
    }
  }, [searchQuery])

  const handleSelectStudy = (studyName) => {
    onToggleStudy(studyName)
    setSearchQuery('')
    setStudiesResults([])
    setIsSearching(false)
    setSearchError('')
    setShowDropdown(false)
  }

  return (
    <div className="studies-selector">
      <div className="studies-selector__header">
        <label className="studies-selector__label" htmlFor="admission-study-search">
          Estudios solicitados
        </label>
        <button
          type="button"
          className="studies-selector__ocr-btn"
          onClick={onOpenOcrModal}
        >
          <Sparkles size={16} />
          Escanear Receta con IA (OCR)
        </button>
      </div>

      {selectedStudies.length > 0 && (
        <div className="studies-selector__selected" aria-label="Estudios seleccionados">
          {selectedStudies.map((studyName) => (
            <span className="studies-selector__selected-chip" key={studyName}>
              <Check size={14} aria-hidden="true" />
              {studyName}
              <button
                type="button"
                className="studies-selector__remove-btn"
                onClick={() => onToggleStudy(studyName)}
                aria-label={`Quitar ${studyName}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="studies-selector__search" ref={searchContainerRef}>
        <div className="studies-selector__input-wrapper">
          <input
            id="admission-study-search"
            type="search"
            className="studies-selector__input"
            placeholder="Escriba para buscar estudios..."
            value={searchQuery}
            onChange={(event) => {
              const nextQuery = event.target.value
              setSearchQuery(nextQuery)
              setStudiesResults([])
              setIsSearching(Boolean(nextQuery.trim()))
              setSearchError('')
              setShowDropdown(Boolean(nextQuery.trim()))
            }}
            onFocus={() => searchQuery.trim() && setShowDropdown(true)}
            aria-expanded={showDropdown}
            aria-controls="admission-study-results"
            autoComplete="off"
          />
          <Search className="studies-selector__search-icon" aria-hidden="true" />
        </div>

        {showDropdown && searchQuery.trim() && (
          <div className="studies-selector__dropdown" id="admission-study-results">
            {isSearching ? (
              <div className="studies-selector__status" role="status">
                Buscando estudios...
              </div>
            ) : searchError ? (
              <div className="studies-selector__status studies-selector__status--error" role="alert">
                {searchError}
              </div>
            ) : studiesResults.filter((study) => !selectedStudies.includes(study)).length === 0 ? (
              <div className="studies-selector__status">
                No se encontraron estudios disponibles.
              </div>
            ) : (
              <ul className="studies-selector__results">
                {studiesResults
                  .filter((study) => !selectedStudies.includes(study))
                  .map((studyName) => (
                    <li key={studyName}>
                      <button
                        type="button"
                        className="studies-selector__result"
                        onClick={() => handleSelectStudy(studyName)}
                      >
                        <span className="studies-selector__result-icon">
                          <Check size={14} />
                        </span>
                        {studyName}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
