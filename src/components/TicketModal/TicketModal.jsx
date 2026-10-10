import React, { useEffect } from 'react'
import { Printer, X, CheckCircle } from 'lucide-react'
import { formatDateDDMMAAAA, formatTimeHHMM } from '../../utils/formatters'
import TriageBadge from '../TriageBadge/TriageBadge'
import './TicketModal.css'

export default function TicketModal({ ticket, onClose }) {
  useEffect(() => {
    if (!ticket) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [ticket, onClose])

  if (!ticket) return null

  const handlePrint = () => {
    const printableTicket = document.getElementById('printable-ticket')
    if (!printableTicket) {
      throw new Error('No se encontró el contenido del ticket para imprimir.')
    }

    const printElements = []
    const hideElements = []
    const printPageStyle = document.createElement('style')
    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup)
      document.body.classList.remove('ticket-printing')
      printElements.forEach((element) => element.classList.remove('ticket-print-ancestor'))
      hideElements.forEach((element) => element.classList.remove('ticket-print-hidden'))
      printPageStyle.remove()
    }

    document.body.classList.add('ticket-printing')
    let element = printableTicket
    while (element) {
      element.classList.add('ticket-print-ancestor')
      printElements.push(element)

      const parent = element.parentElement
      if (parent) {
        Array.from(parent.children).forEach((sibling) => {
          if (sibling !== element) {
            sibling.classList.add('ticket-print-hidden')
            hideElements.push(sibling)
          }
        })
      }

      element = parent
    }

    const ticketHeightMm = Math.ceil(
      (printableTicket.getBoundingClientRect().height * 25.4) / 96 + 2
    )
    printPageStyle.textContent = `@page { size: 80mm ${ticketHeightMm}mm; margin: 0; }`
    document.head.appendChild(printPageStyle)

    window.addEventListener('afterprint', cleanup, { once: true })
    try {
      window.print()
    } catch (error) {
      cleanup()
      throw error
    }
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.()
    }
  }

  const formatAdmision = () => {
    const nombre = ticket.personal_admision_nombre?.trim()
    const matricula = (ticket.personal_admision_matricula || ticket.mat_admision)?.trim()

    if (nombre && matricula) {
      return `${nombre} (Mat. ${matricula})`
    }
    if (nombre) {
      return nombre
    }
    if (matricula) {
      return `Mat. ${matricula}`
    }
    return 'No informada'
  }

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
    {
      label: 'Estudios:',
      value: ticket.estudios?.length > 0 ? ticket.estudios.join(', ') : 'Rutina estándar',
      small: true
    }
  ].filter(Boolean)

  return (
    <div
      className="ticket-modal"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
    >
      <div className="ticket-modal__card">
        <button className="ticket-modal__close-btn" onClick={onClose} aria-label="Cerrar modal">
          <X className="ticket-modal__close-icon" />
        </button>

        <div className="ticket-modal__badge" id="ticket-modal-title">
          <CheckCircle className="ticket-modal__badge-icon" />
          <span>Ticket Asistencial Emitido</span>
        </div>

        {/* Formato de Ticket Impreso */}
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
