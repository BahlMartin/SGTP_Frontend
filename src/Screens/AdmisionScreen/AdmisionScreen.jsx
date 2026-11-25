import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Radio, Clock, Bell } from 'lucide-react'
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
import { getArgentinaDateString, getTodayLocalDateString } from '../../utils/formatters'
import receptionService from '../../services/receptionService'
import { searchPatientByDniApi } from '../../services/patientService'
import './AdmisionScreen.css'

export const ADMISSION_ACTIVE_TURNO_STORAGE_KEY = 'sgtp_admision_active_turno'
const STUDY_CHANGE_NOTIFICATIONS_STORAGE_KEY = 'sgtp_admision_study_change_notifications'
const TICKET_STUDY_SNAPSHOTS_STORAGE_KEY = 'sgtp_admision_ticket_study_snapshots'

function readStoredStudyChangeNotifications() {
  try {
    const stored = window.localStorage.getItem(STUDY_CHANGE_NOTIFICATIONS_STORAGE_KEY)
    const notifications = stored ? JSON.parse(stored) : []
    if (!Array.isArray(notifications)) return []

    return notifications
      .filter((notification) =>
        notification?.id &&
        Array.isArray(notification.changes) &&
        notification.changes.length > 0 &&
        !Number.isNaN(new Date(notification.timestamp).getTime())
      )
      .map((notification) => ({
        ...notification,
        timestamp: new Date(notification.timestamp),
        read: Boolean(notification.read)
      }))
  } catch (error) {
    console.warn('No se pudieron leer las notificaciones de cambios de estudios:', error)
    return []
  }
}

function readStoredTicketStudySnapshots() {
  try {
    const stored = window.localStorage.getItem(TICKET_STUDY_SNAPSHOTS_STORAGE_KEY)
    if (!stored) return new Map()

    const snapshots = JSON.parse(stored)
    if (!snapshots || typeof snapshots !== 'object' || Array.isArray(snapshots)) {
      return new Map()
    }

    return new Map(Object.entries(snapshots).map(([ticketId, studies]) => [
      ticketId,
      new Map(Object.entries(studies || {}))
    ]))
  } catch (error) {
    console.warn('No se pudo leer el estado previo de estudios de los tickets:', error)
    return new Map()
  }
}

function getHistoricalBoxStudyChanges(ticket) {
  const rawStudies = Array.isArray(ticket.estudios_raw) ? ticket.estudios_raw : []
  const changes = []

  rawStudies.forEach((study) => {
    if (!study || typeof study !== 'object') return
    const name = study.estudio_detalle?.nombre || study.nombre || 'Estudio'
    if (study.estado === 'Cancelado') {
      changes.push(`Cancelado: ${name}`)
    } else if (study.origen === 'box') {
      changes.push(`Agregado: ${name}`)
    }
  })

  return [...new Set(changes)]
}

function getTicketStudiesSnapshot(ticket) {
  const rawStudies = Array.isArray(ticket.estudios_raw) && ticket.estudios_raw.length > 0
    ? ticket.estudios_raw
    : (ticket.estudios || [])

  return new Map(rawStudies.map((study) => {
    const detail = study?.estudio_detalle || study?.study_detail || {}
    const name = typeof study === 'string'
      ? study
      : detail.nombre || study?.nombre || 'Estudio'
    const id = typeof study === 'string'
      ? `name:${study.trim().toLowerCase()}`
      : String(study?.id ?? study?.estudio ?? detail.id ?? `name:${name.trim().toLowerCase()}`)

    return [id, {
      name,
      cancelled: typeof study !== 'string' && study?.estado === 'Cancelado',
      actor: typeof study !== 'string'
        ? study?.modificado_por_nombre || study?.personal_box_nombre || study?.modificado_por || ''
        : '',
      timestamp: typeof study !== 'string'
        ? study?.modificado_en || study?.fecha_modificacion || study?.updated_at || ''
        : ''
    }]
  }))
}

function getStudyChanges(previousStudies, currentStudies) {
  const changes = []

  currentStudies.forEach((study, studyId) => {
    const previous = previousStudies.get(studyId)
    if (!previous) {
      changes.push(`Agregado: ${study.name}`)
    } else if (previous.cancelled !== study.cancelled) {
      changes.push(`${study.cancelled ? 'Cancelado' : 'Reactivado'}: ${study.name}`)
    }
  })

  previousStudies.forEach((study, studyId) => {
    if (!currentStudies.has(studyId) && !study.cancelled) {
      changes.push(`Quitado: ${study.name}`)
    }
  })

  return changes
}

function getWebSocketActor(message) {
  const sources = [message, message?.ticket, message?.data, message?.data?.ticket]
  for (const source of sources) {
    const actor = source?.modificado_por_nombre ||
      source?.personal_box_nombre ||
      source?.usuario_nombre ||
      source?.nombre_personal ||
      source?.modificado_por
    if (typeof actor === 'string' && actor.trim()) return actor.trim()
    if (actor && typeof actor === 'object') {
      const name = actor.nombre || actor.apellidos || actor.matricula
      if (name) return String(name)
    }
  }
  return ''
}

function getWebSocketTimestamp(message) {
  const sources = [message, message?.ticket, message?.data, message?.data?.ticket]
  for (const source of sources) {
    const value = source?.timestamp || source?.fecha_hora || source?.updated_at ||
      source?.modificado_en || source?.fecha_modificacion
    if (value && !Number.isNaN(new Date(value).getTime())) return new Date(value)
  }
  return new Date()
}

function formatNotificationTimestamp(date) {
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

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
  const [studyChangeNotifications, setStudyChangeNotifications] = useState(
    readStoredStudyChangeNotifications
  )
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

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
  const ticketStudiesRef = useRef(null)
  if (ticketStudiesRef.current === null) {
    ticketStudiesRef.current = readStoredTicketStudySnapshots()
  }
  const wsStudyChangeRef = useRef(null)

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

    const wsEvent = wsTicketMessage.event || wsTicketMessage.action || wsTicketMessage.tipo_evento
    if (['TICKET_UPDATED', 'TICKET_STUDIES_UPDATED', 'BOX_STUDIES_UPDATED', 'ESTUDIOS_MODIFICADOS'].includes(wsEvent)) {
      const sourceTicket = wsTicketMessage.ticket || wsTicketMessage.data?.ticket
      wsStudyChangeRef.current = {
        ticketId: sourceTicket?.id || sourceTicket?.id_ticket ||
          wsTicketMessage.ticket_id || wsTicketMessage.id_ticket || null,
        actor: getWebSocketActor(wsTicketMessage),
        timestamp: getWebSocketTimestamp(wsTicketMessage)
      }
    }

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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STUDY_CHANGE_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(studyChangeNotifications)
      )
    } catch (error) {
      console.error('No se pudieron guardar las notificaciones de cambios de estudios:', error)
    }
  }, [studyChangeNotifications])

  useEffect(() => {
    if (tickets.length === 0) return

    const previousTicketStudies = ticketStudiesRef.current
    const currentTicketStudies = new Map()
    const notificationsToAdd = []

    tickets.slice(0, 500).forEach((ticket) => {
      if (ticket?.id == null) return
      const ticketId = String(ticket.id)
      const currentStudies = getTicketStudiesSnapshot(ticket)
      const previousStudies = previousTicketStudies.get(ticketId)
      const wsMetadata = wsStudyChangeRef.current
      const matchesWebSocketEvent = wsMetadata &&
        (!wsMetadata.ticketId || String(wsMetadata.ticketId) === ticketId)
      let changes = []
      let notificationId

      if (previousStudies) {
        changes = getStudyChanges(previousStudies, currentStudies)
      } else if (
        getArgentinaDateString(ticket.fecha_hora_admision) === getTodayLocalDateString()
      ) {
        changes = getHistoricalBoxStudyChanges(ticket)
        if (changes.length > 0) {
          notificationId = `history-${ticketId}-${changes.map(encodeURIComponent).join('|')}`
        }
      }

      if (changes.length > 0) {
        const studyValues = [...currentStudies.values()]
        const studyTimestamp = studyValues.find((study) => study.timestamp)?.timestamp
        const timestampValue = matchesWebSocketEvent
          ? wsMetadata.timestamp
          : studyTimestamp || ticket.updated_at || new Date()
        const timestamp = new Date(timestampValue)
        const safeTimestamp = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp
        const actor = (matchesWebSocketEvent ? wsMetadata.actor : '') ||
          studyValues.find((study) => study.actor)?.actor ||
          ticket.personal_box_nombre ||
          (ticket.personal_box_matricula ? `Personal de Box (Mat. ${ticket.personal_box_matricula})` : '') ||
          'Personal de Box'

        notificationsToAdd.push({
          id: notificationId || `${ticketId}-${safeTimestamp.getTime()}-${changes.join('|')}`,
          ticketId,
          ticketNumber: ticket.num_totem || ticket.num_llamado || ticketId,
          changes,
          actor,
          timestamp: safeTimestamp,
          read: false
        })

        if (matchesWebSocketEvent) wsStudyChangeRef.current = null
      }

      currentTicketStudies.set(ticketId, currentStudies)
    })

    ticketStudiesRef.current = currentTicketStudies
    try {
      const snapshots = Object.fromEntries([...currentTicketStudies].map(([ticketId, studies]) => [
        ticketId,
        Object.fromEntries(studies)
      ]))
      window.localStorage.setItem(TICKET_STUDY_SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots))
    } catch (error) {
      console.error('No se pudo guardar el estado previo de estudios de los tickets:', error)
    }

    if (notificationsToAdd.length > 0) {
      setStudyChangeNotifications((current) => {
        const knownIds = new Set(current.map((notification) => notification.id))
        const uniqueAdditions = notificationsToAdd.filter(
          (notification) => !knownIds.has(notification.id)
        )
        return uniqueAdditions.length > 0
          ? [...uniqueAdditions.reverse(), ...current].slice(0, 30)
          : current
      })
    }
  }, [tickets])

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

  const handleCloseTicketModal = useCallback(() => {
    setIssuedTicket(null)
    setActiveSideTab('ingresos')
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
          <div>
            <h1 className="admision-screen__title">Admision</h1>
            <p className="admision-screen__subtitle">
              Registro de pacientes, clasificacion de triage y emision de tickets
            </p>
          </div>
          {userData?.rol === 'Admision' && (
            <div className="admision-screen__notifications">
              <button
                type="button"
                className={`admision-screen__notification-btn ${
                  studyChangeNotifications.some((notification) => !notification.read)
                    ? 'admision-screen__notification-btn--unread'
                    : ''
                }`}
                aria-label={`Notificaciones de cambios de estudios: ${studyChangeNotifications.filter((notification) => !notification.read).length} sin leer`}
                aria-expanded={isNotificationsOpen}
                onClick={() => {
                  setIsNotificationsOpen((isOpen) => !isOpen)
                  setStudyChangeNotifications((current) =>
                    current.map((notification) => ({ ...notification, read: true }))
                  )
                }}
              >
                <Bell size={20} />
                {studyChangeNotifications.some((notification) => !notification.read) && (
                  <span className="admision-screen__notification-count">
                    {studyChangeNotifications.filter((notification) => !notification.read).length}
                  </span>
                )}
              </button>
              {isNotificationsOpen && (
                <section className="admision-screen__notification-panel" aria-label="Cambios en estudios">
                  <h2>Cambios de estudios en Box</h2>
                  {studyChangeNotifications.length === 0 ? (
                    <p className="admision-screen__notification-empty">Todavía no hay modificaciones.</p>
                  ) : (
                    <ul>
                      {studyChangeNotifications.map((notification) => (
                        <li key={notification.id}>
                          <strong>Ticket {notification.ticketNumber}</strong>
                          <span>{notification.changes.join(' · ')}</span>
                          <small>
                            {formatNotificationTimestamp(notification.timestamp)} · Por {notification.actor}
                          </small>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          )}
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
        <TicketModal
          ticket={issuedTicket}
          onClose={handleCloseTicketModal}
          canPrintLabels={userData?.rol === 'Admision'}
          showCloseAction={false}
        />
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
