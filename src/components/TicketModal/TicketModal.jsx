import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X, CheckCircle, ArrowLeft } from 'lucide-react'
import { printStudyLabels, printThermalTicket } from '../../utils/ticketPrint.utils'
import TicketReceipt from './components/TicketReceipt'
import './TicketModal.css'

const getStudyName = (study) => {
  if (typeof study === 'string') return study
  return study?.estudio_detalle?.nombre || study?.study_detail?.nombre || study?.nombre || 'Estudio'
}

const getStudyId = (study) => {
  if (typeof study === 'string') return `name:${study.trim().toLowerCase()}`
  const id = study?.id ?? study?.estudio ?? study?.estudio_detalle?.id ?? study?.study_detail?.id
  return String(id ?? `name:${getStudyName(study).trim().toLowerCase()}`)
}

const getStudySource = (study) =>
  typeof study === 'string' ? 'admision' : String(study?.origen || 'admision').trim().toLowerCase()

const getStudyPrintIdentity = (study) => {
  const source = getStudySource(study)
  const normalizedName = getStudyName(study).trim().toLowerCase()
  return `${source}:${getStudyId(study)}:${normalizedName}`
}

const isStudyPrinted = (study, printedStudyIds) =>
  printedStudyIds.includes(study.id) ||
  (study.source !== 'box' && printedStudyIds.includes(study.legacyId))

const getSampleType = (study) => {
  const detail = study?.estudio_detalle || study?.study_detail || {}
  const sample = detail.tipo_muestra || detail.muestra || detail.sample_type ||
    study?.tipo_muestra || study?.muestra || study?.sample_type || study?.sample
  if (sample && typeof sample === 'object') {
    return sample.nombre || sample.name || 'No especificado'
  }
  return sample ? String(sample) : 'No especificado'
}

const getPrintableStudies = (ticket) => {
  const rawStudies = Array.isArray(ticket.estudios_raw) && ticket.estudios_raw.length > 0
    ? ticket.estudios_raw
    : (ticket.estudios || [])

  return rawStudies
    .filter((study) => typeof study === 'string' || study?.estado !== 'Cancelado')
    .map((study) => ({
      id: getStudyPrintIdentity(study),
      legacyId: getStudyId(study),
      source: getStudySource(study),
      name: getStudyName(study),
      sampleType: getSampleType(study)
    }))
}

const getPrintedStudiesStorageKey = (ticketId) => `sgtp_admision_printed_labels_${ticketId}`

const readPrintedStudyIds = (storageKey) => {
  try {
    const stored = window.localStorage.getItem(storageKey)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch (error) {
    console.warn('No se pudo leer el registro local de etiquetas impresas:', error)
    return []
  }
}

export default function TicketModal({
  ticket,
  onClose,
  title = '',
  className = '',
  canPrintLabels = false,
  showCloseAction = true
}) {
  const [isChoosingLabels, setIsChoosingLabels] = useState(false)
  const [labelMode, setLabelMode] = useState('pending')
  const [printedStudyIds, setPrintedStudyIds] = useState([])
  const [selectedStudyIds, setSelectedStudyIds] = useState([])
  const [labelPrintError, setLabelPrintError] = useState('')
  const [isPrintingLabels, setIsPrintingLabels] = useState(false)
  const printableStudies = useMemo(
    () => ticket ? getPrintableStudies(ticket) : [],
    [ticket]
  )
  const printedStudiesStorageKey = getPrintedStudiesStorageKey(ticket?.id || ticket?.id_ticket || 'unknown')

  useEffect(() => {
    setPrintedStudyIds(readPrintedStudyIds(printedStudiesStorageKey))
    setSelectedStudyIds(printableStudies.map((study) => study.id))
    setIsChoosingLabels(false)
    setLabelMode('pending')
    setLabelPrintError('')
  }, [printedStudiesStorageKey, printableStudies])

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

  const pendingStudies = printableStudies.filter((study) => !isStudyPrinted(study, printedStudyIds))
  const selectedStudies = labelMode === 'pending'
    ? pendingStudies
    : printableStudies.filter((study) => selectedStudyIds.includes(study.id))

  const handlePrintLabels = () => {
    if (selectedStudies.length === 0) {
      setLabelPrintError('No hay estudios seleccionados para imprimir.')
      return
    }

    setLabelPrintError('')
    setIsPrintingLabels(true)
    try {
      printStudyLabels('printable-study-labels', {
        onAfterPrint: () => {
          const updatedIds = [...new Set([...printedStudyIds, ...selectedStudies.map((study) => study.id)])]
          try {
            window.localStorage.setItem(printedStudiesStorageKey, JSON.stringify(updatedIds))
            setPrintedStudyIds(updatedIds)
          } catch (error) {
            console.error('No se pudo guardar el registro de etiquetas impresas:', error)
            setLabelPrintError('Las etiquetas se enviaron a impresión, pero no se pudo guardar cuáles fueron impresas.')
          } finally {
            setIsPrintingLabels(false)
          }
        },
        onWindowClose: () => {
          setIsPrintingLabels(false)
        }
      })
    } catch (error) {
      console.error('No se pudieron imprimir las etiquetas:', error)
      setLabelPrintError(error.message || 'No se pudieron imprimir las etiquetas.')
      setIsPrintingLabels(false)
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
          <span>{isChoosingLabels ? 'Imprimir etiquetas de estudios' : badgeText}</span>
        </div>

        {isChoosingLabels ? (
          <section className="ticket-modal__labels-panel" aria-label="Seleccionar etiquetas">
            <p className="ticket-modal__labels-patient">
              {ticket.paciente_nombre} {ticket.paciente_apellido} · DNI {ticket.paciente_dni || 'No informado'}
            </p>

            <div className="ticket-modal__labels-modes" role="radiogroup" aria-label="Modo de impresión">
              <label>
                <input
                  type="radio"
                  name="label-print-mode"
                  checked={labelMode === 'pending'}
                  onChange={() => setLabelMode('pending')}
                />
                Todas las etiquetas pendientes ({pendingStudies.length})
              </label>
              <label>
                <input
                  type="radio"
                  name="label-print-mode"
                  checked={labelMode === 'custom'}
                  onChange={() => setLabelMode('custom')}
                />
                Elegir estudios
              </label>
            </div>

            <div className="ticket-modal__labels-list">
              {printableStudies.map((study) => {
                const isPrinted = isStudyPrinted(study, printedStudyIds)
                return (
                  <label className="ticket-modal__label-option" key={study.id}>
                    <input
                      type="checkbox"
                      checked={labelMode === 'pending' ? !isPrinted : selectedStudyIds.includes(study.id)}
                      disabled={labelMode === 'pending'}
                      onChange={() => {
                        setSelectedStudyIds((current) => current.includes(study.id)
                          ? current.filter((id) => id !== study.id)
                          : [...current, study.id])
                      }}
                    />
                    <span>
                      <strong>{study.name}</strong>
                      <small>Muestra: {study.sampleType}{isPrinted ? ' · Ya impresa' : ''}</small>
                    </span>
                  </label>
                )
              })}
              {printableStudies.length === 0 && (
                <p className="ticket-modal__labels-empty">Este ticket no tiene estudios activos para etiquetar.</p>
              )}
            </div>
            {labelPrintError && <p className="ticket-modal__labels-error" role="alert">{labelPrintError}</p>}
          </section>
        ) : (
          <TicketReceipt ticket={ticket} />
        )}

        <div id="printable-study-labels" aria-hidden="true">
          {selectedStudies.map((study) => (
            <article className="ticket-study-label" key={study.id}>
              <strong className="ticket-study-label__patient">
                {ticket.paciente_nombre} {ticket.paciente_apellido}
              </strong>
              <span className="ticket-study-label__dni">DNI: {ticket.paciente_dni || 'No informado'}</span>
              <strong className="ticket-study-label__study">{study.name}</strong>
              <span className="ticket-study-label__sample">Muestra: {study.sampleType}</span>
            </article>
          ))}
        </div>

        <div className="ticket-modal__actions">
          {isChoosingLabels ? (
            <>
              <button
                className="ticket-modal__print-btn"
                onClick={handlePrintLabels}
                disabled={isPrintingLabels || selectedStudies.length === 0}
              >
                <Printer className="ticket-modal__print-icon" />
                Imprimir {labelMode === 'pending' ? 'pendientes' : `seleccionadas (${selectedStudies.length})`}
              </button>
              <button
                className="ticket-modal__done-btn"
                onClick={() => {
                  setIsChoosingLabels(false)
                  setLabelPrintError('')
                }}
              >
                <ArrowLeft size={16} /> Volver
              </button>
            </>
          ) : (
            <>
              <button className="ticket-modal__print-btn" onClick={handlePrint}>
                <Printer className="ticket-modal__print-icon" />
                Imprimir Ticket
              </button>
              {canPrintLabels && (
                <button
                  className="ticket-modal__print-btn ticket-modal__print-labels-btn"
                  onClick={() => {
                    setLabelMode('pending')
                    setSelectedStudyIds([])
                    setIsChoosingLabels(true)
                    setLabelPrintError('')
                  }}
                >
                  <Printer className="ticket-modal__print-icon" />
                  Imprimir Etiquetas
                </button>
              )}
            </>
          )}
          {showCloseAction && (
            <button className="ticket-modal__done-btn" onClick={onClose}>
              Aceptar
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
