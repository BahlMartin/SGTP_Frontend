import React from 'react'
import { FileText, Loader2, AlertCircle } from 'lucide-react'
import PatientVisitCard from './PatientVisitCard'
import './PatientVisitsList.css'

export default function PatientVisitsList({
  visits = [],
  isLoading = false,
  error = '',
  ticketFetchError = '',
  isFetchingTicketId = null,
  onViewTicket,
  mode = 'patient',
  staffRole = 'admision',
  listTitle = '',
  emptyMessage = ''
}) {
  const defaultTitle = mode === 'staff'
    ? (staffRole === 'admision' ? 'Tickets Emitidos en Admisión' : 'Tickets Atendidos en Box')
    : 'Registro de Atenciones y Consultas de Box'

  const defaultEmpty = emptyMessage || (mode === 'staff'
    ? 'No se registran tickets emitidos o atendidos por este profesional.'
    : 'No hay atenciones ni tickets previos registrados para este paciente.')

  return (
    <div className="patient-history-modal__visits">
      <div className="patient-history-modal__visits-head">
        <h3>{listTitle || defaultTitle}</h3>
        <span className="patient-history-modal__visits-count">
          {visits.length} {visits.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {ticketFetchError && (
        <div className="patient-history-modal__fetch-error" role="alert">
          <AlertCircle size={16} />
          <span>{ticketFetchError}</span>
        </div>
      )}

      {isLoading ? (
        <p className="patient-history-modal__status" role="status">
          <Loader2 size={16} className="patient-history-modal__spinner" /> Cargando historial asistencial...
        </p>
      ) : error ? (
        <p className="patient-history-modal__status patient-history-modal__status--error" role="alert">
          <AlertCircle size={16} /> {error}
        </p>
      ) : visits.length === 0 ? (
        <div className="patient-history-modal__empty">
          <FileText size={32} className="patient-history-modal__empty-icon" />
          <p>{defaultEmpty}</p>
        </div>
      ) : (
        <ul className="patient-history-modal__visit-list">
          {visits.map((visit) => {
            const visitId = visit.id_ticket || visit.id
            return (
              <PatientVisitCard
                key={visitId}
                visit={visit}
                mode={mode}
                staffRole={staffRole}
                isFetching={isFetchingTicketId === visitId}
                onViewTicket={onViewTicket}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}
