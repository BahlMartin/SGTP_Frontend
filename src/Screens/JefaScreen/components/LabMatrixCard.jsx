import React, { useState, useEffect } from 'react'
import { Search, X, Calendar, Clock, Pencil, BookOpen, Layers } from 'lucide-react'
import { getTodayLocalDateString } from '../../../utils/formatters'
import { fetchStudiesApi, updateStudyApi } from '../../../services/studyService'
import EditStudyDelayModal from './EditStudyDelayModal/EditStudyDelayModal'
import './LabMatrixCard.css'

export default function LabMatrixCard({
  labStudies = [],
  selectedDate = '',
  onDateChange = () => {},
  searchQuery = '',
  onSearchChange = () => {},
  onClearSearch = () => {},
  isLoading = false,
  filterMode = 'all',
  onFilterChange,
  onNotice = () => {}
}) {
  const [viewMode, setViewMode] = useState('activity') // 'activity' | 'delays'
  const [localFilterMode, setLocalFilterMode] = useState('all')

  // Catálogo completo de estudios para gestión de demoras
  const [catalogStudies, setCatalogStudies] = useState([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [studyToEdit, setStudyToEdit] = useState(null)

  const todayStr = getTodayLocalDateString()
  const isToday = !selectedDate || selectedDate === todayStr

  const activeFilter = onFilterChange ? filterMode : localFilterMode
  const handleFilterChange = (mode) => {
    if (onFilterChange) {
      onFilterChange(mode)
    } else {
      setLocalFilterMode(mode)
    }
  }

  // Cargar catálogo de estudios cuando se activa la pestaña de 'delays'
  useEffect(() => {
    if (viewMode === 'delays') {
      let isMounted = true
      setLoadingCatalog(true)
      const timer = setTimeout(() => {
        fetchStudiesApi(catalogSearch)
          .then((data) => {
            if (isMounted) {
              setCatalogStudies(Array.isArray(data) ? data : [])
            }
          })
          .catch((err) => {
            console.error('Error al cargar catálogo de estudios:', err)
          })
          .finally(() => {
            if (isMounted) setLoadingCatalog(false)
          })
      }, catalogSearch ? 250 : 0)

      return () => {
        isMounted = false
        clearTimeout(timer)
      }
    }
  }, [viewMode, catalogSearch])

  const displayedStudies = activeFilter === 'top5'
    ? labStudies.slice(0, 5)
    : labStudies

  const isSearchActive = viewMode === 'activity'
    ? Boolean(searchQuery && searchQuery.trim())
    : Boolean(catalogSearch && catalogSearch.trim())

  const handleSaveDelay = async (updatedStudy) => {
    const studyId = updatedStudy.id || updatedStudy.id_estudio
    const payload = {
      demora_horas: updatedStudy.demora_horas
    }

    await updateStudyApi(studyId, payload)
    
    // Actualizar catálogo local si está en modo catálogo
    setCatalogStudies((prev) =>
      prev.map((s) => (s.id === studyId ? { ...s, demora_horas: updatedStudy.demora_horas } : s))
    )

    // Notificar al usuario
    const days = (updatedStudy.demora_horas / 24).toFixed(1).replace('.0', '')
    onNotice(`Demora de "${updatedStudy.nombre}" actualizada a ${updatedStudy.demora_horas} hs (~${days} días hábiles).`)
  }

  return (
    <div className="jefa-screen__matrix-card">
      <div className="jefa-screen__matrix-header">
        <div className="jefa-screen__matrix-header-title-box">
          <h3 className="jefa-screen__section-title">Estudios de laboratorio</h3>
          <div className="jefa-screen__matrix-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'activity'}
              className={`jefa-screen__matrix-mode-btn ${viewMode === 'activity' ? 'jefa-screen__matrix-mode-btn--active' : ''}`}
              onClick={() => setViewMode('activity')}
              title="Ver estudios solicitados por fecha"
            >
              <Layers size={13} />
              <span>Actividad</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'delays'}
              className={`jefa-screen__matrix-mode-btn ${viewMode === 'delays' ? 'jefa-screen__matrix-mode-btn--active' : ''}`}
              onClick={() => setViewMode('delays')}
              title="Configurar tiempos de demora de cada estudio"
            >
              <Clock size={13} />
              <span>Demoras</span>
            </button>
          </div>
        </div>

        {viewMode === 'activity' && (
          <div className="jefa-screen__matrix-date-box">
            <div className="jefa-screen__date-picker-wrap" title="Seleccionar fecha de estudios">
              <Calendar size={13} className="jefa-screen__date-icon" />
              <input
                type="date"
                className="jefa-screen__date-input"
                value={selectedDate || todayStr}
                onChange={(e) => onDateChange(e.target.value)}
                max={todayStr}
                aria-label="Filtrar estudios por fecha"
              />
            </div>
            {!isToday && (
              <button
                type="button"
                className="jefa-screen__date-today-btn"
                onClick={() => onDateChange(todayStr)}
                title="Volver a la fecha de hoy"
              >
                Hoy
              </button>
            )}
          </div>
        )}
      </div>

      <div className="jefa-screen__matrix-toolbar">
        <div className="jefa-screen__matrix-search-bar">
          <Search size={14} className="jefa-screen__matrix-search-icon" />
          <input
            type="text"
            className="jefa-screen__matrix-search-input"
            placeholder={
              viewMode === 'activity'
                ? 'Buscar estudio del día (ej. Ácido Láctico)...'
                : 'Buscar estudio en catálogo para editar demora...'
            }
            value={viewMode === 'activity' ? searchQuery : catalogSearch}
            onChange={(e) => {
              if (viewMode === 'activity') {
                onSearchChange(e.target.value)
              } else {
                setCatalogSearch(e.target.value)
              }
            }}
            aria-label="Buscar estudio"
          />
          {isSearchActive && (
            <button
              type="button"
              className="jefa-screen__matrix-clear-btn"
              onClick={() => {
                if (viewMode === 'activity') {
                  onClearSearch()
                } else {
                  setCatalogSearch('')
                }
              }}
              title="Limpiar búsqueda"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {viewMode === 'activity' ? (
          <div className="jefa-screen__matrix-filter-row">
            <div className="jefa-screen__matrix-pills" role="tablist" aria-label="Filtro de cantidad de estudios">
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === 'all'}
                className={`jefa-screen__matrix-pill ${activeFilter === 'all' ? 'jefa-screen__matrix-pill--active' : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                Todos ({labStudies.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === 'top5'}
                className={`jefa-screen__matrix-pill ${activeFilter === 'top5' ? 'jefa-screen__matrix-pill--active' : ''}`}
                onClick={() => handleFilterChange('top5')}
              >
                Top 5
              </button>
            </div>

            <span className="jefa-screen__matrix-count-info">
              {isSearchActive
                ? `${displayedStudies.length} ${displayedStudies.length === 1 ? 'coincidencia' : 'coincidencias'}`
                : activeFilter === 'top5' && labStudies.length > 5
                  ? `Mostrando 5 de ${labStudies.length}`
                  : `${labStudies.length} ${labStudies.length === 1 ? 'estudio' : 'estudios'}`}
            </span>
          </div>
        ) : (
          <div className="jefa-screen__matrix-filter-row">
            <span className="jefa-screen__matrix-hint">
              Haga clic en el lápiz de cualquier práctica para modificar sus horas de demora.
            </span>
            <span className="jefa-screen__matrix-count-info">
              {catalogStudies.length} {catalogStudies.length === 1 ? 'estudio' : 'estudios'}
            </span>
          </div>
        )}
      </div>

      {/* VISTA 1: ACTIVIDAD DIARIA */}
      {viewMode === 'activity' && (
        <>
          {isLoading ? (
            <div className="jefa-screen__matrix-loading">
              <span className="jefa-screen__mini-spinner" />
              <span>Consultando estudios...</span>
            </div>
          ) : (
            <ul className="jefa-screen__matrix-table">
              {displayedStudies.map((study) => {
                const horas = study.demora_horas || 24
                const dias = (horas / 24).toFixed(1).replace('.0', '')
                return (
                  <li key={study.id || study.nombre} className="jefa-screen__matrix-row">
                    <div className="jefa-screen__matrix-cat">
                      <div className="jefa-screen__matrix-cat-title-row">
                        <span className="jefa-screen__matrix-cat-name">{study.nombre}</span>
                        <button
                          type="button"
                          className="jefa-screen__matrix-btn-edit-delay"
                          onClick={() => setStudyToEdit(study)}
                          title={`Editar tiempo de demora de ${study.nombre} (actual: ${horas} hs)`}
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                      <div className="jefa-screen__matrix-meta-row">
                        {study.codigo && (
                          <span className="jefa-screen__matrix-cat-code">{study.codigo}</span>
                        )}
                        <span className="jefa-screen__matrix-delay-badge" title="Demora estimada en laboratorio">
                          <Clock size={10} />
                          {horas} hs (~{dias}d)
                        </span>
                      </div>
                    </div>
                    <div className="jefa-screen__matrix-stat">
                      <span className="jefa-screen__matrix-total">{study.total}</span>
                      <span className="jefa-screen__matrix-total-label">estudios</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {displayedStudies.length === 0 && !isLoading && (
            <div className="jefa-screen__matrix-empty-wrap">
              <p className="jefa-screen__matrix-empty">
                {isSearchActive
                  ? `No se encontraron estudios con "${searchQuery}" en la fecha.`
                  : 'No hay estudios registrados en esta fecha.'}
              </p>
              {isSearchActive && (
                <button
                  type="button"
                  className="jefa-screen__matrix-reset-btn"
                  onClick={onClearSearch}
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* VISTA 2: CATÁLOGO MAESTRO Y TIEMPOS DE DEMORA */}
      {viewMode === 'delays' && (
        <>
          {loadingCatalog ? (
            <div className="jefa-screen__matrix-loading">
              <span className="jefa-screen__mini-spinner" />
              <span>Cargando catálogo maestro...</span>
            </div>
          ) : (
            <ul className="jefa-screen__matrix-table jefa-screen__matrix-table--catalog">
              {catalogStudies.map((study) => {
                const horas = study.demora_horas || 24
                const dias = (horas / 24).toFixed(1).replace('.0', '')
                return (
                  <li key={study.id} className="jefa-screen__matrix-row jefa-screen__matrix-row--interactive" onClick={() => setStudyToEdit(study)}>
                    <div className="jefa-screen__matrix-cat">
                      <div className="jefa-screen__matrix-cat-title-row">
                        <span className="jefa-screen__matrix-cat-name">{study.nombre}</span>
                      </div>
                      <div className="jefa-screen__matrix-meta-row">
                        <span className="jefa-screen__matrix-cat-code">Cód: {study.codigo_practica}</span>
                        {study.seccion && (
                          <span className="jefa-screen__matrix-cat-section">{study.seccion}</span>
                        )}
                      </div>
                    </div>
                    <div className="jefa-screen__matrix-delay-action">
                      <div className="jefa-screen__matrix-delay-info">
                        <strong className="jefa-screen__matrix-delay-hours">{horas} hs</strong>
                        <span className="jefa-screen__matrix-delay-days">~{dias} {Number(dias) === 1 ? 'día hábil' : 'días hábiles'}</span>
                      </div>
                      <button
                        type="button"
                        className="jefa-screen__matrix-edit-pill-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setStudyToEdit(study)
                        }}
                        title={`Editar tiempo de demora de ${study.nombre}`}
                      >
                        <Pencil size={12} />
                        <span>Editar</span>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {catalogStudies.length === 0 && !loadingCatalog && (
            <div className="jefa-screen__matrix-empty-wrap">
              <p className="jefa-screen__matrix-empty">
                {catalogSearch
                  ? `No se encontraron prácticas con "${catalogSearch}".`
                  : 'No se encontraron estudios en el catálogo.'}
              </p>
              {catalogSearch && (
                <button
                  type="button"
                  className="jefa-screen__matrix-reset-btn"
                  onClick={() => setCatalogSearch('')}
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal para editar horas de demora */}
      <EditStudyDelayModal
        isOpen={Boolean(studyToEdit)}
        study={studyToEdit}
        onClose={() => setStudyToEdit(null)}
        onSave={handleSaveDelay}
      />
    </div>
  )
}
