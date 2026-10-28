import React, { useState, useCallback, useEffect } from 'react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import TicketModal from '../../components/TicketModal/TicketModal'
import RecipeOcrModal from '../../components/RecipeOcrModal/RecipeOcrModal'
import RecentTicketsList from '../../components/RecentTicketsList/RecentTicketsList'
import AdmissionForm from './components/AdmissionForm/AdmissionForm'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { useAdmissionForm } from '../../hooks/useAdmissionForm'
import { useTodayTickets } from '../../hooks/useTodayTickets'
import './AdmisionScreen.css'
import { useWebSocket } from '../../hooks/useWebSocket'

function getTicketNumberKey(ticketNumber) {
  if (!ticketNumber) return ''
  const trimmed = String(ticketNumber).trim().toUpperCase()
  const match = trimmed.match(/^([A-Z]+)[-\s]?(\d+)$/)
  if (match) {
    const [, prefix, num] = match
    return `${prefix}-${String(parseInt(num, 10)).padStart(2, '0')}`
  }
  return trimmed
}

function isTicketNumberAlreadyUsed(ticketNumber, existingTickets) {
  const ticketNumberKey = getTicketNumberKey(ticketNumber)
  if (!ticketNumberKey) return false

  return existingTickets.some((ticket) => {
    const existingTicketNumber = ticket.num_totem || ticket.num_llamado
    return getTicketNumberKey(existingTicketNumber) === ticketNumberKey
  })
}


/**
 * Pantalla principal de Admisión (Orquestador).
 * Coordina el formulario de admisión, la búsqueda rápida de pacientes,
 * el historial de últimos ingresos y los modales de asistencia (OCR / Ticket).
 */
export default function AdmisionScreen() {
  const { createTicket, tickets, refreshTickets, loading } = useTriageQueue()
  const { userData } = useAuth()

  const {
    formData,
    validationErrors,
    existingPatient,
    handleFieldChange,
    handleToggleStudy,
    handleSetStudies,
    handleLoadPatient,
    validateAdmissionForm,
    resetAdmissionForm
  } = useAdmissionForm()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [issuedTicket, setIssuedTicket] = useState(null)
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [admissionError, setAdmissionError] = useState('')

  // Implementación de WebSocket
  const { lastMessage: wsTicketMessage } = useWebSocket('tickets')

  useEffect(() => {
    const isTicketCreated = wsTicketMessage && (
      wsTicketMessage.event === 'TICKET_CREATED' ||
      wsTicketMessage.action === 'NEW_TICKET' ||
      wsTicketMessage.action === 'TICKET_CREATED' ||
      wsTicketMessage.event === 'NEW_TICKET'
    )
    if (isTicketCreated) {
      refreshTickets()
    }
  }, [wsTicketMessage, refreshTickets])


  // Filtrado de tickets emitidos hoy delegado al hook
  const todayTickets = useTodayTickets(tickets)
  const formattedSequence = formData.numeroLlamado && formData.numeroLlamado.trim()
    ? String(parseInt(formData.numeroLlamado.trim(), 10)).padStart(2, '0')
    : ''
  const enteredCallNumber = formattedSequence
    ? `${formData.prefijoLlamado || 'Ext'}-${formattedSequence}`
    : ''
  const ticketNumberError = enteredCallNumber && isTicketNumberAlreadyUsed(enteredCallNumber, todayTickets)
    ? `El número de llamado ${enteredCallNumber} ya fue utilizado hoy. Ingrese otro número para evitar duplicar el ticket.`
    : ''

  const handleTicketItemClick = useCallback((selectedTicket) => {
    setIssuedTicket(selectedTicket)
  }, [])

  const handleSubmitAdmission = async (event) => {
    event.preventDefault()
    setAdmissionError('')

    if (ticketNumberError) {
      setAdmissionError(ticketNumberError)
      return
    }

    const isFormValid = validateAdmissionForm()
    if (!isFormValid) return

    if (!enteredCallNumber) {
      setAdmissionError('El número de llamado es obligatorio.')
      return
    }

    setIsSubmitting(true)
    try {
      const resolvedCallNumber = enteredCallNumber
      const payload = {
        paciente_id: formData.pacienteId || null,
        paciente_dni: formData.dni.trim(),
        paciente_numero_afiliado: formData.numeroAfiliado.trim(),
        paciente_nombre: formData.nombre.trim(),
        paciente_apellido: formData.apellido.trim(),
        paciente_obra_social: formData.obraSocial ? formData.obraSocial.trim() : 'IOMA',
        obraSocial: formData.obraSocial ? formData.obraSocial.trim() : 'IOMA',
        num_totem: resolvedCallNumber,
        num_llamado: resolvedCallNumber,
        clasificacion_triage: formData.selectedTriage,
        justificacion_otro: formData.justificacionOtro.trim(),
        estudios_ids: formData.selectedStudies.map((study) => study.id),
        mat_admision: userData?.matricula || '',
        personal_admision_matricula: userData?.matricula || '',
        personal_admision_nombre: userData?.nombre && userData?.apellidos
          ? `${userData.apellidos}, ${userData.nombre}`
          : userData?.nombre || ''
      }

      if (
        formData.selectedStudies.some(
          (study) => study.id == null || !Number.isInteger(Number(study.id))
        )
      ) {
        setAdmissionError(
          'Uno o más estudios no están vinculados al catálogo. Selecciónelos nuevamente desde la búsqueda de estudios.'
        )
        return
      }

      const generatedTicket = await createTicket(payload)
      setIssuedTicket(generatedTicket)
      resetAdmissionForm()
    } catch (submissionError) {
      console.error(submissionError)
      const serverMessage = submissionError.message || 'Error al emitir el ticket.'
      const indicatesDuplicate = /duplic|unique|num_totem|num_llamado|ya existe/i.test(serverMessage)
      setAdmissionError(
        indicatesDuplicate
          ? `No se pudo emitir el ticket porque el número de llamado ya está registrado. Verifique que no se repita. ${serverMessage}`
          : serverMessage
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admision-screen">
      <Navbar />

      <main className="admision-screen__main">
        <header className="admision-screen__header">
          <h1 className="admision-screen__title">Admision</h1>
          <p className="admision-screen__subtitle">
            Registro de pacientes, clasificacion de triage y emision de tickets
          </p>
        </header>

        <div className="admision-screen__grid">
          {/* Columna Izquierda: Formulario Principal de Admisión */}
          <AdmissionForm
            formData={formData}
            validationErrors={validationErrors}
            ticketNumberError={ticketNumberError}
            admissionError={admissionError}
            existingPatient={existingPatient}
            onLoadPatient={handleLoadPatient}
            onFieldChange={(fieldName, fieldValue) => {
              setAdmissionError('')
              handleFieldChange(fieldName, fieldValue)
            }}
            onToggleStudy={handleToggleStudy}
            onOpenOcrModal={() => setShowOcrModal(true)}
            onSubmitForm={handleSubmitAdmission}
            onResetForm={() => {
              setAdmissionError('')
              resetAdmissionForm()
            }}
            isSubmitting={isSubmitting}
          />

          {/* Columna Derecha: Búsqueda rápida de paciente y Últimos ingresos de hoy */}
          <aside className="admision-screen__side-column">
            <PatientSearch onSelectPatient={handleLoadPatient} />

            <RecentTicketsList
              title="Últimos ingresos de hoy"
              emptyMessage="No hubo ningun ingreso"
              ticketsList={todayTickets}
              scrollAfterSeven
              onTicketClick={handleTicketItemClick}
              isLoading={loading}
            />
          </aside>
        </div>
      </main>

      {/* Modal de Ticket Emitido */}
      {issuedTicket && (
        <TicketModal ticket={issuedTicket} onClose={() => setIssuedTicket(null)} />
      )}

      {/* Modal de Escaneo OCR con Human-in-the-Loop */}
      {showOcrModal && (
        <RecipeOcrModal
          onClose={() => setShowOcrModal(false)}
          onConfirmStudies={(extractedStudies) => handleSetStudies(extractedStudies)}
        />
      )}
    </div>
  )
}
