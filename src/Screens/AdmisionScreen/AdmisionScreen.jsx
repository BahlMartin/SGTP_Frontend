import React, { useState, useCallback } from 'react'
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

function getTicketNumberKey(ticketNumber) {
  const normalizedNumber = String(ticketNumber || '').trim().toUpperCase()
  const digits = normalizedNumber.replace(/\D/g, '')
  return digits || normalizedNumber
}

function isTicketNumberAlreadyUsed(ticketNumber, existingTickets) {
  const ticketNumberKey = getTicketNumberKey(ticketNumber)
  if (!ticketNumberKey) return false

  return existingTickets.some((ticket) => {
    const existingTicketNumber = ticket.num_totem || ticket.num_llamado
    return getTicketNumberKey(existingTicketNumber) === ticketNumberKey
  })
}

function generateUniqueCallNumber(existingTickets) {
  const usedNumbers = new Set(
    existingTickets.map((ticket) =>
      getTicketNumberKey(ticket.num_totem || ticket.num_llamado)
    )
  )
  const firstCandidate = Math.floor(Math.random() * 900)

  for (let offset = 0; offset < 900; offset += 1) {
    const candidate = String(100 + ((firstCandidate + offset) % 900))
    if (!usedNumbers.has(candidate)) return candidate
  }

  throw new Error('No quedan números de llamado disponibles entre 100 y 999 para hoy.')
}

/**
 * Pantalla principal de Admisión (Orquestador).
 * Coordina el formulario de admisión, la búsqueda rápida de pacientes,
 * el historial de últimos ingresos y los modales de asistencia (OCR / Ticket).
 */
export default function AdmisionScreen() {
  const { createTicket, tickets } = useTriageQueue()
  const { userData } = useAuth()

  const {
    formData,
    validationErrors,
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

  // Filtrado de tickets emitidos hoy delegado al hook
  const todayTickets = useTodayTickets(tickets)
  const enteredCallNumber = formData.numLlamado.trim()
  const ticketNumberError = enteredCallNumber && isTicketNumberAlreadyUsed(enteredCallNumber, todayTickets)
    ? `El número de llamado ${enteredCallNumber} ya fue utilizado hoy. Ingrese otro número para evitar duplicar el ticket.`
    : ''

  const handleSelectPatientFromSearch = useCallback(
    (patientData) => {
      handleLoadPatient(patientData)
    },
    [handleLoadPatient]
  )

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

    setIsSubmitting(true)
    try {
      const payload = {
        paciente_id: formData.pacienteId || null,
        paciente_dni: formData.dni.trim(),
        paciente_numero_afiliado: formData.numeroAfiliado.trim(),
        paciente_nombre: formData.nombre.trim(),
        paciente_apellido: formData.apellido.trim(),
        num_llamado: enteredCallNumber || generateUniqueCallNumber(todayTickets),
        clasificacion_triage: formData.selectedTriage,
        justificacion_otro: formData.justificacionOtro.trim(),
        estudios_ids: formData.selectedStudies.map((study) => study.id),
        mat_admision: userData?.matricula || 'ADM-4412'
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
            onFieldChange={(fieldName, fieldValue) => {
              setAdmissionError('')
              handleFieldChange(fieldName, fieldValue)
            }}
            onToggleStudy={handleToggleStudy}
            onOpenOcrModal={() => setShowOcrModal(true)}
            onSubmitForm={handleSubmitAdmission}
            isSubmitting={isSubmitting}
          />

          {/* Columna Derecha: Últimos ingresos y Búsqueda de Paciente */}
          <aside className="admision-screen__side-column">
            <RecentTicketsList
              title="Últimos ingresos de hoy"
              emptyMessage="No hubo ningun ingreso"
              ticketsList={todayTickets}
              maxItems={6}
              onTicketClick={handleTicketItemClick}
            />

            <PatientSearch onSelectPatient={handleSelectPatientFromSearch} />
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
