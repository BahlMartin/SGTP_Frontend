import React, { useState, useMemo } from 'react'
import { Radio, Clock, Search, X, Bell } from 'lucide-react'
import TriageBadge from '../../../../components/TriageBadge/TriageBadge'
import { useTriageQueue } from '../../../../context/TriageQueueContext'
import { calculateMinutesDiff } from '../../../../utils/formatters'
import './MultiboxQueueCard.css'

export default function MultiboxQueueCard({
  waitingQueue: waitingQueueProp,
  onCallSpecificPatient,
  isProcessing = false,
  hasPatientInBox = false,
  currentBoxNumber = 1
}) {
  const { waitingQueue: queueFromContext } = useTriageQueue()
  const waitingQueue = waitingQueueProp !== undefined ? waitingQueueProp : queueFromContext

  const [searchTerm, setSearchTerm] = useState('')

  // Filtrado reactivo por nombre, turno, DNI y obra social
  const filteredQueue = useMemo(() => {
    if (!searchTerm.trim()) return waitingQueue
    const term = searchTerm.toLowerCase().trim()

    return waitingQueue.filter((item) => {
      const nombre = String(item.paciente_nombre || '').toLowerCase()
      const apellido = String(item.paciente_apellido || '').toLowerCase()
      const nombreCompleto = `${nombre} ${apellido}`.trim()
      const turno = String(item.num_llamado || item.num_totem || '').toLowerCase()
      const dni = String(item.paciente_dni || '').toLowerCase()
      const obraSocial = String(
        item.paciente_obra_social || item.obra_social || item.paciente?.obra_social || ''
      ).toLowerCase()
      const numAfiliado = String(
        item.paciente_numero_afiliado || item.paciente?.num_obra_social || ''
      ).toLowerCase()

      return (
        nombreCompleto.includes(term) ||
        turno.includes(term) ||
        dni.includes(term) ||
        obraSocial.includes(term) ||
        numAfiliado.includes(term)
      )
    })
  }, [waitingQueue, searchTerm])

  return (
    <div className="multibox-queue-card">
      <div className="multibox-queue-card__header">
        <div className="multibox-queue-card__title-wrap">
          <Radio className="multibox-queue-card__live-icon" />
          <h3 className="multibox-queue-card__title">Cola multibox centralizada</h3>
        </div>
        <div className="multibox-queue-card__header-right">
          <span
            className={`multibox-queue-card__badge ${
              waitingQueue.length > 0
                ? 'multibox-queue-card__badge--active'
                : 'multibox-queue-card__badge--empty'
            }`}
          >
            <span className="multibox-queue-card__badge-count">{waitingQueue.length}</span>
            <span className="multibox-queue-card__badge-text">
              {waitingQueue.length === 1 ? 'paciente en espera' : 'pacientes en espera'}
            </span>
          </span>
        </div>
      </div>

      {/* Barra de búsqueda interactiva */}
      <div className="multibox-queue-card__search-toolbar">
        <div className="multibox-queue-card__search-box">
          <Search className="multibox-queue-card__search-icon" size={16} />
          <input
            type="text"
            className="multibox-queue-card__search-input"
            placeholder="Buscar por paciente, turno (ej: EXT-101), DNI u obra social..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Buscar en la cola multibox"
          />
          {searchTerm && (
            <button
              type="button"
              className="multibox-queue-card__search-clear-btn"
              onClick={() => setSearchTerm('')}
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {searchTerm && (
          <div className="multibox-queue-card__search-feedback">
            <span className="multibox-queue-card__search-count">
              {filteredQueue.length}{' '}
              {filteredQueue.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
            </span>
          </div>
        )}
      </div>

      {waitingQueue.length === 0 ? (
        <div className="multibox-queue-card__empty">
          <p>La cola de espera se encuentra despejada en este momento.</p>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="multibox-queue-card__no-results">
          <p>
            No se encontraron pacientes que coincidan con <strong>"{searchTerm}"</strong>.
          </p>
          <button
            type="button"
            className="multibox-queue-card__btn-reset-search"
            onClick={() => setSearchTerm('')}
          >
            Ver todos los pacientes en espera
          </button>
        </div>
      ) : (
        <div className="multibox-queue-card__table-wrapper">
          <table className="multibox-queue-card__table">
            <thead>
              <tr>
                <th className="multibox-queue-card__th">N° LLAMADO</th>
                <th className="multibox-queue-card__th">PACIENTE</th>
                <th className="multibox-queue-card__th">CLASIFICACIÓN TRIAGE</th>
                <th className="multibox-queue-card__th">ESPERA</th>
                <th className="multibox-queue-card__th">ESTUDIOS</th>
                <th className="multibox-queue-card__th multibox-queue-card__th--actions">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((ticketItem, itemIndex) => {
                const waitMinutes = calculateMinutesDiff(
                  ticketItem.fecha_hora_admision,
                  new Date().toISOString()
                )
                const isTopPriority = itemIndex === 0 && !searchTerm
                const obraSocialDisplay =
                  ticketItem.paciente_obra_social ||
                  ticketItem.obra_social ||
                  ticketItem.paciente?.obra_social

                return (
                  <tr
                    key={ticketItem.id}
                    className={isTopPriority ? 'multibox-queue-card__row--top-priority' : ''}
                  >
                    <td className="multibox-queue-card__td">
                      <span className="multibox-queue-card__call-pill">
                        {ticketItem.num_llamado || ticketItem.num_totem}
                      </span>
                    </td>
                    <td className="multibox-queue-card__td">
                      <div className="multibox-queue-card__patient-info">
                        <span className="multibox-queue-card__patient-name">
                          {ticketItem.paciente_nombre} {ticketItem.paciente_apellido}
                        </span>
                        <div className="multibox-queue-card__patient-sub">
                          <span className="multibox-queue-card__patient-dni">
                            DNI: {ticketItem.paciente_dni || 'S/DNI'}
                          </span>
                          {obraSocialDisplay && (
                            <span className="multibox-queue-card__patient-os">
                              · {obraSocialDisplay}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="multibox-queue-card__td">
                      <TriageBadge
                        categoryKey={ticketItem.clasificacion_triage}
                        compact
                      />
                    </td>
                    <td className="multibox-queue-card__td">
                      <span className="multibox-queue-card__wait-time">
                        <Clock className="multibox-queue-card__wait-icon" />
                        {waitMinutes || 0} min
                      </span>
                    </td>
                    <td className="multibox-queue-card__td">
                      <span className="multibox-queue-card__studies">
                        {ticketItem.estudios?.length || 1} estudio(s)
                      </span>
                    </td>
                    <td className="multibox-queue-card__td multibox-queue-card__td--actions">
                      <button
                        type="button"
                        className="multibox-queue-card__btn-call-direct"
                        onClick={() => onCallSpecificPatient?.(ticketItem.id)}
                        disabled={isProcessing || hasPatientInBox}
                        title={
                          hasPatientInBox
                            ? 'Finalice la atención actual antes de convocar a otro paciente'
                            : `Llamar inmediatamente al Box ${currentBoxNumber} ignorando orden de triage`
                        }
                        aria-label={`Llamar paciente ${ticketItem.paciente_nombre} ${ticketItem.paciente_apellido} al Box ${currentBoxNumber}`}
                      >
                        <Bell size={13} className="multibox-queue-card__btn-call-icon" />
                        <span>Llamar a box</span>
                      </button>
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
