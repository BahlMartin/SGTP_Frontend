import React from 'react'
import { Printer, X, CheckCircle } from 'lucide-react'
import { formatDateDDMMAAAA, formatTimeHHMM } from '../../utils/formatters'
import TriageBadge from '../TriageBadge/TriageBadge'
import './TicketModal.css'

export default function TicketModal({ ticket, onClose }) {
  if (!ticket) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="ticket-modal">
      <div className="ticket-modal__card">
        <button className="ticket-modal__close-btn" onClick={onClose} aria-label="Cerrar modal">
          <X className="ticket-modal__close-icon" />
        </button>

        <div className="ticket-modal__badge">
          <CheckCircle className="ticket-modal__badge-icon" />
          <span>Ticket Asistencial Emitido</span>
        </div>

        {/* Formato de Ticket Impreso */}
        <div className="ticket-modal__receipt" id="printable-ticket">
          <div className="ticket-modal__receipt-header">
            <h4 className="ticket-modal__hospital-name">HOSPITAL PÚBLICO SGTP</h4>
            <p className="ticket-modal__hospital-sub">Laboratorio Central & Triage</p>
          </div>

          <div className="ticket-modal__divider" />

          <div className="ticket-modal__call-box">
            <span className="ticket-modal__call-label">N° DE LLAMADO EXTERNO</span>
            <span className="ticket-modal__call-number">{ticket.num_llamado || 'S/N'}</span>
            <span className="ticket-modal__totem-id">Identificador: {ticket.num_totem}</span>
          </div>

          <div className="ticket-modal__divider" />

          <div className="ticket-modal__details">
            <div className="ticket-modal__row">
              <span className="ticket-modal__row-label">Paciente:</span>
              <span className="ticket-modal__row-value">
                {ticket.paciente_nombre} {ticket.paciente_apellido}
              </span>
            </div>
            <div className="ticket-modal__row">
              <span className="ticket-modal__row-label">DNI:</span>
              <span className="ticket-modal__row-value">{ticket.paciente_dni}</span>
            </div>
            <div className="ticket-modal__row">
              <span className="ticket-modal__row-label">Obra Social:</span>
              <span className="ticket-modal__row-value">{ticket.paciente_obra_social || 'Particular'}</span>
            </div>
            <div className="ticket-modal__row">
              <span className="ticket-modal__row-label">Triage:</span>
              <span className="ticket-modal__row-value">
                <TriageBadge categoryKey={ticket.clasificacion_triage} />
              </span>
            </div>
            {ticket.justificacion_otro && (
              <div className="ticket-modal__row">
                <span className="ticket-modal__row-label">Justificación:</span>
                <span className="ticket-modal__row-value ticket-modal__row-value--small">{ticket.justificacion_otro}</span>
              </div>
            )}
            <div className="ticket-modal__row">
              <span className="ticket-modal__row-label">Estudios:</span>
              <span className="ticket-modal__row-value ticket-modal__row-value--small">
                {ticket.estudios?.length > 0 ? ticket.estudios.join(', ') : 'Rutina estándar'}
              </span>
            </div>
            <div className="ticket-modal__row">
              <span className="ticket-modal__row-label">Fecha y Hora:</span>
              <span className="ticket-modal__row-value">
                {formatDateDDMMAAAA(ticket.fecha_hora_admision)} {formatTimeHHMM(ticket.fecha_hora_admision)}
              </span>
            </div>
            <div className="ticket-modal__row">
              <span className="ticket-modal__row-label">Admisión:</span>
              <span className="ticket-modal__row-value">{ticket.mat_admision || 'TEC-ADM'}</span>
            </div>
          </div>

          <div className="ticket-modal__divider" />

          <div className="ticket-modal__receipt-footer">
            <p>Por favor aguarde su turno en la sala de espera frente a la pantalla multibox.</p>
            <span className="ticket-modal__uuid">UUID: {ticket.id}</span>
          </div>
        </div>

        <div className="ticket-modal__actions">
          <button className="ticket-modal__print-btn" onClick={handlePrint}>
            <Printer className="ticket-modal__print-icon" />
            Imprimir Ticket
          </button>
          <button className="ticket-modal__done-btn" onClick={onClose}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
