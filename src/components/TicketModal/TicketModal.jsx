import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X, CheckCircle } from 'lucide-react'
import { printThermalTicket } from '../../utils/ticketPrint.utils'
import TicketReceipt from './components/TicketReceipt'
import './TicketModal.css'

export default function TicketModal({ ticket, onClose, title = '', className = '' }) {
  useEffect(() => {
    if (!ticket) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [ticket, onClose])

  if (!ticket) return null

  const handlePrint = () => {
    try {
      printThermalTicket('printable-ticket')
    } catch (err) {
      console.warn('Aviso en impresión térmica, usando fallback:', err)
      window.print()
    }
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.()
    }
  }

  const isAtendido = ticket.estado === 'Atendido' || ticket.estado === 'Finalizado' || ticket.estado_backend === 'Finalizado'
  const badgeText = title || (isAtendido ? 'Comprobante de Retiro de Estudios' : 'Ticket de Turno para Sala de Espera')

  return createPortal(
    <div
      className={`ticket-modal ${className}`.trim()}
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
          <span>{badgeText}</span>
        </div>

        {/* Presentación del Comprobante / Recibo */}
        <TicketReceipt ticket={ticket} />

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
    </div>,
    document.body
  )
}
