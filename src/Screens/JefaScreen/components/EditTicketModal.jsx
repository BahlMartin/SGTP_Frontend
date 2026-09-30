import React, { useState } from 'react'
import { X } from 'lucide-react'
import { TRIAGE_LIST } from '../../../constants/triage.constants'
import './EditTicketModal.css'

export default function EditTicketModal({
  ticket,
  onClose,
  onSave
}) {
  const [editTriage, setEditTriage] = useState(() => ticket?.clasificacion_triage || '')
  const [editJustification, setEditJustification] = useState(
    () => ticket?.justificacion_otro || ''
  )

  if (!ticket) return null

  const handleConfirm = () => {
    onSave(ticket.id, {
      clasificacion_triage: editTriage,
      justificacion_otro: editJustification
    })
  }

  return (
    <div className="jefa-screen__modal-overlay">
      <div className="jefa-screen__modal-card">
        <button className="jefa-screen__modal-close" onClick={onClose}>
          <X className="jefa-screen__modal-close-icon" />
        </button>
        <h3 className="jefa-screen__modal-title">Modificar Ticket Asistencial (Jefa)</h3>
        <p className="jefa-screen__modal-desc">
          Ticket: <strong>{ticket.num_totem}</strong> — Paciente:{' '}
          <strong>
            {ticket.paciente_nombre} {ticket.paciente_apellido}
          </strong>
        </p>

        <div className="jefa-screen__modal-field">
          <label>Reclasificar Triage:</label>
          <select
            className="jefa-screen__modal-select"
            value={editTriage}
            onChange={(event) => setEditTriage(event.target.value)}
          >
            {TRIAGE_LIST.map((triageOption) => (
              <option key={triageOption.id} value={triageOption.key}>
                {triageOption.code}. {triageOption.key}{' '}
                {triageOption.subtitle ? `(${triageOption.subtitle})` : ''}
              </option>
            ))}
          </select>
        </div>

        {editTriage === 'Otro' && (
          <div className="jefa-screen__modal-field">
            <label>Justificación técnica:</label>
            <textarea
              className="jefa-screen__modal-textarea"
              rows={3}
              value={editJustification}
              onChange={(event) => setEditJustification(event.target.value)}
              placeholder="Justifique el motivo de reclasificación..."
            />
          </div>
        )}

        <div className="jefa-screen__modal-actions">
          <button className="jefa-screen__btn-save" onClick={handleConfirm}>
            Confirmar Modificación
          </button>
          <button className="jefa-screen__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
