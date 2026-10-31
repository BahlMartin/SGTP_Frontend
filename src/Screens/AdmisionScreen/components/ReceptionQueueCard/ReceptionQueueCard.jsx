import React, { useState, useMemo } from 'react'
import { Radio, Clock, Search, X, Bell, UserX } from 'lucide-react'
import { formatWaitTime, calculateMinutesDiff } from '../../../../utils/formatters'
import './ReceptionQueueCard.css'

export default function ReceptionQueueCard({
  waitingQueue = [],
  onCallPatient,
  onCancelTurno,
  callingTurnoId = null,
  isProcessing = false
}) {
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrado reactivo por DNI, turno y categoría
  const filteredQueue = useMemo(() => {
    if (!searchTerm.trim()) return waitingQueue
    const term = searchTerm.toLowerCase().trim()

    return waitingQueue.filter((item) => {
      const turno = String(item.numero_llamado || '').toLowerCase()
      const dni = String(item.dni || '').toLowerCase()
      const categoria = String(item.categoria_label || item.prefijo || '').toLowerCase()

      return turno.includes(term) || dni.includes(term) || categoria.includes(term)
    })
  }, [waitingQueue, searchTerm])

  const getPrefixClass = (prefijo) => {
    switch (prefijo) {
      case 'Ext':
        return 'reception-badge--extraccion'
      case 'G':
        return 'reception-badge--guardia'
      case 'Med':
        return 'reception-badge--medicos'
      case 'Csl':
        return 'reception-badge--consulta'
      default:
        return 'reception-badge--default'
    }
  }

  const formatearDni = (valor) => {
    if (!valor) return ''
    return String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  return (
    <div className="reception-queue-card">
      <div className="reception-queue-card__header">
        <div className="reception-queue-card__title-wrap">
          <Radio className="reception-queue-card__live-icon" size={18} />
          <h3 className="reception-queue-card__title">Cola de Espera (Tótem)</h3>
        </div>
        <div className="reception-queue-card__header-right">
          <span
            className={`reception-queue-card__badge ${
              waitingQueue.length > 0
                ? 'reception-queue-card__badge--active'
                : 'reception-queue-card__badge--empty'
            }`}
          >
            <span className="reception-queue-card__badge-count">{waitingQueue.length}</span>
            <span className="reception-queue-card__badge-text">
              {waitingQueue.length === 1 ? 'en espera' : 'en espera'}
            </span>
          </span>
        </div>
      </div>

      {/* Barra de búsqueda interactiva */}
      <div className="reception-queue-card__search-toolbar">
        <div className="reception-queue-card__search-box">
          <Search className="reception-queue-card__search-icon" size={15} />
          <input
            type="text"
            className="reception-queue-card__search-input"
            placeholder="Buscar por DNI o turno (ej: Ext-01)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Buscar en cola de recepción"
          />
          {searchTerm && (
            <button
              type="button"
              className="reception-queue-card__search-clear-btn"
              onClick={() => setSearchTerm('')}
              title="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Contenido de la Cola */}
      {waitingQueue.length === 0 ? (
        <div className="reception-queue-card__empty-state">
          <p className="reception-queue-card__empty-text">No hay pacientes esperando en recepción</p>
          <span className="reception-queue-card__empty-subtext">
            Los turnos solicitados en el Tótem aparecerán aquí en tiempo real.
          </span>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="reception-queue-card__empty-state">
          <p className="reception-queue-card__empty-text">Sin coincidencias para "{searchTerm}"</p>
        </div>
      ) : (
        <div className="reception-queue-card__list-wrap">
          <ul className="reception-queue-card__list">
            {filteredQueue.map((turnoItem) => {
              const waitMinutes = calculateMinutesDiff(turnoItem.created_at)
              const isCurrentlyCalling = callingTurnoId === turnoItem.id
              const inAttention = turnoItem.estado === 'En Atencion'

              return (
                <li
                  key={turnoItem.id}
                  className={`reception-queue-card__item ${
                    inAttention ? 'reception-queue-card__item--in-attention' : ''
                  }`}
                >
                  <div className="reception-queue-card__item-main">
                    <div className="reception-queue-card__item-top">
                      <span
                        className={`reception-queue-card__turno-pill ${getPrefixClass(
                          turnoItem.prefijo
                        )}`}
                      >
                        {turnoItem.numero_llamado}
                      </span>
                      <span className="reception-queue-card__item-dni">
                        DNI <strong>{formatearDni(turnoItem.dni)}</strong>
                      </span>
                    </div>

                    <div className="reception-queue-card__item-bottom">
                      <span
                        className="reception-queue-card__item-cat"
                        title={turnoItem.categoria_label || turnoItem.prefijo}
                      >
                        {turnoItem.categoria_label || turnoItem.prefijo}
                      </span>
                      <span className="reception-queue-card__item-dot">•</span>
                      <span className="reception-queue-card__item-wait">
                        <Clock size={11} className="reception-queue-card__wait-icon" />
                        <span>{formatWaitTime(waitMinutes)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="reception-queue-card__item-actions">
                    <button
                      type="button"
                      className="reception-queue-card__btn-call"
                      onClick={() => onCallPatient?.(turnoItem)}
                      disabled={isProcessing || isCurrentlyCalling}
                      title="Llamar y cargar datos en formulario"
                      aria-label={`Llamar turno ${turnoItem.numero_llamado}`}
                    >
                      <Bell size={12} />
                      <span>{isCurrentlyCalling ? 'Llamando...' : 'Llamar'}</span>
                    </button>
                    <button
                      type="button"
                      className="reception-queue-card__btn-cancel"
                      onClick={() => onCancelTurno?.(turnoItem)}
                      disabled={isProcessing || isCurrentlyCalling}
                      title="Cancelar turno por ausencia"
                      aria-label={`Cancelar turno ${turnoItem.numero_llamado}`}
                    >
                      <UserX size={12} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

