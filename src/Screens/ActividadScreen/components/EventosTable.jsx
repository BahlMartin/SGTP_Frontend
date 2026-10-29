import React from 'react'
import {
  MapPin,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  SearchX,
  AlertTriangle
} from 'lucide-react'
import {
  CATEGORIAS_CONFIG,
  RESULTADOS_CONFIG,
  ROLES_CONFIG,
  ACCIONES_CATALOGO,
  formatHora
} from '../constants/auditoriaConstants'
import './EventosTable.css'

export default function EventosTable({
  eventos = [],
  totalCount = 0,
  page = 1,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
  selectedEventId,
  onSelectEvent,
  loading = false
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalCount)

  if (loading) {
    return (
      <div className="eventos-table__loading-container">
        <div className="eventos-table__spinner" aria-hidden="true" />
        <p>Cargando registros de auditoría...</p>
      </div>
    )
  }

  if (eventos.length === 0) {
    return (
      <div className="eventos-table__empty-state">
        <SearchX size={44} className="eventos-table__empty-icon" />
        <h4 className="eventos-table__empty-title">No se encontraron eventos</h4>
        <p className="eventos-table__empty-text">
          No hay registros de actividad que coincidan con los filtros seleccionados.
          Pruebe ampliando el período o borrando los filtros activos.
        </p>
      </div>
    )
  }

  return (
    <div className="eventos-table-wrapper">
      <div className="eventos-table-container">
        <table className="eventos-table" aria-label="Registros de auditoría operacional">
          <thead>
            <tr>
              <th scope="col" style={{ width: '85px' }}>Hora</th>
              <th scope="col" style={{ width: '180px' }}>Empleado</th>
              <th scope="col" style={{ width: '180px' }}>Acción</th>
              <th scope="col">Detalle / Recurso</th>
              <th scope="col" style={{ width: '170px' }}>IP y Ubicación</th>
              <th scope="col" style={{ width: '110px' }}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev) => {
              const isSelected = selectedEventId === ev.id
              const cat = CATEGORIAS_CONFIG[ev.categoria] || CATEGORIAS_CONFIG.gestion
              const res = RESULTADOS_CONFIG[ev.resultado] || RESULTADOS_CONFIG.EXITO
              const CatIcon = cat.Icon
              const ResIcon = res.Icon

              const isFallo = ev.resultado === 'FALLO'
              const isDenegado = ev.resultado === 'DENEGADO'
              const hasAlerts = ev.alertas && ev.alertas.length > 0
              const hasGps = ev.geo_nav_lat !== null && ev.geo_nav_lat !== undefined

              const nombreOperador = ev.usuario
                ? `${ev.usuario.nombre} ${ev.usuario.apellidos || ''}`.trim()
                : (ev.email_intentado || 'Sistema / Sin sesión')

              const rolOperador = ev.rol_usuario
                ? (ROLES_CONFIG[ev.rol_usuario]?.label || ev.rol_usuario)
                : 'Sin sesión'

              const accionNombre = ACCIONES_CATALOGO[ev.accion] || ev.accion

              return (
                <tr
                  key={ev.id}
                  className={`eventos-table__row ${
                    isSelected ? 'eventos-table__row--selected' : ''
                  } ${isFallo ? 'eventos-table__row--fallo' : ''} ${
                    isDenegado ? 'eventos-table__row--denegado' : ''
                  }`}
                  onClick={() => onSelectEvent(ev.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectEvent(ev.id)
                    }
                  }}
                >
                  {/* Hora */}
                  <td className="eventos-table__cell eventos-table__cell--hora">
                    {formatHora(ev.fecha)}
                  </td>

                  {/* Empleado */}
                  <td className="eventos-table__cell">
                    <span className="eventos-table__user-name" title={nombreOperador}>
                      {nombreOperador}
                    </span>
                    <span className="eventos-table__user-meta">
                      {rolOperador}
                      {ev.usuario?.matricula ? ` · Mat: ${ev.usuario.matricula}` : ''}
                    </span>
                  </td>

                  {/* Categoría y Acción */}
                  <td className="eventos-table__cell">
                    <div className="eventos-table__action-cell">
                      <span
                        className="eventos-table__cat-badge"
                        style={{ color: cat.color, backgroundColor: cat.bg }}
                        title={`Categoría: ${cat.label}`}
                      >
                        <CatIcon size={14} />
                      </span>
                      <div className="eventos-table__action-info">
                        <span className="eventos-table__action-title" title={accionNombre}>
                          {accionNombre}
                        </span>
                        <span className="eventos-table__cat-label">
                          {cat.label}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Detalle / Recurso */}
                  <td className="eventos-table__cell eventos-table__cell--detalle">
                    <div className="eventos-table__detail-wrapper">
                      <span className="eventos-table__detail-text" title={ev.descripcion}>
                        {ev.descripcion}
                      </span>
                      {hasAlerts && (
                        <span
                          className="eventos-table__alert-indicator"
                          title={ev.alertas.map((a) => a.texto).join(' | ')}
                        >
                          <AlertTriangle size={13} />
                          {ev.alertas.length}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* IP y Ubicación */}
                  <td className="eventos-table__cell">
                    <div className="eventos-table__ip-wrapper">
                      <div className="eventos-table__ip-row">
                        <span className="eventos-table__ip">{ev.ip || '—'}</span>
                        {ev.ip_confiable ? (
                          <span title="IP confiable (cadena de proxies válida)">
                            <ShieldCheck size={13} className="eventos-table__ip-ok" />
                          </span>
                        ) : (
                          <span title="IP no confiable o proxy anómalo">
                            <ShieldAlert size={13} className="eventos-table__ip-warn" />
                          </span>
                        )}
                        {hasGps && (
                          <span title="Geolocalización GPS capturada por el navegador">
                            <MapPin size={13} className="eventos-table__gps-ok" />
                          </span>
                        )}
                      </div>
                      <span className="eventos-table__geo-text">
                        {ev.geo_ip_ciudad
                          ? `${ev.geo_ip_ciudad}, ${ev.geo_ip_pais || 'AR'}`
                          : (ev.geo_ip_estado || 'IP Privada')}
                      </span>
                    </div>
                  </td>

                  {/* Resultado */}
                  <td className="eventos-table__cell">
                    <span
                      className="eventos-table__result-badge"
                      style={{
                        color: res.color,
                        backgroundColor: res.bg,
                        borderColor: res.border
                      }}
                    >
                      <ResIcon size={12} />
                      {res.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Barra de Paginación */}
      <div className="eventos-table__pagination">
        <div className="eventos-table__pagination-info">
          Mostrando <strong>{startItem}</strong> a <strong>{endItem}</strong> de <strong>{totalCount}</strong> eventos
        </div>

        <div className="eventos-table__pagination-controls">
          <label className="eventos-table__page-size-label">
            Filas por página:
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="eventos-table__page-size-select"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <button
            type="button"
            className="eventos-table__pagination-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="eventos-table__pagination-current">
            Pág. {page} de {totalPages}
          </span>

          <button
            type="button"
            className="eventos-table__pagination-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
