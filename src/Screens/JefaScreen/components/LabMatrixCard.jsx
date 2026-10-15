import React, { useState } from 'react'
import { Search, X, Calendar } from 'lucide-react'
import { getTodayLocalDateString } from '../../../utils/formatters'
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
  onFilterChange
}) {
  const [localFilterMode, setLocalFilterMode] = useState('all')
  const todayStr = getTodayLocalDateString()
  const isToday = !selectedDate || selectedDate === todayStr
  const isSearchActive = Boolean(searchQuery && searchQuery.trim())

  const activeFilter = onFilterChange ? filterMode : localFilterMode
  const handleFilterChange = (mode) => {
    if (onFilterChange) {
      onFilterChange(mode)
    } else {
      setLocalFilterMode(mode)
    }
  }

  const displayedStudies = activeFilter === 'top5'
    ? labStudies.slice(0, 5)
    : labStudies

  return (
    <div className="jefa-screen__matrix-card">
      <div className="jefa-screen__matrix-header">
        <div className="jefa-screen__matrix-header-title-box">
          <h3 className="jefa-screen__section-title">Estudios de laboratorio</h3>
          <span className="jefa-screen__matrix-badge">
            {isSearchActive ? 'Búsqueda' : activeFilter === 'top5' ? 'Top 5' : 'Todos'}
          </span>
        </div>
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
      </div>

      <div className="jefa-screen__matrix-toolbar">
        <div className="jefa-screen__matrix-search-bar">
          <Search size={14} className="jefa-screen__matrix-search-icon" />
          <input
            type="text"
            className="jefa-screen__matrix-search-input"
            placeholder="Buscar estudio (ej. Ácido Láctico)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar estudio específico"
          />
          {isSearchActive && (
            <button
              type="button"
              className="jefa-screen__matrix-clear-btn"
              onClick={onClearSearch}
              title="Limpiar búsqueda"
            >
              <X size={13} />
            </button>
          )}
        </div>

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
      </div>

      {isLoading ? (
        <div className="jefa-screen__matrix-loading">
          <span className="jefa-screen__mini-spinner" />
          <span>Consultando estudios...</span>
        </div>
      ) : (
        <ul className="jefa-screen__matrix-table">
          {displayedStudies.map((study) => (
            <li key={study.id || study.nombre} className="jefa-screen__matrix-row">
              <div className="jefa-screen__matrix-cat">
                <span className="jefa-screen__matrix-cat-name">{study.nombre}</span>
                {study.codigo && (
                  <span className="jefa-screen__matrix-cat-code">{study.codigo}</span>
                )}
              </div>
              <div className="jefa-screen__matrix-stat">
                <span className="jefa-screen__matrix-total">{study.total}</span>
                <span className="jefa-screen__matrix-total-label">estudios</span>
              </div>
            </li>
          ))}
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
    </div>
  )
}
