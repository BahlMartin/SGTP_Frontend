import React from 'react'
import { Radio, Clock } from 'lucide-react'
import TriageBadge from '../../../../components/TriageBadge/TriageBadge'
import { calculateMinutesDiff } from '../../../../utils/formatters'
import './MultiboxQueueCard.css'

export default function MultiboxQueueCard({
  waitingQueue = []
}) {
  return (
    <div className="multibox-queue-card">
      <div className="multibox-queue-card__header">
        <div className="multibox-queue-card__title-wrap">
          <Radio className="multibox-queue-card__live-icon" />
          <h3 className="multibox-queue-card__title">Cola multibox centralizada</h3>
        </div>
        <span className="multibox-queue-card__badge">
          {waitingQueue.length} paciente(s) en espera
        </span>
      </div>

      {waitingQueue.length === 0 ? (
        <div className="multibox-queue-card__empty">
          <p>La cola de espera se encuentra despejada en este momento.</p>
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
              </tr>
            </thead>
            <tbody>
              {waitingQueue.map((ticketItem, itemIndex) => {
                const waitMinutes = calculateMinutesDiff(
                  ticketItem.fecha_hora_admision,
                  new Date().toISOString()
                )
                const isTopPriority = itemIndex === 0

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
                        <span className="multibox-queue-card__patient-dni">
                          DNI: {ticketItem.paciente_dni}
                        </span>
                      </div>
                    </td>
                    <td className="multibox-queue-card__td">
                      <TriageBadge categoryKey={ticketItem.clasificacion_triage} />
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
