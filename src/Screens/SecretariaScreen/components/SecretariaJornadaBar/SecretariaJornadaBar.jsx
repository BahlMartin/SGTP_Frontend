import React from 'react'
import { Download, Mail } from 'lucide-react'
import './SecretariaJornadaBar.css'

export default function SecretariaJornadaBar({
  jornadaDate,
  onDateChange,
  onExportPdf,
  onSendEmail,
  isSendingEmail = false
}) {
  return (
    <div className="secretaria-jornada-bar">
      <div className="secretaria-jornada-bar__picker">
        <label htmlFor="secretaria-jornada-date-input" className="secretaria-jornada-bar__label">
          Jornada:
        </label>
        <div className="secretaria-jornada-bar__date-wrap">
          <input
            id="secretaria-jornada-date-input"
            type="date"
            value={jornadaDate}
            onChange={(changeEvent) => onDateChange(changeEvent.target.value)}
            className="secretaria-jornada-bar__date-input"
          />
        </div>
      </div>

      <div className="secretaria-jornada-bar__actions">
        <button
          type="button"
          className="secretaria-jornada-bar__btn-export"
          onClick={onExportPdf}
          disabled={isSendingEmail}
        >
          <Download className="secretaria-jornada-bar__btn-icon" />
          <span>exportar PDF</span>
        </button>
        <button
          type="button"
          className="secretaria-jornada-bar__btn-email"
          onClick={onSendEmail}
          disabled={isSendingEmail}
        >
          <Mail className="secretaria-jornada-bar__btn-icon" />
          <span>{isSendingEmail ? 'enviando...' : 'enviar por mail'}</span>
        </button>
      </div>
    </div>
  )
}
