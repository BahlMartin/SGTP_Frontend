import React from 'react'
import { formatDateDDMMAAAA, formatTimeHHMM } from '../../../utils/formatters'
import TriageBadge from '../../TriageBadge/TriageBadge'
import './TicketReceipt.css'

export default function TicketReceipt({ ticket }) {
  if (!ticket) return null

  const formatAdmision = () => {
    const nombre = ticket.personal_admision_nombre?.trim()
    const matricula = (ticket.personal_admision_matricula || ticket.mat_admision)?.trim()

    if (nombre && matricula) return `${nombre} (Mat. ${matricula})`
    if (nombre) return nombre
    if (matricula) return `Mat. ${matricula}`
    return 'No informada'
  }

  const formatBoxOperador = () => {
    const nombre = ticket.personal_box_nombre?.trim()
    const matricula = ticket.personal_box_matricula?.trim()

    if (nombre && matricula) return `${nombre} (Mat. ${matricula})`
    if (nombre) return nombre
    if (matricula) return `Mat. ${matricula}`
    return ''
  }

  const boxOperador = formatBoxOperador()
  const boxIdentificador = ticket.box_numero
    ? `Box ${ticket.box_numero}`
    : (ticket.box_asignado || (ticket.estado === 'Atendido' || ticket.estado === 'Finalizado' ? 'Box asignado' : 'En espera'))

  const detailRows = [
    { label: 'Paciente:', value: `${ticket.paciente_nombre} ${ticket.paciente_apellido}` },
    { label: 'DNI:', value: ticket.paciente_dni },
    { label: 'N° Afiliado:', value: ticket.paciente_numero_afiliado || 'No informado' },
    { label: 'Triage:', value: <TriageBadge categoryKey={ticket.clasificacion_triage} /> },
    ticket.justificacion_otro && {
      label: 'Justificación:',
      value: ticket.justificacion_otro,
      small: true
    },
    {
      label: 'Fecha y Hora:',
      value: `${formatDateDDMMAAAA(ticket.fecha_hora_admision)} ${formatTimeHHMM(ticket.fecha_hora_admision)}`
    },
    { label: 'Admisión:', value: formatAdmision() },
    { label: 'Box de Atención:', value: boxIdentificador },
    boxOperador && { label: 'Técnico de Box:', value: boxOperador },
    ticket.fecha_hora_atencion_box && {
      label: 'Hora Box:',
      value: `${formatDateDDMMAAAA(ticket.fecha_hora_atencion_box)} ${formatTimeHHMM(ticket.fecha_hora_atencion_box)}`
    },
    {
      label: 'Estudios:',
      value: ticket.estudios?.length > 0 ? ticket.estudios.join(', ') : 'Rutina estándar',
      small: true
    }
  ].filter(Boolean)

  return (
    <div className="ticket-modal__receipt" id="printable-ticket">
      <div className="ticket-modal__receipt-header">
        <h4 className="ticket-modal__hospital-name">HOSPITAL PÚBLICO SGTP</h4>
        <p className="ticket-modal__hospital-sub">Laboratorio Central & Triage</p>
      </div>

      <div className="ticket-modal__call-box">
        <span className="ticket-modal__call-label">N° DE LLAMADO EXTERNO</span>
        <span className="ticket-modal__call-number">{ticket.num_llamado || 'S/N'}</span>
        <span className="ticket-modal__totem-id">Identificador: {ticket.num_totem}</span>
      </div>

      <div className="ticket-modal__details">
        {detailRows.map((row) => (
          <div className="ticket-modal__row" key={row.label}>
            <span className="ticket-modal__row-label">{row.label}</span>
            <span className={`ticket-modal__row-value ${row.small ? 'ticket-modal__row-value--small' : ''}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="ticket-modal__receipt-footer">
        <p>Por favor aguarde su turno en la sala de espera frente a la pantalla multibox.</p>
        <span className="ticket-modal__uuid">UUID: {ticket.id}</span>
      </div>
    </div>
  )
}
