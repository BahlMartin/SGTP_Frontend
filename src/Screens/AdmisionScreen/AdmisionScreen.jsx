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

  // Filtrado de tickets emitidos hoy delegado al hook
  const todayTickets = useTodayTickets(tickets)

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

    const isFormValid = validateAdmissionForm()
    if (!isFormValid) return

    setIsSubmitting(true)
    try {
      const payload = {
        paciente_dni: formData.dni.trim(),
        paciente_obra_social: formData.obraSocial.trim() || 'Particular',
        paciente_nombre: formData.nombre.trim(),
        paciente_apellido: formData.apellido.trim(),
        num_llamado: formData.numLlamado.trim() || String(Math.floor(100 + Math.random() * 900)),
        clasificacion_triage: formData.selectedTriage,
        justificacion_otro: formData.justificacionOtro.trim(),
        estudios: formData.selectedStudies.length > 0 ? formData.selectedStudies : ['Rutina Básica'],
        mat_admision: userData?.matricula || 'ADM-4412'
      }

      const generatedTicket = await createTicket(payload)
      setIssuedTicket(generatedTicket)
      resetAdmissionForm()
    } catch (submissionError) {
      console.error(submissionError)
      alert(submissionError.message || 'Error al emitir el ticket.')
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
            onFieldChange={handleFieldChange}
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
