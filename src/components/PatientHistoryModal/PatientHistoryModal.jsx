import React, { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { fetchTicketByIdApi } from '../../services/ticketService'
import TicketModal from '../TicketModal/TicketModal'
import PatientProfileHeader from './components/PatientProfileHeader'
import PatientVisitsList from './components/PatientVisitsList'
import './PatientHistoryModal.css'

export default function PatientHistoryModal({
  patient,
  history,
  isLoading = false,
  error = '',
  onSelectPatient,
  onClose
}) {
  const [selectedTicketDetail, setSelectedTicketDetail] = useState(null)
  const [isFetchingTicketId, setIsFetchingTicketId] = useState(null)
  const [ticketFetchError, setTicketFetchError] = useState('')
  const ticketCacheRef = useRef({})

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (selectedTicketDetail) {
          setSelectedTicketDetail(null)
        } else {
          onClose?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTicketDetail, onClose])

  if (!patient) return null

  const patientData = history?.paciente || patient
  const visits = Array.isArray(history) ? history : history?.atenciones || []

  const handleViewTicket = async (ticketId) => {
    if (!ticketId) return
    setTicketFetchError('')

    // 1. Reutilización instantánea desde la caché en memoria (0 ms)
    if (ticketCacheRef.current[ticketId]) {
      setSelectedTicketDetail(ticketCacheRef.current[ticketId])
      return
    }

    // 2. Consulta al endpoint oficial de ticket
    setIsFetchingTicketId(ticketId)
    try {
      const ticketData = await fetchTicketByIdApi(ticketId)
      ticketCacheRef.current[ticketId] = ticketData
      setSelectedTicketDetail(ticketData)
    } catch (err) {
      console.error('Error al consultar ticket asistencial:', err)
      setTicketFetchError(
        err.message || 'No se pudo obtener el comprobante del ticket desde el servidor.'
      )
    } finally {
      setIsFetchingTicketId(null)
    }
  }

  return (
    <>
      <div
        className="patient-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-history-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.()
        }}
      >
        <section className="patient-history-modal__card">
          <button
            type="button"
            className="patient-history-modal__close"
            onClick={onClose}
            aria-label="Cerrar historial"
          >
            <X size={20} />
          </button>

          <h2 id="patient-history-title" className="patient-history-modal__title">
            Historial Clínico del Paciente
          </h2>

          {/* Ficha demográfica del paciente */}
          <PatientProfileHeader patientData={patientData} totalVisits={visits.length} />

          {/* Lista modular de atenciones históricas */}
          <PatientVisitsList
            visits={visits}
            isLoading={isLoading}
            error={error}
            ticketFetchError={ticketFetchError}
            isFetchingTicketId={isFetchingTicketId}
            onViewTicket={handleViewTicket}
          />

          <div className="patient-history-modal__actions">
            {onSelectPatient && (
              <button
                type="button"
                className="patient-history-modal__select"
                onClick={onSelectPatient}
              >
                Seleccionar paciente
              </button>
            )}
            <button type="button" className="patient-history-modal__cancel" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </section>
      </div>

      {/* Comprobante modal reutilizable */}
      {selectedTicketDetail && (
        <TicketModal
          ticket={selectedTicketDetail}
          title="Comprobante Asistencial - Historial"
          onClose={() => setSelectedTicketDetail(null)}
        />
      )}
    </>
  )
}
