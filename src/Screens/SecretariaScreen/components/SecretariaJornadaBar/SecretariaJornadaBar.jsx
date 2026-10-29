import React, { useState, useRef, useEffect } from 'react'
import { ArrowUpRight, Download, FileSpreadsheet, Mail, User, UserPlus, ChevronDown } from 'lucide-react'
import './SecretariaJornadaBar.css'

export default function SecretariaJornadaBar({
  jornadaDate,
  onDateChange,
  onExportPdf,
  onExportExcel,
  onSendEmail,
  onOpenThirdPartyEmailModal,
  userEmail = '',
  isSendingEmail = false
}) {
  const [isEmailMenuOpen, setIsEmailMenuOpen] = useState(false)
  const menuContainerRef = useRef(null)

  useEffect(() => {
    if (!isEmailMenuOpen) return

    function handleClickOutside(event) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target)) {
        setIsEmailMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsEmailMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEmailMenuOpen])

  const handleSendToSelf = () => {
    setIsEmailMenuOpen(false)
    if (onSendEmail) {
      onSendEmail()
    }
  }

  const handleSendToThirdParty = () => {
    setIsEmailMenuOpen(false)
    if (onOpenThirdPartyEmailModal) {
      onOpenThirdPartyEmailModal()
    }
  }

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
          aria-label="Descargar reporte como PDF"
          title="Descargar reporte como PDF"
        >
          <Download className="secretaria-jornada-bar__btn-icon" />
          <span className="secretaria-jornada-bar__btn-label">PDF</span>
        </button>
        {onExportExcel && (
          <button
            type="button"
            className="secretaria-jornada-bar__btn-excel"
            onClick={onExportExcel}
            disabled={isSendingEmail}
            aria-label="Descargar reporte como Excel"
            title="Descargar reporte como Excel (.xlsx)"
          >
            <FileSpreadsheet className="secretaria-jornada-bar__btn-icon" />
            <span className="secretaria-jornada-bar__btn-label">Excel</span>
          </button>
        )}

        <div className="secretaria-jornada-bar__email-dropdown" ref={menuContainerRef}>
          <button
            type="button"
            className="secretaria-jornada-bar__btn-email"
            onClick={() => setIsEmailMenuOpen((prev) => !prev)}
            disabled={isSendingEmail}
            aria-haspopup="menu"
            aria-expanded={isEmailMenuOpen}
            aria-label={isSendingEmail ? 'Enviando reporte por mail' : 'Opciones de envío por mail'}
            title={isSendingEmail ? 'Enviando reporte por mail' : 'Enviar reporte por mail'}
          >
            <span className="secretaria-jornada-bar__email-icon" aria-hidden="true">
              <Mail className="secretaria-jornada-bar__btn-icon" />
              <ArrowUpRight className="secretaria-jornada-bar__email-arrow" />
            </span>
            <ChevronDown className="secretaria-jornada-bar__email-chevron" aria-hidden="true" />
          </button>

          {isEmailMenuOpen && (
            <div className="secretaria-jornada-bar__email-menu" role="menu">
              <button
                type="button"
                className="secretaria-jornada-bar__email-menu-item"
                role="menuitem"
                onClick={handleSendToSelf}
              >
                <User className="secretaria-jornada-bar__email-menu-icon" size={16} />
                <div className="secretaria-jornada-bar__email-menu-text">
                  <span className="secretaria-jornada-bar__email-menu-title">Enviar a mi correo</span>
                  {userEmail && (
                    <span className="secretaria-jornada-bar__email-menu-sub">{userEmail}</span>
                  )}
                </div>
              </button>

              <button
                type="button"
                className="secretaria-jornada-bar__email-menu-item"
                role="menuitem"
                onClick={handleSendToThirdParty}
              >
                <UserPlus className="secretaria-jornada-bar__email-menu-icon" size={16} />
                <div className="secretaria-jornada-bar__email-menu-text">
                  <span className="secretaria-jornada-bar__email-menu-title">
                    Enviar a otro destinatario...
                  </span>
                  <span className="secretaria-jornada-bar__email-menu-sub">
                    Ingresar correo manualmente
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
