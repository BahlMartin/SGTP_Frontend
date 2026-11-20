import React, { useState, useCallback, useEffect, useRef } from 'react'
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
import {
  useAdmissionForm,
  ADMISSION_STATE_CHANGED_EVENT
} from '../../hooks/useAdmissionForm'
import { useTodayTickets } from '../../hooks/useTodayTickets'
import { useWebSocket } from '../../hooks/useWebSocket'
import receptionService from '../../services/receptionService'
import { searchPatientByDniApi } from '../../services/patientService'
import './AdmisionScreen.css'

export const ADMISSION_ACTIVE_TURNO_STORAGE_KEY = 'sgtp_admision_active_turno'

function readStoredActiveTurno() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem(ADMISSION_ACTIVE_TURNO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function clearStoredActiveTurno() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(ADMISSION_ACTIVE_TURNO_STORAGE_KEY)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ADMISSION_STATE_CHANGED_EVENT))
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function parseTurnoCallParts(turno) {
  const match = String(turno?.numero_llamado || '').match(/^([A-Z]+)[-\s]?(\d+)$/i)
  return {
    prefijo: match ? match[1] : turno?.prefijo || 'Ext',
    secuencia: match ? match[2] : '',
    dni: String(turno?.dni || '').trim()
  }
}

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
    resetAdmissionForm,
    clearEditableFieldsKeepTurno
  } = useAdmissionForm()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [issuedTicket, setIssuedTicket] = useState(null)
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [admissionError, setAdmissionError] = useState('')

  // Estado para la gestión del Tótem y Cola de Recepción (persistido ante F5)
  const [activeSideTab, setActiveSideTab] = useState('recepcion') // 'recepcion' | 'ingresos'
  const [receptionQueue, setReceptionQueue] = useState([])
  const [callingTurnoId, setCallingTurnoId] = useState(null)
  const [activeReceptionTurnoId, setActiveReceptionTurnoId] = useState(() => {
    const stored = readStoredActiveTurno()
    return stored?.activeReceptionTurnoId || stored?.activeReceptionTurno?.id || null
  })
  const [activeReceptionTurno, setActiveReceptionTurno] = useState(() => {
    const stored = readStoredActiveTurno()
    return stored?.activeReceptionTurno || null
  })
  const [selectedTurnoForCancel, setSelectedTurnoForCancel] = useState(null)
  const [isCancelProcessing, setIsCancelProcessing] = useState(false)
  const [unregisteredPatientAlert, setUnregisteredPatientAlert] = useState(() => {
    const stored = readStoredActiveTurno()
    return stored?.unregisteredPatientAlert || ''
  })

  const formDataRef = useRef(formData)
  const existingPatientRef = useRef(existingPatient)
  const activeTurnoIdRef = useRef(activeReceptionTurnoId)
  const unregisteredAlertRef = useRef(unregisteredPatientAlert)
  const isCallingTurnoRef = useRef(false)
  const hydratedTurnoIdRef = useRef(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    formDataRef.current = formData
    existingPatientRef.current = existingPatient
    activeTurnoIdRef.current = activeReceptionTurnoId
    unregisteredAlertRef.current = unregisteredPatientAlert
  }, [formData, existingPatient, activeReceptionTurnoId, unregisteredPatientAlert])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Sincronizar el turno activo en atención en localStorage y notificar a Navbar
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (activeReceptionTurnoId || activeReceptionTurno) {
          window.localStorage.setItem(
            ADMISSION_ACTIVE_TURNO_STORAGE_KEY,
            JSON.stringify({
              activeReceptionTurnoId: activeReceptionTurnoId || activeReceptionTurno?.id || null,
              activeReceptionTurno,
              unregisteredPatientAlert: unregisteredPatientAlert || ''
            })
          )
        } else {
          window.localStorage.removeItem(ADMISSION_ACTIVE_TURNO_STORAGE_KEY)
        }
      }
    } catch (error) {
      console.warn('No se pudo persistir el turno activo de admisión:', error)
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(ADMISSION_STATE_CHANGED_EVENT))
      }
    } catch {
      // Ignorar en entornos sin window
    }
  }, [activeReceptionTurnoId, activeReceptionTurno, unregisteredPatientAlert])

  // Carga de cola pendiente y rehidratación del turno en atención desde el backend
  const fetchReceptionQueue = useCallback(async () => {
    const [pendientesResult, enAtencionResult] = await Promise.allSettled([
      receptionService.getTurnosPendientes(),
      receptionService.getTurnosEnAtencion()
    ])

    if (!isMountedRef.current) return

    if (pendientesResult.status === 'fulfilled') {
      const data = pendientesResult.value
      const list = Array.isArray(data) ? [...data] : []
      const priorityMap = { G: 1, Med: 2, Ext: 3, Csl: 4 }
      list.sort((a, b) => {
        const pA = priorityMap[a.prefijo] || 99
        const pB = priorityMap[b.prefijo] || 99
        if (pA !== pB) return pA - pB
        return new Date(a.created_at) - new Date(b.created_at)
      })
      setReceptionQueue(list)
    } else {
      console.warn('Error al obtener cola de recepción:', pendientesResult.reason)
    }

    if (enAtencionResult.status !== 'fulfilled') {
      console.warn('Error al obtener turnos en atención de recepción:', enAtencionResult.reason)
      return
    }

    if (isCallingTurnoRef.current) {
      return
    }

    const enAtencionList = Array.isArray(enAtencionResult.value) ? enAtencionResult.value : []

    if (enAtencionList.length > 0) {
      const latestTurno = enAtencionList[0]
      setActiveReceptionTurno(latestTurno)
      setActiveReceptionTurnoId(latestTurno.id)

      const { prefijo, secuencia, dni: turnoDni } = parseTurnoCallParts(latestTurno)
      const currentForm = formDataRef.current || {}
      const hasDraftDni = Boolean(String(currentForm.dni || '').trim())
      const hasDraftNumero = Boolean(String(currentForm.numeroLlamado || '').trim())
      const hasUserTypedEdits = Boolean(
        String(currentForm.nombre || '').trim() ||
          String(currentForm.apellido || '').trim() ||
          String(currentForm.numeroAfiliado || '').trim() ||
          String(currentForm.justificacionOtro || '').trim() ||
          (Array.isArray(currentForm.selectedStudies) && currentForm.selectedStudies.length > 0) ||
          currentForm.pacienteId ||
          existingPatientRef.current
      )

      const isSameDraftTurno =
        hasDraftDni &&
        hasDraftNumero &&
        String(currentForm.dni).trim() === turnoDni &&
        parseInt(String(currentForm.numeroLlamado).trim(), 10) === parseInt(secuencia, 10)

      if (!hasDraftDni || !hasDraftNumero) {
        if (!hasUserTypedEdits && !hasDraftDni && !hasDraftNumero) {
          handleFieldChange('prefijoLlamado', prefijo)
        } else if (!currentForm.prefijoLlamado) {
          handleFieldChange('prefijoLlamado', prefijo)
        }
        if (!hasDraftNumero && secuencia) {
          handleFieldChange('numeroLlamado', secuencia)
        }
        if (!hasDraftDni && turnoDni) {
          handleFieldChange('dni', turnoDni)
        }
      }

      const shouldLookupPatient =
        hydratedTurnoIdRef.current !== latestTurno.id &&
        turnoDni &&
        ((!hasUserTypedEdits && !isSameDraftTurno) ||
          (isSameDraftTurno &&
            !hasUserTypedEdits &&
            !unregisteredAlertRef.current &&
            !existingPatientRef.current))

      hydratedTurnoIdRef.current = latestTurno.id

      if (shouldLookupPatient) {
        try {
          const pacienteEncontrado = await searchPatientByDniApi(turnoDni)
          if (!isMountedRef.current) return
          if (pacienteEncontrado) {
            handleLoadPatient(pacienteEncontrado)
            setUnregisteredPatientAlert('')
          } else {
            setUnregisteredPatientAlert(
              `El DNI ${turnoDni} no figura en el padrón de pacientes. Complete Nombre, Apellido y Obra Social antes de cargar los estudios.`
            )
          }
        } catch (lookupErr) {
          console.warn('No se pudo consultar padrón al restaurar turno de recepción:', lookupErr)
        }
      }
    } else if (activeTurnoIdRef.current) {
      hydratedTurnoIdRef.current = null
      setActiveReceptionTurnoId(null)
      setActiveReceptionTurno(null)
      setUnregisteredPatientAlert('')
      clearStoredActiveTurno()
    }
  }, [handleFieldChange, handleLoadPatient])

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

      const currentActiveId = activeReceptionTurnoId || activeReceptionTurno?.id
      if (currentActiveId && currentActiveId !== turno.id) {
        const activeLabel = activeReceptionTurno?.numero_llamado || enteredCallNumber || 'actual'
        setAdmissionError(
          `Ya hay un paciente en atención (${activeLabel}). Emita el ticket o cancele el turno actual antes de llamar a otro paciente.`
        )
        return
      }
      if (callingTurnoId) return

      isCallingTurnoRef.current = true
      setCallingTurnoId(turno.id)
      setActiveReceptionTurnoId(turno.id)
      setActiveReceptionTurno(turno)
      hydratedTurnoIdRef.current = turno.id
      setAdmissionError('')
      setUnregisteredPatientAlert('')

      // Quitarlo inmediatamente de la cola de espera local (feedback inmediato en UI)
      setReceptionQueue((prev) => prev.filter((item) => item.id !== turno.id))

      let turnoLlamadoConfirmado = false
      try {
        // 1. Notificar al backend que se convocó (pasa a En Atención)
        const updatedTurno = await receptionService.llamarTurno(turno.id)
        turnoLlamadoConfirmado = true
        if (!isMountedRef.current) return
        if (updatedTurno && updatedTurno.id) {
          setActiveReceptionTurno(updatedTurno)
        }

        // 2. Precargar número de llamado en el formulario
        const { prefijo, secuencia, dni: turnoDni } = parseTurnoCallParts(updatedTurno || turno)

        handleFieldChange('prefijoLlamado', prefijo)
        handleFieldChange('numeroLlamado', secuencia)
        handleFieldChange('dni', turnoDni)

        // 3. Buscar si el paciente está registrado en el padrón
        try {
          const pacienteEncontrado = await searchPatientByDniApi(turnoDni)
          if (!isMountedRef.current) return

          if (pacienteEncontrado) {
            // Paciente REGISTRADO: autocompletar todos sus datos
            handleLoadPatient(pacienteEncontrado)
            setUnregisteredPatientAlert('')
          } else {
            // Paciente NO REGISTRADO: mostrar alerta visible
            setUnregisteredPatientAlert(
              `El DNI ${turnoDni} no figura en el padrón de pacientes. Complete Nombre, Apellido y Obra Social antes de cargar los estudios.`
            )
            // Enfocar el input de nombre
            setTimeout(() => {
              const inputNombre = document.getElementById('admission-patient-name')
              if (inputNombre) inputNombre.focus()
            }, 150)
          }
        } catch (lookupErr) {
          console.warn('Error al consultar padrón tras convocar turno:', lookupErr)
          if (isMountedRef.current) {
            setAdmissionError(
              'El turno fue convocado, pero no se pudo consultar el padrón de pacientes. Puede completar los datos manualmente.'
            )
          }
        }
      } catch (err) {
        console.error('Error al llamar turno de recepción:', err)
        if (isMountedRef.current && !turnoLlamadoConfirmado) {
          hydratedTurnoIdRef.current = null
          setActiveReceptionTurnoId(null)
          setActiveReceptionTurno(null)
          setAdmissionError(err.message || 'Error al convocar al turno de recepción.')
          fetchReceptionQueue()
        }
      } finally {
        isCallingTurnoRef.current = false
        if (isMountedRef.current) {
          setCallingTurnoId(null)
        }
      }
    },
    [
      activeReceptionTurnoId,
      activeReceptionTurno,
      callingTurnoId,
      enteredCallNumber,
      handleFieldChange,
      handleLoadPatient,
      fetchReceptionQueue
    ]
  )

  /**
   * Llamar al siguiente paciente disponible en la cola de espera.
   */
  const handleCallNextReceptionPatient = useCallback(() => {
    if (activeReceptionTurnoId || activeReceptionTurno) {
      const activeLabel = activeReceptionTurno?.numero_llamado || enteredCallNumber || 'actual'
      setAdmissionError(
        `Ya hay un paciente en atención (${activeLabel}). Emita el ticket o cancele el turno actual antes de llamar a otro paciente.`
      )
      return
    }
    if (!receptionQueue || receptionQueue.length === 0) return
    handleCallReceptionTurno(receptionQueue[0])
  }, [
    activeReceptionTurnoId,
    activeReceptionTurno,
    enteredCallNumber,
    receptionQueue,
    handleCallReceptionTurno
  ])

  /**
   * Abrir modal para cancelar turno de recepción
   */
  const handleOpenCancelModal = (turno) => {
    setSelectedTurnoForCancel(turno)
  }

  /**
   * Cancelar el turno actualmente convocado y limpiar el formulario
   */
  const handleCancelActiveTurno = useCallback(() => {
    if (activeReceptionTurno) {
      setSelectedTurnoForCancel(activeReceptionTurno)
    } else if (activeReceptionTurnoId) {
      const found = receptionQueue.find((t) => t.id === activeReceptionTurnoId)
      setSelectedTurnoForCancel(
        found || {
          id: activeReceptionTurnoId,
          numero_llamado: enteredCallNumber || 'Turno convocado',
          dni: formData.dni
        }
      )
    } else {
      // Si no hay un turno de recepción activo pero el formulario fue autocompletado
      resetAdmissionForm()
      setAdmissionError('')
      setUnregisteredPatientAlert('')
    }
  }, [activeReceptionTurno, activeReceptionTurnoId, receptionQueue, enteredCallNumber, formData.dni, resetAdmissionForm])

  /**
   * Confirmar cancelación de turno de recepción y limpiar formulario si estaba convocado
   */
  const handleConfirmCancelTurno = async (motivo) => {
    if (!selectedTurnoForCancel) return
    setIsCancelProcessing(true)
    try {
      await receptionService.cancelarTurno(selectedTurnoForCancel.id, motivo)
      fetchReceptionQueue()
      if (
        activeReceptionTurnoId === selectedTurnoForCancel.id ||
        activeReceptionTurno?.id === selectedTurnoForCancel.id
      ) {
        hydratedTurnoIdRef.current = null
        setActiveReceptionTurnoId(null)
        setActiveReceptionTurno(null)
        setUnregisteredPatientAlert('')
        clearStoredActiveTurno()
        resetAdmissionForm()
        setAdmissionError('')
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
        hydratedTurnoIdRef.current = null
        setActiveReceptionTurnoId(null)
        setActiveReceptionTurno(null)
        clearStoredActiveTurno()
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
            hasActiveTurno={Boolean(activeReceptionTurno || activeReceptionTurnoId)}
            onCancelActiveTurno={handleCancelActiveTurno}
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
              const hasActive = Boolean(activeReceptionTurno || activeReceptionTurnoId)
              if (hasActive) {
                const turnoParts = activeReceptionTurno
                  ? parseTurnoCallParts(activeReceptionTurno)
                  : null
                clearEditableFieldsKeepTurno({
                  prefijoLlamado: turnoParts?.prefijo || formData.prefijoLlamado,
                  numeroLlamado: turnoParts?.secuencia || formData.numeroLlamado,
                  dni: turnoParts?.dni || formData.dni
                })
              } else {
                setUnregisteredPatientAlert('')
                hydratedTurnoIdRef.current = null
                setActiveReceptionTurnoId(null)
                setActiveReceptionTurno(null)
                clearStoredActiveTurno()
                resetAdmissionForm()
                fetchReceptionQueue()
              }
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
                hasActiveTurno={Boolean(activeReceptionTurno || activeReceptionTurnoId)}
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
