import React, { useState, useEffect, useRef } from 'react'
import { X, Users, Filter, Check } from 'lucide-react'
import { fetchTicketByIdApi, fetchTicketsByStaffApi } from '../../services/ticketService'
import { updatePatientApi } from '../../services/patientService'
import { useAuth } from '../../context/AuthContext'
import TicketModal from '../TicketModal/TicketModal'
import EditPatientModal from '../EditPatientModal/EditPatientModal'
import PatientProfileHeader from './components/PatientProfileHeader'
import PatientVisitsList from './components/PatientVisitsList'
import './PatientHistoryModal.css'

export default function PatientHistoryModal({
  patient,
  history,
  isLoading = false,
  error = '',
  onSelectPatient,
  onClose,
  onPatientUpdated,
  canEdit = null,
  // Props para modo personal (Pantalla de Jefa)
  staffMember,
  selectedDate = ''
}) {
  const { userData } = useAuth()
  const isStaffMode = Boolean(staffMember)
  const [selectedTicketDetail, setSelectedTicketDetail] = useState(null)
  const [isFetchingTicketId, setIsFetchingTicketId] = useState(null)
  const [ticketFetchError, setTicketFetchError] = useState('')
  const ticketCacheRef = useRef({})

  // Estado de edición de paciente
  const [isEditingPatient, setIsEditingPatient] = useState(false)
  const [localPatient, setLocalPatient] = useState(null)
  const [patientUpdateSuccess, setPatientUpdateSuccess] = useState('')

  const normalizedRole = String(userData?.rol || '').trim().toLowerCase()
  const userCanEdit = canEdit !== null
    ? canEdit
    : (normalizedRole === 'jefa' || normalizedRole === 'admin')

  // Estado propio del modo personal
  const [filterMode, setFilterMode] = useState(selectedDate ? 'date' : 'all')
  const [staffTickets, setStaffTickets] = useState([])
  const [staffTipo, setStaffTipo] = useState('admision')
  const [staffLoading, setStaffLoading] = useState(isStaffMode)
  const [staffError, setStaffError] = useState('')

  const staffId = staffMember?.id_personal ?? staffMember?.id

  // Cierre con Escape
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

  // Carga reactiva de tickets cuando se consulta a un integrante del personal
  useEffect(() => {
    if (!isStaffMode || !staffId) return

    let isMounted = true
    setStaffLoading(true)
    setStaffError('')

    const dateParam = filterMode === 'date' ? selectedDate : null

    fetchTicketsByStaffApi(staffId, dateParam)
      .then((data) => {
        if (!isMounted) return
        setStaffTickets(data.tickets || [])
        setStaffTipo(data.tipo || (staffMember?.rol === 'Admision' ? 'admision' : 'box'))
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('Error al cargar tickets del personal:', err)
        setStaffError(err.message || 'No se pudieron consultar los tickets del profesional.')
      })
      .finally(() => {
        if (isMounted) setStaffLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isStaffMode, staffId, filterMode, selectedDate, staffMember?.rol])

  // Sincronización del paciente actual
  useEffect(() => {
    if (history?.paciente) {
      setLocalPatient(history.paciente)
    } else if (patient) {
      setLocalPatient(patient)
    } else {
      setLocalPatient(null)
    }
  }, [patient, history])

  if (!patient && !staffMember) return null

  const patientData = localPatient || history?.paciente || patient
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

  const handleUpdatePatientSubmit = async (patientId, payload) => {
    const updated = await updatePatientApi(patientId, payload)
    const normalized = {
      ...(patientData || {}),
      ...(updated || {}),
      nombre: updated?.nombre || payload.nombre,
      apellidos: updated?.apellidos || payload.apellidos,
      dni: updated?.dni || payload.dni,
      obra_social: updated?.obra_social || payload.obra_social,
      num_obra_social: updated?.num_obra_social ?? payload.num_obra_social
    }
    setLocalPatient(normalized)
    setIsEditingPatient(false)
    setPatientUpdateSuccess('Datos del paciente actualizados correctamente.')
    setTimeout(() => {
      setPatientUpdateSuccess('')
    }, 4000)
    onPatientUpdated?.(normalized)
  }

  // Helpers de visualización del personal
  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return (parts[0]?.[0] || 'ST').toUpperCase()
  }

  const staffName = staffMember?.nombre_completo || staffMember?.nombre || 'Personal'
  const isAdmission = staffTipo === 'admision'
  const staffRoleDisplay = staffMember?.rol || (isAdmission ? 'Admisión' : 'Técnico de Box')
  const staffMatricula = staffMember?.matricula ? `Mat. ${staffMember.matricula}` : 'Sin matrícula'

  const titleText = isStaffMode
    ? (isAdmission
      ? 'Tickets Emitidos por Operador de Admisión'
      : 'Tickets Atendidos y Extraídos por Técnico')
    : 'Historial Clínico del Paciente'

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
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>

          <h2 id="patient-history-title" className="patient-history-modal__title">
            {titleText}
          </h2>

          {/* Ficha demográfica: Paciente o Personal */}
          {isStaffMode ? (
            <>
              <div className="patient-history-modal__staff-profile">
                <div className="patient-history-modal__staff-profile-left">
                  <div className="patient-history-modal__staff-avatar">
                    {getInitials(staffName)}
                  </div>
                  <div className="patient-history-modal__staff-details">
                    <div className="patient-history-modal__staff-name-wrap">
                      <span className="patient-history-modal__staff-name">{staffName}</span>
                      <span
                        className={`patient-history-modal__role-badge ${isAdmission
                            ? 'patient-history-modal__role-badge--admision'
                            : 'patient-history-modal__role-badge--box'
                          }`}
                      >
                        {staffRoleDisplay}
                      </span>
                    </div>
                    <div className="patient-history-modal__staff-meta">
                      <span>{staffMatricula}</span>
                      {staffMember.email && <span>· {staffMember.email}</span>}
                    </div>
                  </div>
                </div>

                <div className="patient-history-modal__staff-kpi">
                  <span className="patient-history-modal__kpi-number">{staffTickets.length}</span>
                  <span className="patient-history-modal__kpi-label">
                    {isAdmission ? 'Tickets Emitidos' : 'Pacientes Atendidos'}
                  </span>
                </div>
              </div>

              {/* Barra de Filtro de Fecha (Personal) */}
              <div className="patient-history-modal__filter-bar">
                <div className="patient-history-modal__filter-title">
                  <Filter size={15} />
                  <span>
                    {filterMode === 'date' && selectedDate
                      ? `Jornada seleccionada (${selectedDate})`
                      : 'Todo el historial'}
                  </span>
                </div>

                {selectedDate && (
                  <div className="patient-history-modal__filter-buttons">
                    <button
                      type="button"
                      className={`patient-history-modal__filter-btn ${filterMode === 'date' ? 'patient-history-modal__filter-btn--active' : ''
                        }`}
                      onClick={() => setFilterMode('date')}
                    >
                      Día seleccionado
                    </button>
                    <button
                      type="button"
                      className={`patient-history-modal__filter-btn ${filterMode === 'all' ? 'patient-history-modal__filter-btn--active' : ''
                        }`}
                      onClick={() => setFilterMode('all')}
                    >
                      Historial completo
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {patientUpdateSuccess && (
                <div className="patient-history-modal__success-alert" role="status">
                  <Check size={16} />
                  <span>{patientUpdateSuccess}</span>
                </div>
              )}
              <PatientProfileHeader
                patientData={patientData}
                totalVisits={visits.length}
                canEdit={userCanEdit}
                onEdit={() => setIsEditingPatient(true)}
              />
            </>
          )}

          {/* Lista modular de atenciones históricas o tickets por personal */}
          <PatientVisitsList
            visits={isStaffMode ? staffTickets : visits}
            isLoading={isStaffMode ? staffLoading : isLoading}
            error={isStaffMode ? staffError : error}
            ticketFetchError={ticketFetchError}
            isFetchingTicketId={isFetchingTicketId}
            onViewTicket={handleViewTicket}
            mode={isStaffMode ? 'staff' : 'patient'}
            staffRole={staffTipo}
            emptyMessage={
              isStaffMode
                ? `No se registran tickets ${isAdmission ? 'emitidos' : 'atendidos'} por este profesional${filterMode === 'date' && selectedDate ? ` en la jornada del ${selectedDate}.` : '.'
                }`
                : undefined
            }
          />

          <div className="patient-history-modal__actions">
            {!isStaffMode && onSelectPatient && (
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

      {/* Modal de edición de paciente */}
      {isEditingPatient && (
        <EditPatientModal
          isOpen={isEditingPatient}
          patient={patientData}
          onClose={() => setIsEditingPatient(false)}
          onSubmit={handleUpdatePatientSubmit}
        />
      )}

      {/* Comprobante modal reutilizable */}
      {selectedTicketDetail && (
        <TicketModal
          ticket={selectedTicketDetail}
          title={isStaffMode ? `Comprobante Asistencial - ${staffName}` : 'Comprobante Asistencial - Historial'}
          onClose={() => setSelectedTicketDetail(null)}
        />
      )}
    </>
  )
}
