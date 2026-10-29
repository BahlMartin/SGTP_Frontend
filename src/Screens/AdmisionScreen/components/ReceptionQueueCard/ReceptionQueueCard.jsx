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
              {waitingQueue.length === 1 ? 'paciente esperando' : 'pacientes esperando'}
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
        <div className="reception-queue-card__table-wrap">
          <table className="reception-queue-card__table">
            <thead>
              <tr>
                <th>Turno</th>
                <th>DNI</th>
                <th>Motivo</th>
                <th>Espera</th>
                <th className="reception-queue-card__th--actions">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((turnoItem) => {
                const waitMinutes = calculateMinutesDiff(turnoItem.created_at)
                const isCurrentlyCalling = callingTurnoId === turnoItem.id

                return (
                  <tr
                    key={turnoItem.id}
                    className={`reception-queue-card__tr ${
                      turnoItem.estado === 'En Atencion' ? 'reception-queue-card__tr--in-attention' : ''
                    }`}
                  >
                    <td>
                      <span
                        className={`reception-queue-card__turno-pill ${getPrefixClass(
                          turnoItem.prefijo
                        )}`}
                      >
                        {turnoItem.numero_llamado}
                      </span>
                    </td>
                    <td className="reception-queue-card__td-dni">
                      <strong>{formatearDni(turnoItem.dni)}</strong>
                    </td>
                    <td className="reception-queue-card__td-cat">
                      <span>{turnoItem.categoria_label || turnoItem.prefijo}</span>
                    </td>
                    <td className="reception-queue-card__td-wait">
                      <div className="reception-queue-card__wait-wrap">
                        <Clock size={13} className="reception-queue-card__wait-icon" />
                        <span>{formatWaitTime(waitMinutes)}</span>
                      </div>
                    </td>
                    <td className="reception-queue-card__td-actions">
                      <div className="reception-queue-card__actions-group">
                        <button
                          type="button"
                          className="reception-queue-card__btn-call"
                          onClick={() => onCallPatient?.(turnoItem)}
                          disabled={isProcessing || isCurrentlyCalling}
                          title="Llamar y cargar datos en formulario"
                          aria-label={`Llamar turno ${turnoItem.numero_llamado}`}
                        >
                          <Bell size={13} />
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
                          <UserX size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

