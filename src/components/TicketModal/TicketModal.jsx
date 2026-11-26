import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X, CheckCircle, ArrowLeft, AlertTriangle } from 'lucide-react'
import { printStudyLabels, printThermalTicket } from '../../utils/ticketPrint.utils'
import { markTicketLabelsPrintedApi } from '../../services/ticketService'
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

const getStudyNumericDbId = (study) => {
  if (!study || typeof study === 'string') return null
  const numericId = Number(study.id)
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null
}

const getStudySource = (study) =>
  typeof study === 'string' ? 'admision' : String(study?.origen || 'admision').trim().toLowerCase()

const getStudyPrintIdentity = (study) => {
  const source = getStudySource(study)
  const normalizedName = getStudyName(study).trim().toLowerCase()
  return `${source}:${getStudyId(study)}:${normalizedName}`
}

const getSampleType = (study) => {
  const detail = study?.estudio_detalle || study?.study_detail || {}
  const sample = detail.tipo_muestra || detail.muestra || detail.sample_type ||
    study?.tipo_muestra || study?.muestra || study?.sample_type || study?.sample
  if (sample && typeof sample === 'object') {
    return sample.nombre || sample.name || 'No especificado'
  }
  return sample ? String(sample) : 'No especificado'
}

const getAdaptiveFontClass = (text) => {
  const len = String(text || '').trim().length
  if (len <= 22) return 'ticket-study-label__text--lg'
  if (len <= 34) return 'ticket-study-label__text--md'
  if (len <= 48) return 'ticket-study-label__text--sm'
  return 'ticket-study-label__text--xs'
}

const resolveLabelStatus = (study) => {
  if (typeof study === 'string') return 'pendiente'
  if (study?.estado === 'Cancelado') return 'cancelado_box'
  if (study?.estado_etiqueta) return study.estado_etiqueta

  const impresa = Boolean(study?.etiqueta_impresa)
  const impresaAt = study?.etiqueta_impresa_at ? new Date(study.etiqueta_impresa_at).getTime() : 0
  const modAt = study?.fecha_hora_modificacion ? new Date(study.fecha_hora_modificacion).getTime() : 0

  if (impresa && (!modAt || !impresaAt || modAt <= impresaAt)) {
    return 'impresa'
  }
  if (getStudySource(study) === 'box') return 'agregado_box'
  if (study?.fecha_hora_modificacion) return 'modificado_box'
  return 'pendiente'
}

const getRawStudiesList = (ticket) => {
  if (!ticket) return []
  return Array.isArray(ticket.estudios_raw) && ticket.estudios_raw.length > 0
    ? ticket.estudios_raw
    : (ticket.estudios || [])
}

const getPrintableStudies = (ticket) => {
  return getRawStudiesList(ticket)
    .filter((study) => typeof study === 'string' || study?.estado !== 'Cancelado')
    .map((study) => ({
      id: getStudyPrintIdentity(study),
      legacyId: getStudyId(study),
      dbId: getStudyNumericDbId(study),
      source: getStudySource(study),
      name: getStudyName(study),
      sampleType: getSampleType(study),
      motivo: typeof study === 'string' ? '' : (study?.motivo_modificacion || ''),
      etiquetaImpresa: typeof study === 'string' ? false : Boolean(study?.etiqueta_impresa),
      estadoEtiqueta: resolveLabelStatus(study)
    }))
}

const getCancelledStudies = (ticket) => {
  return getRawStudiesList(ticket)
    .filter((study) => typeof study !== 'string' && study?.estado === 'Cancelado')
    .map((study) => ({
      id: getStudyPrintIdentity(study),
      dbId: getStudyNumericDbId(study),
      name: getStudyName(study),
      sampleType: getSampleType(study),
      motivo: study?.motivo_modificacion || '',
      etiquetaImpresa: Boolean(study?.etiqueta_impresa)
    }))
}

const getPrintedStudiesStorageKey = (ticketId) => `sgtp_admision_printed_labels_${ticketId}`

const readLegacyPrintedIds = (storageKey) => {
  try {
    const stored = window.localStorage.getItem(storageKey)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

const isStudyAlreadyPrinted = (study, legacyPrintedIds) => {
  if (study.dbId !== null) {
    return study.estadoEtiqueta === 'impresa'
  }
  return (
    study.estadoEtiqueta === 'impresa' ||
    legacyPrintedIds.includes(study.id) ||
    (study.source !== 'box' && legacyPrintedIds.includes(study.legacyId))
  )
}

export default function TicketModal({
  ticket,
  onClose,
  onLabelsPrinted,
  title = '',
  className = '',
  canPrintLabels = false,
  showCloseAction = true
}) {
  const [ticketOverride, setTicketOverride] = useState({ source: null, updated: null })
  const [isChoosingLabels, setIsChoosingLabels] = useState(false)
  const [labelMode, setLabelMode] = useState('pending')
  const [legacyPrintedIds, setLegacyPrintedIds] = useState(() =>
    readLegacyPrintedIds(
      getPrintedStudiesStorageKey(ticket?.id || ticket?.id_ticket || 'unknown')
    )
  )
  const [selectedStudyIds, setSelectedStudyIds] = useState([])
  const [labelPrintError, setLabelPrintError] = useState('')
  const [isPrintingLabels, setIsPrintingLabels] = useState(false)
  const [pendingConfirmationStudies, setPendingConfirmationStudies] = useState(null)
  const [isConfirmingPrint, setIsConfirmingPrint] = useState(false)

  const activeTicket =
    ticketOverride.source === ticket && ticketOverride.updated ? ticketOverride.updated : ticket
  const ticketId = activeTicket?.id || activeTicket?.id_ticket || 'unknown'
  const printedStudiesStorageKey = getPrintedStudiesStorageKey(ticketId)

  const printableStudies = useMemo(
    () => (activeTicket ? getPrintableStudies(activeTicket) : []),
    [activeTicket]
  )
  const cancelledStudies = useMemo(
    () => (activeTicket ? getCancelledStudies(activeTicket) : []),
    [activeTicket]
  )

  useEffect(() => {
    if (!activeTicket) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTicket, onClose])

  if (!activeTicket) return null

  const handlePrint = () => {
    try {
      printThermalTicket('printable-ticket')
    } catch (err) {
      console.warn('Aviso en impresión térmica, usando fallback:', err)
      window.print()
    }
  }

  const pendingStudies = printableStudies.filter(
    (study) => !isStudyAlreadyPrinted(study, legacyPrintedIds)
  )
  const selectedStudies = labelMode === 'pending'
    ? pendingStudies
    : printableStudies.filter((study) => selectedStudyIds.includes(study.id))

  const handlePrintLabels = () => {
    if (selectedStudies.length === 0) {
      setLabelPrintError('No hay estudios seleccionados para imprimir.')
      return
    }

    const studiesSnapshot = [...selectedStudies]
    setLabelPrintError('')
    setPendingConfirmationStudies(null)
    setIsPrintingLabels(true)
    try {
      printStudyLabels('printable-study-labels', {
        onAfterPrint: () => {
          setIsPrintingLabels(false)
          setPendingConfirmationStudies(studiesSnapshot)
        }
      })
    } catch (error) {
      console.error('No se pudieron imprimir las etiquetas:', error)
      setLabelPrintError(error.message || 'No se pudieron imprimir las etiquetas.')
      setIsPrintingLabels(false)
    }
  }

  const handleConfirmLabelsPrinted = async () => {
    if (!pendingConfirmationStudies || pendingConfirmationStudies.length === 0) return

    const dbStudyIds = pendingConfirmationStudies
      .map((study) => study.dbId)
      .filter((id) => id !== null)
    const legacyOnlyStudies = pendingConfirmationStudies.filter((study) => study.dbId === null)

    setIsConfirmingPrint(true)
    setLabelPrintError('')

    try {
      if (legacyOnlyStudies.length > 0) {
        const updatedLegacyIds = [
          ...new Set([...legacyPrintedIds, ...legacyOnlyStudies.map((study) => study.id)])
        ]
        try {
          window.localStorage.setItem(printedStudiesStorageKey, JSON.stringify(updatedLegacyIds))
        } catch {
          // Ignorar errores de almacenamiento local en fallback legacy
        }
        setLegacyPrintedIds(updatedLegacyIds)
      }

      if (dbStudyIds.length > 0 && ticketId !== 'unknown') {
        const response = await markTicketLabelsPrintedApi(ticketId, dbStudyIds)
        const updatedTicket = response?.ticket || {
          ...activeTicket,
          estudios_raw: (activeTicket.estudios_raw || []).map((raw) =>
            raw && dbStudyIds.includes(Number(raw.id))
              ? {
                  ...raw,
                  etiqueta_impresa: true,
                  etiqueta_impresa_at: new Date().toISOString(),
                  estado_etiqueta: 'impresa'
                }
              : raw
          )
        }
        setTicketOverride({ source: ticket, updated: updatedTicket })
        onLabelsPrinted?.(updatedTicket, response)
      }

      setPendingConfirmationStudies(null)
    } catch (error) {
      console.error('Error al registrar etiquetas impresas:', error)
      setLabelPrintError(
        error.message || 'No se pudo registrar la confirmación de impresión en el servidor.'
      )
    } finally {
      setIsConfirmingPrint(false)
    }
  }

  const handleRetryLabelsPrint = () => {
    setPendingConfirmationStudies(null)
    setLabelPrintError('')
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.()
    }
  }

  const isAtendido =
    activeTicket.estado === 'Atendido' ||
    activeTicket.estado === 'Finalizado' ||
    activeTicket.estado_backend === 'Finalizado'
  const badgeText =
    title ||
    (isAtendido ? 'Comprobante de Retiro de Estudios' : 'Ticket de Turno para Sala de Espera')

  const patientFullName = `${activeTicket.paciente_nombre || ''} ${activeTicket.paciente_apellido || ''}`.trim()
  const patientFontClass = getAdaptiveFontClass(patientFullName)

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
              {patientFullName} · DNI {activeTicket.paciente_dni || 'No informado'}
            </p>

            {pendingConfirmationStudies && (
              <div className="ticket-modal__print-confirm" role="status" aria-live="polite">
                <p className="ticket-modal__print-confirm-text">
                  ¿Las etiquetas se imprimieron correctamente? ({pendingConfirmationStudies.length}{' '}
                  {pendingConfirmationStudies.length === 1 ? 'etiqueta' : 'etiquetas'})
                </p>
                <div className="ticket-modal__print-confirm-actions">
                  <button
                    type="button"
                    className="ticket-modal__confirm-yes-btn"
                    onClick={handleConfirmLabelsPrinted}
                    disabled={isConfirmingPrint}
                  >
                    {isConfirmingPrint ? 'Guardando...' : 'Sí, marcar como impresas'}
                  </button>
                  <button
                    type="button"
                    className="ticket-modal__confirm-no-btn"
                    onClick={handleRetryLabelsPrint}
                    disabled={isConfirmingPrint}
                  >
                    No, volver a intentar
                  </button>
                </div>
              </div>
            )}

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
                const isPrinted = isStudyAlreadyPrinted(study, legacyPrintedIds)
                const isAddedInBox = study.estadoEtiqueta === 'agregado_box'
                const isModifiedInBox = study.estadoEtiqueta === 'modificado_box'

                return (
                  <label className="ticket-modal__label-option" key={study.id}>
                    <input
                      type="checkbox"
                      checked={labelMode === 'pending' ? !isPrinted : selectedStudyIds.includes(study.id)}
                      disabled={labelMode === 'pending'}
                      onChange={() => {
                        setSelectedStudyIds((current) =>
                          current.includes(study.id)
                            ? current.filter((id) => id !== study.id)
                            : [...current, study.id]
                        )
                      }}
                    />
                    <span>
                      <span className="ticket-modal__label-title-row">
                        <strong>{study.name}</strong>
                        {isAddedInBox && (
                          <span className="ticket-modal__label-badge ticket-modal__label-badge--added">
                            Agregado en Box
                          </span>
                        )}
                        {isModifiedInBox && (
                          <span className="ticket-modal__label-badge ticket-modal__label-badge--modified">
                            Modificado en Box
                          </span>
                        )}
                        {isPrinted && (
                          <span className="ticket-modal__label-badge ticket-modal__label-badge--printed">
                            Ya impresa
                          </span>
                        )}
                      </span>
                      <small>
                        Muestra: {study.sampleType}
                        {study.motivo ? ` · Motivo: ${study.motivo}` : ''}
                      </small>
                    </span>
                  </label>
                )
              })}

              {cancelledStudies.map((study) => (
                <div
                  className="ticket-modal__label-option ticket-modal__label-option--cancelled"
                  key={`cancelled-${study.id}`}
                >
                  <input type="checkbox" checked={false} disabled aria-label={`${study.name} cancelado`} />
                  <span>
                    <span className="ticket-modal__label-title-row">
                      <strong className="ticket-modal__label-name--cancelled">{study.name}</strong>
                      <span className="ticket-modal__label-badge ticket-modal__label-badge--cancelled">
                        Cancelado en Box
                      </span>
                    </span>
                    <small className="ticket-modal__label-cancel-note">
                      <AlertTriangle size={12} aria-hidden="true" />
                      <span>
                        {study.etiquetaImpresa
                          ? 'Descartar etiqueta (ya se había impreso)'
                          : 'Estudio cancelado — no imprimir etiqueta'}
                        {study.motivo ? ` · Motivo: ${study.motivo}` : ''}
                      </span>
                    </small>
                  </span>
                </div>
              ))}

              {printableStudies.length === 0 && cancelledStudies.length === 0 && (
                <p className="ticket-modal__labels-empty">
                  Este ticket no tiene estudios activos para etiquetar.
                </p>
              )}
            </div>
            {labelPrintError && (
              <p className="ticket-modal__labels-error" role="alert">
                {labelPrintError}
              </p>
            )}
          </section>
        ) : (
          <TicketReceipt ticket={activeTicket} />
        )}

        <div id="printable-study-labels" aria-hidden="true">
          {selectedStudies.map((study) => {
            const studyFontClass = getAdaptiveFontClass(study.name)
            return (
              <article className="ticket-study-label" key={study.id}>
                <strong className={`ticket-study-label__patient ${patientFontClass}`}>
                  {patientFullName}
                </strong>
                <span className="ticket-study-label__dni">
                  DNI: {activeTicket.paciente_dni || 'No informado'}
                </span>
                <strong className={`ticket-study-label__study ${studyFontClass}`}>
                  {study.name}
                </strong>
                <span className="ticket-study-label__sample">
                  Muestra: {study.sampleType}
                </span>
              </article>
            )
          })}
        </div>

        <div className="ticket-modal__actions">
          {isChoosingLabels ? (
            <>
              <button
                className="ticket-modal__print-btn"
                onClick={handlePrintLabels}
                disabled={isPrintingLabels || isConfirmingPrint || selectedStudies.length === 0}
              >
                <Printer className="ticket-modal__print-icon" />
                Imprimir{' '}
                {labelMode === 'pending' ? 'pendientes' : `seleccionadas (${selectedStudies.length})`}
              </button>
              <button
                className="ticket-modal__done-btn"
                onClick={() => {
                  setIsChoosingLabels(false)
                  setLabelPrintError('')
                  setPendingConfirmationStudies(null)
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
                    const currentLegacyIds = readLegacyPrintedIds(printedStudiesStorageKey)
                    setLegacyPrintedIds(currentLegacyIds)
                    setLabelMode('pending')
                    setSelectedStudyIds(
                      printableStudies
                        .filter((study) => !isStudyAlreadyPrinted(study, currentLegacyIds))
                        .map((study) => study.id)
                    )
                    setIsChoosingLabels(true)
                    setLabelPrintError('')
                    setPendingConfirmationStudies(null)
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
