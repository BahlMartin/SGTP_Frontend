import React, { useMemo } from 'react'
import { Search, X, Calendar, RotateCcw } from 'lucide-react'
import {
  CATEGORIAS_CONFIG,
  RESULTADOS_CONFIG,
  ROLES_CONFIG
} from '../constants/auditoriaConstants'
import './FiltrosActividad.css'

export default function FiltrosActividad({
  filtros,
  onFiltroChange,
  onResetFiltros,
  isAdmin = false
}) {
  const periodos = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
    { id: '7d', label: 'Últimos 7 días' },
    { id: '30d', label: 'Últimos 30 días' },
    { id: 'custom', label: 'Personalizado' }
  ]

  const rolesDisponibles = Object.entries(ROLES_CONFIG).filter(([key]) => {
    if (!isAdmin && key === 'Admin') return false
    return true
  })

  // Detectar cuál filtro rápido de KPI está actualmente activo
  const selectedKpiVal = useMemo(() => {
    if (filtros.categoria === 'acceso') return 'logins'
    if (filtros.resultado === 'FALLO') return 'fallidos'
    if (filtros.accion === 'ATENCION_CANCELADA') return 'cancelaciones'
    if (filtros.ocr) return 'ocr'
    if (filtros.solo_alertas) return 'alertas'
    if (filtros.personal_activo) return 'personal_activo'
    return ''
  }, [filtros])

  // Aplicar selección del menú de KPIs superiores
  const handleKpiQuickSelect = (val) => {
    const cleanFields = {
      categoria: '',
      resultado: '',
      accion: '',
      ocr: false,
      solo_alertas: false,
      personal_activo: false
    }

    if (!val) {
      onFiltroChange(cleanFields)
      return
    }

    const mapFilters = {
      logins: { ...cleanFields, categoria: 'acceso' },
      fallidos: { ...cleanFields, resultado: 'FALLO' },
      cancelaciones: { ...cleanFields, accion: 'ATENCION_CANCELADA' },
      ocr: { ...cleanFields, ocr: true },
      alertas: { ...cleanFields, solo_alertas: true },
      personal_activo: { ...cleanFields, personal_activo: true }
    }

    onFiltroChange(mapFilters[val] || cleanFields)
  }

  const hasActiveFilters = Boolean(
    filtros.q ||
      filtros.rol ||
      filtros.categoria ||
      filtros.accion ||
      filtros.resultado ||
      filtros.solo_alertas ||
      filtros.personal_activo ||
      filtros.ocr ||
      filtros.periodo !== 'hoy' ||
      filtros.desde ||
      filtros.hasta
  )

  const handlePeriodoSelect = (p) => {
    if (p === 'custom') {
      onFiltroChange({ periodo: 'custom' })
    } else {
      onFiltroChange({
        periodo: p,
        desde: '',
        hasta: ''
      })
    }
  }

  return (
    <div className="filtros-actividad" role="search" aria-label="Filtros de auditoría">
      {/* 1. Barra superior: Presets de período y Fechas personalizadas */}
      <div className="filtros-actividad__periodo-bar">
        <div className="filtros-actividad__periodo-pills">
          <Calendar size={15} className="filtros-actividad__periodo-icon" aria-hidden="true" />
          <span className="filtros-actividad__periodo-label">Período:</span>
          {periodos.map((p) => {
            const isSelected = filtros.periodo === p.id
            return (
              <button
                key={p.id}
                type="button"
                className={`filtros-actividad__periodo-btn ${
                  isSelected ? 'filtros-actividad__periodo-btn--active' : ''
                }`}
                onClick={() => handlePeriodoSelect(p.id)}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {filtros.periodo === 'custom' && (
          <div className="filtros-actividad__custom-dates">
            <label className="filtros-actividad__date-field">
              <span>Desde:</span>
              <input
                type="date"
                value={filtros.desde || ''}
                onChange={(e) => onFiltroChange({ desde: e.target.value })}
                className="filtros-actividad__date-input"
              />
            </label>
            <label className="filtros-actividad__date-field">
              <span>Hasta:</span>
              <input
                type="date"
                value={filtros.hasta || ''}
                onChange={(e) => onFiltroChange({ hasta: e.target.value })}
                className="filtros-actividad__date-input"
              />
            </label>
          </div>
        )}
      </div>

      {/* 2. Barra de controles: Búsqueda de texto y Selectores */}
      <div className="filtros-actividad__controls-row">
        {/* Buscador */}
        <div className="filtros-actividad__search-wrapper">
          <Search size={16} className="filtros-actividad__search-icon" aria-hidden="true" />
          <input
            type="text"
            className="filtros-actividad__search-input"
            placeholder="Buscar por usuario, DNI, IP, detalle, paciente..."
            value={filtros.q || ''}
            onChange={(e) => onFiltroChange({ q: e.target.value })}
          />
          {filtros.q && (
            <button
              type="button"
              className="filtros-actividad__clear-search"
              onClick={() => onFiltroChange({ q: '' })}
              title="Borrar búsqueda"
              aria-label="Borrar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Menú de acceso rápido a filtros de KPIs Top */}
        <select
          className={`filtros-actividad__select filtros-actividad__select--kpi ${selectedKpiVal ? 'filtros-actividad__select--kpi-active' : ''}`}
          value={selectedKpiVal}
          onChange={(e) => handleKpiQuickSelect(e.target.value)}
          aria-label="Filtro rápido de KPIs"
          title="Filtro rápido de KPIs superiores"
        >
          <option value="">Filtro rápido de KPIs...</option>
          <option value="logins">🔑 Inicios de sesión</option>
          <option value="fallidos">🛡️ Fallidos / Bloqueados</option>
          <option value="cancelaciones">🚫 Cancelaciones</option>
          <option value="ocr">📄 Escaneos OCR</option>
          <option value="alertas">⚠️ Alertas activas</option>
          <option value="personal_activo">👥 Personal activo</option>
        </select>

        {/* Rol */}
        <select
          className="filtros-actividad__select"
          value={filtros.rol || ''}
          onChange={(e) => onFiltroChange({ rol: e.target.value })}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          {rolesDisponibles.map(([rolKey, info]) => (
            <option key={rolKey} value={rolKey}>
              {info.label}
            </option>
          ))}
        </select>

        {/* Categoría */}
        <select
          className="filtros-actividad__select"
          value={filtros.categoria || ''}
          onChange={(e) => onFiltroChange({ categoria: e.target.value })}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIAS_CONFIG).map(([catKey, info]) => (
            <option key={catKey} value={catKey}>
              {info.label}
            </option>
          ))}
        </select>

        {/* Resultado */}
        <select
          className="filtros-actividad__select"
          value={filtros.resultado || ''}
          onChange={(e) => onFiltroChange({ resultado: e.target.value })}
          aria-label="Filtrar por resultado"
        >
          <option value="">Todos los resultados</option>
          {Object.entries(RESULTADOS_CONFIG).map(([resKey, info]) => (
            <option key={resKey} value={resKey}>
              {info.label}
            </option>
          ))}
        </select>

        {/* Checkbox Solo Alertas */}
        <label className="filtros-actividad__checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(filtros.solo_alertas)}
            onChange={(e) => onFiltroChange({ solo_alertas: e.target.checked })}
            className="filtros-actividad__checkbox"
          />
          <span>Solo con alertas</span>
        </label>

        {/* Botón Reset */}
        {hasActiveFilters && (
          <button
            type="button"
            className="filtros-actividad__reset-btn"
            onClick={onResetFiltros}
            title="Restablecer todos los filtros"
          >
            <RotateCcw size={14} />
            Limpiar
          </button>
        )}
      </div>

      {/* 3. Chips de filtros activos */}
      {hasActiveFilters && (
        <div className="filtros-actividad__chips-row">
          <span className="filtros-actividad__chips-legend">Filtros aplicados:</span>

          {filtros.periodo !== 'hoy' && (
            <span className="filtros-actividad__chip">
              Período: {filtros.periodo === 'custom' ? `${filtros.desde || '...'} a ${filtros.hasta || '...'}` : filtros.periodo}
              <button type="button" onClick={() => handlePeriodoSelect('hoy')}>
                <X size={12} />
              </button>
            </span>
          )}

          {filtros.q && (
            <span className="filtros-actividad__chip">
              Texto: &ldquo;{filtros.q}&rdquo;
              <button type="button" onClick={() => onFiltroChange({ q: '' })}>
                <X size={12} />
              </button>
            </span>
          )}

          {filtros.rol && (
            <span className="filtros-actividad__chip">
              Rol: {ROLES_CONFIG[filtros.rol]?.label || filtros.rol}
              <button type="button" onClick={() => onFiltroChange({ rol: '' })}>
                <X size={12} />
              </button>
            </span>
          )}

          {filtros.categoria && (
            <span className="filtros-actividad__chip">
              Categoría: {CATEGORIAS_CONFIG[filtros.categoria]?.label || filtros.categoria}
              <button type="button" onClick={() => onFiltroChange({ categoria: '' })}>
                <X size={12} />
              </button>
            </span>
          )}

          {filtros.accion && (
            <span className="filtros-actividad__chip">
              Acción: {filtros.accion === 'ATENCION_CANCELADA' ? 'Cancelaciones' : filtros.accion}
              <button type="button" onClick={() => onFiltroChange({ accion: '' })}>
                <X size={12} />
              </button>
            </span>
          )}

          {filtros.personal_activo && (
            <span className="filtros-actividad__chip">
              Solo personal activo
              <button type="button" onClick={() => onFiltroChange({ personal_activo: false })}>
                <X size={12} />
              </button>
            </span>
          )}

          {filtros.ocr && (
            <span className="filtros-actividad__chip">
              Solo escaneos OCR
              <button type="button" onClick={() => onFiltroChange({ ocr: false })}>
                <X size={12} />
              </button>
            </span>
          )}

          {filtros.resultado && (
            <span className="filtros-actividad__chip">
              Resultado: {RESULTADOS_CONFIG[filtros.resultado]?.label || filtros.resultado}
              <button type="button" onClick={() => onFiltroChange({ resultado: '' })}>
                <X size={12} />
              </button>
            </span>
          )}

          {filtros.solo_alertas && (
            <span className="filtros-actividad__chip">
              Solo alertas activas
              <button type="button" onClick={() => onFiltroChange({ solo_alertas: false })}>
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
