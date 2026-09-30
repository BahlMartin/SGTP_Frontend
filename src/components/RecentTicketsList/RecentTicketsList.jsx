import React, { memo } from 'react'
import TriageBadge from '../TriageBadge/TriageBadge'
import { formatTimeHHMM } from '../../utils/formatters'
import './RecentTicketsList.css'

/**
 * Componente global reutilizable para mostrar listas de tickets recientes.
 * Apto para Admisión (ingresos de hoy) y Box de atención (pacientes atendidos).
 * Memorizado con React.memo para evitar re-renderizados innecesarios.
 */
function RecentTicketsList({
  title = 'Últimos ingresos de hoy',
  emptyMessage = 'No hubo ningún ingreso',
  ticketsList = [],
  maxItems = 6,
  onTicketClick = () => {}
}) {
  const visibleTickets = ticketsList.slice(0, maxItems)

  return (
    <div className="recent-tickets-card">
      <h3 className="recent-tickets-card__title">{title}</h3>

      {visibleTickets.length === 0 ? (
        <p className="recent-tickets-card__empty-notice">{emptyMessage}</p>
      ) : (
        <ul className="recent-tickets-card__list">
          {visibleTickets.map((ticketItem) => {
            const handleKeyDown = (keyboardEvent) => {
              if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                keyboardEvent.preventDefault()
                onTicketClick(ticketItem)
              }
            }

            return (
              <li
                key={ticketItem.id}
                role="button"
                tabIndex={0}
                className="recent-tickets-card__item"
                onClick={() => onTicketClick(ticketItem)}
                onKeyDown={handleKeyDown}
                aria-label={`Ver ticket de ${ticketItem.paciente_nombre} ${ticketItem.paciente_apellido}`}
              >
                <div className="recent-tickets-card__entry-left">
                  <span className="recent-tickets-card__call-num">
                    {ticketItem.num_llamado || ticketItem.num_totem}
                  </span>
                  <div className="recent-tickets-card__details">
                    <span className="recent-tickets-card__name">
                      {ticketItem.paciente_nombre} {ticketItem.paciente_apellido}
                    </span>
                    <span className="recent-tickets-card__time">
                      {formatTimeHHMM(ticketItem.fecha_hora_admision)} hs
                    </span>
                  </div>
                </div>

                <TriageBadge categoryKey={ticketItem.clasificacion_triage} showPriority={false} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default memo(RecentTicketsList)
