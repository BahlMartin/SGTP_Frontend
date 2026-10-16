import React, { memo, useMemo } from 'react'
import TriageBadge from '../TriageBadge/TriageBadge'
import RefreshButton from '../RefreshButton/RefreshButton'
import { formatTimeHHMM } from '../../utils/formatters'
import './RecentTicketsList.css'

/**
 * Componente global reutilizable para mostrar listas de tickets recientes.
 * Apto para Admisión (ingresos de hoy) y Box de atención (pacientes atendidos).
 * Memorizado con React.memo para evitar re-renderizados innecesarios.
 * Muestra siempre los registros del más nuevo al más viejo, solapando a los más antiguos.
 */
function RecentTicketsList({
  title = 'Últimos ingresos de hoy',
  emptyMessage = 'No hubo ningún ingreso',
  ticketsList = [],
  maxItems = null,
  scrollAfterSeven = false,
  onTicketClick = () => {},
  onRefresh = null,
  isLoading = false
}) {
  const sortedTickets = useMemo(() => {
    return [...ticketsList].sort((a, b) => {
      const timeA = new Date(a.fecha_hora_admision).getTime() || 0
      const timeB = new Date(b.fecha_hora_admision).getTime() || 0
      return timeB - timeA
    })
  }, [ticketsList])

  const visibleTickets = typeof maxItems === 'number' && maxItems > 0
    ? sortedTickets.slice(0, maxItems)
    : sortedTickets

  return (
    <div className="recent-tickets-card">
      <div className="recent-tickets-card__header">
        <h3 className="recent-tickets-card__title">{title}</h3>
        {onRefresh && (
          <RefreshButton
            onRefresh={onRefresh}
            isLoading={isLoading}
          />
        )}
      </div>

      {visibleTickets.length === 0 ? (
        <p className="recent-tickets-card__empty-notice">{emptyMessage}</p>
      ) : (
        <ul
          className={`recent-tickets-card__list${scrollAfterSeven ? ' recent-tickets-card__list--seven-rows' : ''}`}
        >
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
                      {scrollAfterSeven ? (
                        <>
                          <span>{ticketItem.paciente_nombre}</span>
                          <span>{ticketItem.paciente_apellido}</span>
                        </>
                      ) : (
                        `${ticketItem.paciente_nombre} ${ticketItem.paciente_apellido}`
                      )}
                    </span>
                    <span className="recent-tickets-card__time">
                      {formatTimeHHMM(ticketItem.fecha_hora_admision)} hs
                    </span>
                  </div>
                </div>

                <TriageBadge
                  categoryKey={ticketItem.clasificacion_triage}
                  showPriority={false}
                  compact={scrollAfterSeven}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default memo(RecentTicketsList)
