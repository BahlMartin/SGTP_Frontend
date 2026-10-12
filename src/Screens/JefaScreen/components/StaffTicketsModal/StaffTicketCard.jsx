import React from 'react'
import { Clock, Receipt, Loader2, User, Stethoscope } from 'lucide-react'
import { formatDateDDMMAAAA, formatTimeHHMM } from '../../../../utils/formatters'
import './StaffTicketCard.css'

export default function StaffTicketCard({
  ticket,
  onViewTicket,
  isFetching = false,
  tipo = 'admision'
}) {
  if (!ticket) return null

  const ticketId = ticket.id_ticket || ticket.id
  // Si es admisión priorizamos fecha_hora_admision, si es box fecha_hora_atencion_box
  const fecha = (tipo === 'box' && ticket.fecha_hora_atencion_box)
    ? ticket.fecha_hora_atencion_box
    : (ticket.fecha_hora_admision || ticket.fecha_hora_atencion)

  const getStudyNames = (studies = []) =>
    studies
      .map((study) => {
        if (typeof study === 'string') return study
        return study?.estudio_detalle?.nombre || study?.estudio?.nombre || study?.nombre || ''
      })
      .filter(Boolean)

  const studyNames = getStudyNames(ticket.estudios)
  const studiesText = studyNames.length > 0 ? studyNames.join(', ') : 'Rutina estándar'

  const boxDisplay = ticket.box_numero || (ticket.box_actual ? ticket.box_actual.numero || ticket.box_actual : null)
    ? `Box ${ticket.box_numero || (ticket.box_actual?.numero || ticket.box_actual)}`
    : (ticket.box_asignado || 'Sin box')

  const stateClass = (ticket.estado || 'default').toLowerCase().replace(/\s+/g, '-')

  const paciente = ticket.paciente_detalle || ticket.paciente
  const pacienteNombre = paciente
    ? `${paciente.apellidos || ''}, ${paciente.nombre || ''}`.replace(/^,\s*|,\s*$/g, '') || `DNI ${paciente.dni}`
    : 'Paciente no asignado'
  const pacienteDni = paciente?.dni ? `DNI: ${paciente.dni}` : ''
  const obraSocial = paciente?.obra_social ? ` · ${paciente.obra_social}` : ''

  const proContraparte = tipo === 'admision'
    ? (ticket.personal_box_nombre || 'En espera / Sin box')
    : (ticket.personal_admision_nombre || 'Admisión no registrada')
  const captionContraparte = tipo === 'admision' ? 'Técnico / Box:' : 'Operador Admisión:'

  return (
    <li className="staff-ticket-card">
      <div className="staff-ticket-card__inner">
        <div className="staff-ticket-card__header">
          <div className="staff-ticket-card__time">
            <Clock size={14} />
            <span>
              {fecha
                ? `${formatDateDDMMAAAA(fecha)} · ${formatTimeHHMM(fecha)}`
                : 'Fecha no registrada'}
            </span>
          </div>

          <div className="staff-ticket-card__tags">
            <span className="staff-ticket-card__badge-totem">
              {ticket.num_totem || `Ticket #${ticketId}`}
            </span>
            <span className={`staff-ticket-card__badge-state staff-ticket-card__badge-state--${stateClass}`}>
              {ticket.estado || 'Atendido'}
            </span>
            <span className="staff-ticket-card__badge-box">
              {boxDisplay}
            </span>
          </div>
        </div>

        <div className="staff-ticket-card__body">
          <div className="staff-ticket-card__grid">
            <div className="staff-ticket-card__col">
              <span className="staff-ticket-card__caption">Paciente asistido:</span>
              <span className="staff-ticket-card__val">{pacienteNombre}</span>
              {(pacienteDni || obraSocial) && (
                <span className="staff-ticket-card__subval">
                  {pacienteDni}{obraSocial}
                </span>
              )}
            </div>

            <div className="staff-ticket-card__col">
              <span className="staff-ticket-card__caption">{captionContraparte}</span>
              <span className="staff-ticket-card__val">{proContraparte}</span>
              {tipo === 'box' && ticket.personal_admision_matricula && (
                <span className="staff-ticket-card__subval">
                  Mat. {ticket.personal_admision_matricula}
                </span>
              )}
              {tipo === 'admision' && ticket.personal_box_matricula && (
                <span className="staff-ticket-card__subval">
                  Mat. {ticket.personal_box_matricula}
                </span>
              )}
            </div>
          </div>

          <div className="staff-ticket-card__studies">
            <span className="staff-ticket-card__caption">Prácticas / Estudios:</span>
            <span className="staff-ticket-card__studies-val">{studiesText}</span>
          </div>
        </div>

        <div className="staff-ticket-card__footer">
          <button
            type="button"
            className="staff-ticket-card__btn-view"
            onClick={() => onViewTicket(ticketId)}
            disabled={isFetching}
            aria-label={`Ver comprobante del ticket ${ticket.num_totem || ticketId}`}
          >
            {isFetching ? (
              <>
                <Loader2 size={15} className="staff-ticket-card__spinner" />
                <span>Consultando ticket...</span>
              </>
            ) : (
              <>
                <Receipt size={15} />
                <span>Ver Comprobante de Atención</span>
              </>
            )}
          </button>
        </div>
      </div>
    </li>
  )
}
