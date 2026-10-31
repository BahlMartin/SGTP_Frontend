import React, { useState } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Globe,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Laptop
} from 'lucide-react'
import {
  CATEGORIAS_CONFIG,
  RESULTADOS_CONFIG,
  ROLES_CONFIG,
  ACCIONES_CATALOGO,
  formatFechaHora
} from '../constants/auditoriaConstants'
import './EventDrawer.css'

export default function EventDrawer({
  evento,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false
}) {
  const [copiedCoords, setCopiedCoords] = useState(false)

  if (!evento) return null

  const cat = CATEGORIAS_CONFIG[evento.categoria] || CATEGORIAS_CONFIG.gestion
  const res = RESULTADOS_CONFIG[evento.resultado] || RESULTADOS_CONFIG.EXITO
  const CatIcon = cat.Icon
  const ResIcon = res.Icon

  const accionNombre = ACCIONES_CATALOGO[evento.accion] || evento.accion
  const nombreOperador = evento.usuario
    ? `${evento.usuario.nombre} ${evento.usuario.apellidos || ''}`.trim()
    : (evento.email_intentado || 'Sistema / Sin sesión')

  const rolOperador = evento.rol_usuario
    ? (ROLES_CONFIG[evento.rol_usuario]?.label || evento.rol_usuario)
    : 'Sin sesión'

  // Copiar coordenadas
  const handleCopyCoords = () => {
    if (evento.geo_nav_lat && evento.geo_nav_lon) {
      navigator.clipboard.writeText(`${evento.geo_nav_lat}, ${evento.geo_nav_lon}`)
      setCopiedCoords(true)
      setTimeout(() => setCopiedCoords(false), 2000)
    }
  }

  // Extraer información de Diff si existe en metadata
  const cambios = evento.metadata?.cambios || null
  const antes = evento.metadata?.antes || null
  const despues = evento.metadata?.despues || null

  const hasDiff = Boolean(cambios || (antes && despues))

  // Coordenadas para mapa
  const lat = evento.geo_nav_lat ?? (evento.geo_ip_lat ?? null)
  const lon = evento.geo_nav_lon ?? (evento.geo_ip_lon ?? null)
  const osmUrl = lat && lon
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`
    : null
  const osmEmbedUrl = lat && lon
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.02}%2C${lat - 0.02}%2C${lon + 0.02}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lon}`
    : null

  return (
    <aside className="event-drawer" aria-label="Detalle forense del evento">
      {/* 1. Cabecera con controles de navegación */}
      <div className="event-drawer__header">
        <div className="event-drawer__nav-controls">
          <button
            type="button"
            className="event-drawer__nav-btn"
            disabled={!hasPrev}
            onClick={onPrev}
            title="Evento anterior"
            aria-label="Evento anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="event-drawer__event-id">Evento #{evento.id}</span>
          <button
            type="button"
            className="event-drawer__nav-btn"
            disabled={!hasNext}
            onClick={onNext}
            title="Evento siguiente"
            aria-label="Evento siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          type="button"
          className="event-drawer__close-btn"
          onClick={onClose}
          title="Cerrar panel (Esc)"
          aria-label="Cerrar panel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="event-drawer__body">
        {/* 2. Título de Acción y Estado */}
        <div className="event-drawer__action-header">
          <div className="event-drawer__badge-row">
            <span
              className="event-drawer__cat-tag"
              style={{ color: cat.color, backgroundColor: cat.bg }}
            >
              <CatIcon size={14} />
              {cat.label}
            </span>
            <span
              className="event-drawer__res-tag"
              style={{
                color: res.color,
                backgroundColor: res.bg,
                borderColor: res.border
              }}
            >
              <ResIcon size={12} />
              {res.label}
            </span>
          </div>

          <h3 className="event-drawer__action-title">{accionNombre}</h3>
          <span className="event-drawer__timestamp">
            {formatFechaHora(evento.fecha)}
          </span>
        </div>

        {/* 3. Alertas asociadas (si existen) */}
        {evento.alertas && evento.alertas.length > 0 && (
          <div className="event-drawer__alerts-box">
            <div className="event-drawer__alerts-header">
              <AlertTriangle size={15} />
              <span>Anomalías detectadas ({evento.alertas.length})</span>
            </div>
            <ul className="event-drawer__alerts-list">
              {evento.alertas.map((al, idx) => (
                <li key={idx} className="event-drawer__alert-item">
                  <strong>[{al.severidad || 'ALERTA'}]:</strong> {al.texto}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 4. Tarjeta del Operador Responsable */}
        <section className="event-drawer__section">
          <h4 className="event-drawer__section-title">
            <User size={15} />
            Personal Involucrado
          </h4>
          <div className="event-drawer__operator-card">
            <div className="event-drawer__operator-avatar" aria-hidden="true">
              <User size={20} />
            </div>
            <div className="event-drawer__operator-info">
              <div className="event-drawer__operator-name">{nombreOperador}</div>
              <div className="event-drawer__operator-meta">
                <span>{rolOperador}</span>
                {evento.usuario?.matricula && (
                  <span> · Mat: {evento.usuario.matricula}</span>
                )}
              </div>
              {evento.usuario?.email && (
                <div className="event-drawer__operator-email">
                  {evento.usuario.email}
                </div>
              )}
              {evento.usuario?.turno && (
                <div className="event-drawer__operator-turno">
                  Turno habitual: {evento.usuario.turno}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 5. Descripción y Recurso Afectado */}
        <section className="event-drawer__section">
          <h4 className="event-drawer__section-title">Descripción Operacional</h4>
          <p className="event-drawer__description-text">{evento.descripcion}</p>

          {(evento.tipo_recurso || evento.id_recurso) && (
            <div className="event-drawer__resource-tag">
              <span>Recurso: </span>
              <strong>
                {evento.tipo_recurso} #{evento.id_recurso}
              </strong>
            </div>
          )}
        </section>

        {/* 6. Tabla de Cambios (DiffTable Antes -> Después) */}
        {hasDiff && (
          <section className="event-drawer__section">
            <h4 className="event-drawer__section-title">Modificaciones Realizadas</h4>
            <div className="event-drawer__diff-container">
              {cambios ? (
                <table className="event-drawer__diff-table">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Antes</th>
                      <th>Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(cambios).map(([campo, valor]) => (
                      <tr key={campo}>
                        <td className="event-drawer__diff-field">{campo}</td>
                        <td className="event-drawer__diff-before">
                          {String(valor?.antes ?? valor?.[0] ?? '—')}
                        </td>
                        <td className="event-drawer__diff-after">
                          {String(valor?.despues ?? valor?.[1] ?? '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="event-drawer__diff-blocks">
                  <div className="event-drawer__diff-block">
                    <span className="event-drawer__diff-label">Estado Previo</span>
                    <pre>{JSON.stringify(antes, null, 2)}</pre>
                  </div>
                  <div className="event-drawer__diff-block">
                    <span className="event-drawer__diff-label">Estado Posterior</span>
                    <pre>{JSON.stringify(despues, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 7. Red y Geolocalización Forense */}
        <section className="event-drawer__section">
          <h4 className="event-drawer__section-title">
            <Globe size={15} />
            Red y Geolocalización
          </h4>

          {/* Tarjeta de IP */}
          <div className="event-drawer__geo-card">
            <div className="event-drawer__geo-item">
              <span className="event-drawer__geo-label">Dirección IP:</span>
              <div className="event-drawer__geo-val-row">
                <code className="event-drawer__ip-code">{evento.ip}</code>
                {evento.ip_confiable ? (
                  <span className="event-drawer__conf-badge event-drawer__conf-badge--ok">
                    <ShieldCheck size={12} /> Confiable
                  </span>
                ) : (
                  <span className="event-drawer__conf-badge event-drawer__conf-badge--warn">
                    <ShieldAlert size={12} /> No confiable
                  </span>
                )}
              </div>
            </div>

            {evento.geo_ip_ciudad && (
              <div className="event-drawer__geo-item">
                <span className="event-drawer__geo-label">Ubicación DB-IP:</span>
                <span className="event-drawer__geo-val">
                  {evento.geo_ip_ciudad}, {evento.geo_ip_pais || 'Argentina'}
                </span>
              </div>
            )}

            {evento.ip_cadena_proxies && evento.ip_cadena_proxies !== evento.ip && (
              <div className="event-drawer__geo-item">
                <span className="event-drawer__geo-label">Cadena Proxies:</span>
                <span className="event-drawer__geo-val event-drawer__geo-val--mono">
                  {evento.ip_cadena_proxies}
                </span>
              </div>
            )}

            {evento.dispositivo && (
              <div className="event-drawer__geo-item">
                <span className="event-drawer__geo-label">Dispositivo:</span>
                <span className="event-drawer__geo-val">
                  <Laptop size={13} style={{ marginRight: 4, verticalAlign: -1 }} />
                  {evento.dispositivo}
                </span>
              </div>
            )}
          </div>

          {/* Tarjeta de GPS Navegador */}
          <div className="event-drawer__geo-card" style={{ marginTop: 10 }}>
            <div className="event-drawer__geo-item">
              <span className="event-drawer__geo-label">GPS Navegador:</span>
              <span className="event-drawer__geo-val">
                {evento.geo_nav_lat !== null && evento.geo_nav_lat !== undefined ? (
                  <>
                    {evento.geo_nav_lat}, {evento.geo_nav_lon}
                    {evento.geo_nav_precision_m && (
                      <span className="event-drawer__precision">
                        {' '}(±{Math.round(evento.geo_nav_precision_m)}m)
                      </span>
                    )}
                  </>
                ) : (
                  evento.geo_nav_estado || 'No solicitado'
                )}
              </span>
            </div>

            {evento.geo_nav_distancia_km !== null && evento.geo_nav_distancia_km !== undefined && (
              <div className="event-drawer__geo-item">
                <span className="event-drawer__geo-label">Distancia IP vs GPS:</span>
                <span
                  className={`event-drawer__geo-val ${
                    evento.geo_nav_coincide_ip === false
                      ? 'event-drawer__geo-val--alert'
                      : ''
                  }`}
                >
                  {evento.geo_nav_distancia_km} km
                  {evento.geo_nav_coincide_ip === false && (
                    <span className="event-drawer__geo-warn-pill">
                      Discrepancia &gt; 50km
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Acciones de mapa */}
            {lat && lon && (
              <div className="event-drawer__map-actions">
                <button
                  type="button"
                  className="event-drawer__copy-btn"
                  onClick={handleCopyCoords}
                  title="Copiar latitud y longitud"
                >
                  {copiedCoords ? <Check size={13} /> : <Copy size={13} />}
                  {copiedCoords ? 'Copiado' : 'Copiar Coordenadas'}
                </button>

                {osmUrl && (
                  <a
                    href={osmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-drawer__map-link"
                  >
                    Ver en mapa <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            {/* Mapa embebido si hay coordenadas */}
            {osmEmbedUrl && (
              <div className="event-drawer__map-frame-wrapper">
                <iframe
                  title="Mapa de ubicación"
                  src={osmEmbedUrl}
                  className="event-drawer__map-frame"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
