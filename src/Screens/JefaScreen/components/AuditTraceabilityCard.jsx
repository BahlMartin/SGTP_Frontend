import React from 'react'
import { Download, Mail, Edit2 } from 'lucide-react'
import TriageBadge from '../../../components/TriageBadge/TriageBadge'
import { formatTimeHHMM } from '../../../utils/formatters'
import './AuditTraceabilityCard.css'

export default function AuditTraceabilityCard({
  jornadaDate,
  onDateChange,
  onExportPdf,
  onSendEmail,
  tickets = [],
  onOpenEditTicket
}) {
  return (
    <div className="jefa-screen__audit-card">
      <div className="jefa-screen__audit-header">
        <h3 className="jefa-screen__audit-title">Auditoria y trazabilidad</h3>
        <div className="jefa-screen__audit-controls">
          <div className="jefa-screen__date-box">
            <input
              type="date"
              value={jornadaDate}
              onChange={(event) => onDateChange(event.target.value)}
              className="jefa-screen__date-input"
            />
          </div>
          <button className="jefa-screen__btn-export" onClick={onExportPdf}>
            <Download className="jefa-screen__btn-export-icon" />
            exportar PDF
          </button>
          <button className="jefa-screen__btn-email" onClick={onSendEmail}>
            <Mail className="jefa-screen__btn-email-icon" />
            enviar por mail
          </button>
        </div>
      </div>

      <div className="jefa-screen__audit-table-wrap">
        <table className="jefa-screen__audit-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Paciente</th>
              <th>Triage</th>
              <th>Estado</th>
              <th>Mat.Admisión</th>
              <th>Mat.Box</th>
              <th>Emisión</th>
              <th>Llamado</th>
              <th>Cierre</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {tickets.slice(0, 8).map((ticketItem) => (
              <tr key={ticketItem.id}>
                <td className="jefa-screen__audit-id">
                  {ticketItem.num_totem || ticketItem.id}
                </td>
                <td className="jefa-screen__audit-patient">
                  {ticketItem.paciente_nombre} {ticketItem.paciente_apellido}
                </td>
                <td>
                  <TriageBadge
                    categoryKey={ticketItem.clasificacion_triage}
                    showPriority={false}
                  />
                </td>
                <td>
                  <span
                    className={`jefa-screen__state-pill ${
                      ticketItem.estado === 'Atendido'
                        ? 'jefa-screen__state-pill--done'
                        : ticketItem.estado === 'En atencion'
                        ? 'jefa-screen__state-pill--progress'
                        : 'jefa-screen__state-pill--wait'
                    }`}
                  >
                    {ticketItem.estado}
                  </span>
                </td>
                <td className="jefa-screen__audit-mat">
                  {ticketItem.mat_admision || '—'}
                </td>
                <td className="jefa-screen__audit-mat">
                  {ticketItem.mat_box || '—'}
                </td>
                <td className="jefa-screen__audit-time">
                  {formatTimeHHMM(ticketItem.fecha_hora_admision)}
                </td>
                <td className="jefa-screen__audit-time">
                  {formatTimeHHMM(ticketItem.fecha_hora_llamado)}
                </td>
                <td className="jefa-screen__audit-time">
                  {formatTimeHHMM(ticketItem.fecha_hora_cierre)}
                </td>
                <td>
                  <button
                    className="jefa-screen__btn-edit-ticket"
                    title="Editar clasificación dentro de las 24hs"
                    onClick={() => onOpenEditTicket(ticketItem)}
                  >
                    <Edit2 className="jefa-screen__btn-edit-icon" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
