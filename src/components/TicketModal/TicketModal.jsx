import React from 'react'
import { Printer, X, CheckCircle, Ticket as TicketIcon } from 'lucide-react'
import { formatDateDDMMAAAA, formatTimeHHMM } from '../../utils/formatters'
import TriageBadge from '../TriageBadge/TriageBadge'
import './TicketModal.css'

export default function TicketModal({ ticket, onClose }) {
  if (!ticket) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="ticket-modal-overlay">
      <div className="ticket-modal-card">
        <button className="btn-close-modal" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="ticket-header-badge">
          <CheckCircle size={22} className="check-icon" />
          <span>Ticket Asistencial Emitido</span>
        </div>

        {/* Formato de Ticket Impreso */}
        <div className="printable-ticket" id="printable-ticket">
          <div className="ticket-hospital-title">
            <h4>HOSPITAL PÚBLICO SGTP</h4>
            <p>Laboratorio Central & Triage</p>
          </div>

          <div className="ticket-divider-dashed" />

          <div className="ticket-call-number-box">
            <span className="call-number-label">N° DE LLAMADO EXTERNO</span>
            <span className="call-number-big">{ticket.num_llamado || 'S/N'}</span>
            <span className="totem-id">Identificador: {ticket.num_totem}</span>
          </div>

          <div className="ticket-divider-dashed" />

          <div className="ticket-details">
            <div className="ticket-row">
              <span className="row-lbl">Paciente:</span>
              <span className="row-val">
                {ticket.paciente_nombre} {ticket.paciente_apellido}
              </span>
            </div>
            <div className="ticket-row">
              <span className="row-lbl">DNI:</span>
              <span className="row-val">{ticket.paciente_dni}</span>
            </div>
            <div className="ticket-row">
              <span className="row-lbl">Obra Social:</span>
              <span className="row-val">{ticket.paciente_obra_social || 'Particular'}</span>
            </div>
            <div className="ticket-row">
              <span className="row-lbl">Triage:</span>
              <span className="row-val">
                <TriageBadge categoryKey={ticket.clasificacion_triage} />
              </span>
            </div>
            {ticket.justificacion_otro && (
              <div className="ticket-row">
                <span className="row-lbl">Justificación:</span>
                <span className="row-val small">{ticket.justificacion_otro}</span>
              </div>
            )}
            <div className="ticket-row">
              <span className="row-lbl">Estudios:</span>
              <span className="row-val small">
                {ticket.estudios?.length > 0 ? ticket.estudios.join(', ') : 'Rutina estándar'}
              </span>
            </div>
            <div className="ticket-row">
              <span className="row-lbl">Fecha y Hora:</span>
              <span className="row-val">
                {formatDateDDMMAAAA(ticket.fecha_hora_admision)} {formatTimeHHMM(ticket.fecha_hora_admision)}
              </span>
            </div>
            <div className="ticket-row">
              <span className="row-lbl">Admisión:</span>
              <span className="row-val">{ticket.mat_admision || 'TEC-ADM'}</span>
            </div>
          </div>

          <div className="ticket-divider-dashed" />

          <div className="ticket-footer-notice">
            <p>Por favor aguarde su turno en la sala de espera frente a la pantalla multibox.</p>
            <span className="ticket-uuid">UUID: {ticket.id}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-print-ticket" onClick={handlePrint}>
            <Printer size={18} />
            Imprimir Ticket
          </button>
          <button className="btn-done-ticket" onClick={onClose}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
