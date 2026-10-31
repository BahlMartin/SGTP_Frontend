import React, { useState, useCallback, useEffect } from 'react'
import { Radio, Clock } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import TicketModal from '../../components/TicketModal/TicketModal'
import RecipeOcrModal from '../../components/RecipeOcrModal/RecipeOcrModal'
import RecentTicketsList from '../../components/RecentTicketsList/RecentTicketsList'
import AdmissionForm from './components/AdmissionForm/AdmissionForm'
import ReceptionQueueCard from './components/ReceptionQueueCard/ReceptionQueueCard'
import ModalCancelarTurnoRecepcion from './components/ModalCancelarTurnoRecepcion/ModalCancelarTurnoRecepcion'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { useAdmissionForm } from '../../hooks/useAdmissionForm'
import { useTodayTickets } from '../../hooks/useTodayTickets'
import { useWebSocket } from '../../hooks/useWebSocket'
import receptionService from '../../services/receptionService'
import { searchPatientByDniApi } from '../../services/patientService'
import './AdmisionScreen.css'

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
 * Coordina el formulario de admisión, la cola de espera del Tótem de autoservicio,
 * la búsqueda rápida de pacientes, el historial de últimos ingresos y los modales de asistencia.
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

  // Estado para la gestión del Tótem y Cola de Recepción
  const [activeSideTab, setActiveSideTab] = useState('recepcion') // 'recepcion' | 'ingresos'
  const [receptionQueue, setReceptionQueue] = useState([])
  const [callingTurnoId, setCallingTurnoId] = useState(null)
  const [activeReceptionTurnoId, setActiveReceptionTurnoId] = useState(null)
  const [selectedTurnoForCancel, setSelectedTurnoForCancel] = useState(null)
  const [isCancelProcessing, setIsCancelProcessing] = useState(false)
  const [unregisteredPatientAlert, setUnregisteredPatientAlert] = useState('')

  // Carga de la cola de recepción ordenada por prioridad de Triage y FIFO
  const fetchReceptionQueue = useCallback(async () => {
    try {
      const data = await receptionService.getTurnosPendientes()
      const list = Array.isArray(data) ? [...data] : []
      const priorityMap = { G: 1, Med: 2, Ext: 3, Csl: 4 }
      list.sort((a, b) => {
        const pA = priorityMap[a.prefijo] || 99
        const pB = priorityMap[b.prefijo] || 99
        if (pA !== pB) return pA - pB
        return new Date(a.created_at) - new Date(b.created_at)
      })
      setReceptionQueue(list)
    } catch (err) {
      console.warn('Error al obtener cola de recepción:', err)
    }
  }, [])

  useEffect(() => {
    fetchReceptionQueue()
  }, [fetchReceptionQueue])

  // Implementación de WebSocket para actualización reactiva
  const { lastMessage: wsTicketMessage } = useWebSocket('tickets')

  useEffect(() => {
    if (!wsTicketMessage) return

    const isTicketCreated =
      wsTicketMessage.event === 'TICKET_CREATED' ||
      wsTicketMessage.action === 'NEW_TICKET' ||
      wsTicketMessage.action === 'TICKET_CREATED' ||
      wsTicketMessage.event === 'NEW_TICKET'

    const isReceptionEvent =
      wsTicketMessage.event === 'RECEPTION_UPDATED' ||
      ['TURNO_CREATED', 'TURNO_CALLED', 'TURNO_CANCELLED', 'TURNO_FINALIZED'].includes(
        wsTicketMessage.action
      )

    if (isTicketCreated) {
      refreshTickets()
      fetchReceptionQueue()
    } else if (isReceptionEvent) {
      fetchReceptionQueue()
    }
  }, [wsTicketMessage, refreshTickets, fetchReceptionQueue])

  // Filtrado de tickets emitidos hoy delegado al hook
  const todayTickets = useTodayTickets(tickets)
  const formattedSequence =
    formData.numeroLlamado && formData.numeroLlamado.trim()
      ? String(parseInt(formData.numeroLlamado.trim(), 10)).padStart(2, '0')
      : ''
  const enteredCallNumber = formattedSequence
    ? `${formData.prefijoLlamado || 'Ext'}-${formattedSequence}`
    : ''
  const ticketNumberError =
    enteredCallNumber && isTicketNumberAlreadyUsed(enteredCallNumber, todayTickets)
      ? `El número de llamado ${enteredCallNumber} ya fue utilizado hoy. Ingrese otro número para evitar duplicar el ticket.`
      : ''

  const handleTicketItemClick = useCallback((selectedTicket) => {
    setIssuedTicket(selectedTicket)
  }, [])

  /**
   * Llamar a un paciente desde la cola de recepción del Tótem.
   */
  const handleCallReceptionTurno = useCallback(
    async (turno) => {
      if (!turno) return
      setCallingTurnoId(turno.id)
      setActiveReceptionTurnoId(turno.id)
      setAdmissionError('')
      setUnregisteredPatientAlert('')

      // Quitarlo inmediatamente de la cola de espera local (feedback inmediato en UI)
      setReceptionQueue((prev) => prev.filter((item) => item.id !== turno.id))

      try {
        // 1. Notificar al backend que se convocó (pasa a En Atención)
        await receptionService.llamarTurno(turno.id).catch((e) => console.warn(e))

        // 2. Precargar número de llamado en el formulario
        const match = String(turno.numero_llamado || '').match(/^([A-Z]+)[-\s]?(\d+)$/i)
        const prefijo = match ? match[1] : turno.prefijo || 'Ext'
        const secuencia = match ? match[2] : ''

        handleFieldChange('prefijoLlamado', prefijo)
        handleFieldChange('numeroLlamado', secuencia)
        handleFieldChange('dni', String(turno.dni || '').trim())

        // 3. Buscar si el paciente está registrado en el padrón
        const pacienteEncontrado = await searchPatientByDniApi(turno.dni)

        if (pacienteEncontrado) {
          // Paciente REGISTRADO: autocompletar todos sus datos
          handleLoadPatient(pacienteEncontrado)
          setUnregisteredPatientAlert('')
        } else {
          // Paciente NO REGISTRADO: mostrar alerta visible
          setUnregisteredPatientAlert(
            `El DNI ${turno.dni} no figura en el padrón de pacientes. Complete Nombre, Apellido y Obra Social antes de cargar los estudios.`
          )
          // Enfocar el input de nombre
          setTimeout(() => {
            const inputNombre = document.getElementById('admission-patient-name')
            if (inputNombre) inputNombre.focus()
          }, 150)
        }
      } catch (err) {
        console.error('Error al llamar turno de recepción:', err)
        setAdmissionError(err.message || 'Error al convocar al turno de recepción.')
      } finally {
        setCallingTurnoId(null)
      }
    },
    [handleFieldChange, handleLoadPatient]
  )

  /**
   * Llamar al siguiente paciente disponible en la cola de espera.
   */
  const handleCallNextReceptionPatient = useCallback(() => {
    if (!receptionQueue || receptionQueue.length === 0) return
    handleCallReceptionTurno(receptionQueue[0])
  }, [receptionQueue, handleCallReceptionTurno])

  /**
   * Abrir modal para cancelar turno de recepción
   */
  const handleOpenCancelModal = (turno) => {
    setSelectedTurnoForCancel(turno)
  }

  /**
   * Confirmar cancelación de turno de recepción
   */
  const handleConfirmCancelTurno = async (motivo) => {
    if (!selectedTurnoForCancel) return
    setIsCancelProcessing(true)
    try {
      await receptionService.cancelarTurno(selectedTurnoForCancel.id, motivo)
      fetchReceptionQueue()
      if (activeReceptionTurnoId === selectedTurnoForCancel.id) {
        setActiveReceptionTurnoId(null)
      }
      setSelectedTurnoForCancel(null)
    } catch (err) {
      console.error('Error al cancelar turno:', err)
      throw err
    } finally {
      setIsCancelProcessing(false)
    }
  }

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
        personal_admision_nombre:
          userData?.nombre && userData?.apellidos
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

      // Finalizar explícitamente el turno de recepción convocado si existe
      if (activeReceptionTurnoId) {
        await receptionService.finalizarTurno(activeReceptionTurnoId).catch(() => {})
        setActiveReceptionTurnoId(null)
      }

      setIssuedTicket(generatedTicket)
      setUnregisteredPatientAlert('')
      resetAdmissionForm()
      fetchReceptionQueue()
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
            unregisteredPatientAlert={unregisteredPatientAlert}
            onCallNextPatient={handleCallNextReceptionPatient}
            hasPendingTurnos={receptionQueue.length > 0}
            pendingTurnosCount={receptionQueue.length}
            isCallingTurno={Boolean(callingTurnoId)}
            onLoadPatient={(patient) => {
              handleLoadPatient(patient)
              setUnregisteredPatientAlert('')
            }}
            onFieldChange={(fieldName, fieldValue) => {
              setAdmissionError('')
              handleFieldChange(fieldName, fieldValue)
            }}
            onToggleStudy={handleToggleStudy}
            onOpenOcrModal={() => setShowOcrModal(true)}
            onSubmitForm={handleSubmitAdmission}
            onResetForm={() => {
              setAdmissionError('')
              setUnregisteredPatientAlert('')
              setActiveReceptionTurnoId(null)
              resetAdmissionForm()
              fetchReceptionQueue()
            }}
            isSubmitting={isSubmitting}
          />

          {/* Columna Derecha: Búsqueda rápida y Vista Dual (Cola Tótem Recepción ⇄ Últimos Ingresos) */}
          <aside className="admision-screen__side-column">
            <PatientSearch
              onSelectPatient={(patient) => {
                handleLoadPatient(patient)
                setUnregisteredPatientAlert('')
              }}
            />

            {/* Selector de Pestañas entre Cola Tótem y Últimos Ingresos */}
            <div className="admision-screen__tabs">
              <button
                type="button"
                className={`admision-screen__tab-btn ${
                  activeSideTab === 'recepcion' ? 'admision-screen__tab-btn--active' : ''
                }`}
                onClick={() => setActiveSideTab('recepcion')}
                title="Cola Tótem Recepción"
              >
                <Radio
                  size={14}
                  className={receptionQueue.length > 0 ? 'admision-tab__live-icon' : ''}
                />
                <span className="admision-screen__tab-text">Cola Tótem</span>
                {receptionQueue.length > 0 && (
                  <span className="admision-screen__tab-badge">{receptionQueue.length}</span>
                )}
              </button>

              <button
                type="button"
                className={`admision-screen__tab-btn ${
                  activeSideTab === 'ingresos' ? 'admision-screen__tab-btn--active' : ''
                }`}
                onClick={() => setActiveSideTab('ingresos')}
                title="Últimos ingresos"
              >
                <Clock size={14} />
                <span className="admision-screen__tab-text">Últimos ingresos</span>
                {todayTickets.length > 0 && (
                  <span className="admision-screen__tab-badge admision-screen__tab-badge--muted">
                    {todayTickets.length}
                  </span>
                )}
              </button>
            </div>

            {/* Contenido condicional según la pestaña activa */}
            {activeSideTab === 'recepcion' ? (
              <ReceptionQueueCard
                waitingQueue={receptionQueue}
                onCallPatient={handleCallReceptionTurno}
                onCancelTurno={handleOpenCancelModal}
                callingTurnoId={callingTurnoId}
                isProcessing={isSubmitting}
              />
            ) : (
              <RecentTicketsList
                title="Últimos ingresos de hoy"
                emptyMessage="No hubo ningun ingreso"
                ticketsList={todayTickets}
                scrollAfterSeven
                onTicketClick={handleTicketItemClick}
                isLoading={loading}
              />
            )}
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

      {/* Modal de Cancelación de Turno de Recepción */}
      <ModalCancelarTurnoRecepcion
        isOpen={Boolean(selectedTurnoForCancel)}
        onClose={() => setSelectedTurnoForCancel(null)}
        turno={selectedTurnoForCancel}
        onConfirm={handleConfirmCancelTurno}
        isProcessing={isCancelProcessing}
      />
    </div>
  )
}
