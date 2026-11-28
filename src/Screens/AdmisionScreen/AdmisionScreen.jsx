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
import receptionService, {
  reservarNumeroManualApi,
  liberarReservaManualApi
} from '../../services/receptionService'
import { searchPatientByDniApi } from '../../services/patientService'
import {
  fetchTicketByIdApi,
  fetchStudyNotificationsApi,
  markAllStudyNotificationsReadApi
} from '../../services/ticketService'
import './AdmisionScreen.css'

export const ADMISSION_ACTIVE_TURNO_STORAGE_KEY = 'sgtp_admision_active_turno'

function formatNotificationTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--/--/---- --:--'
  return date.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function normalizeNotificationItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const ticketId = raw.ticket_id ?? raw.ticket ?? raw.id_ticket ?? null
  const id = raw.id ?? (ticketId ? `ws-${ticketId}-${raw.created_at || raw.timestamp || Date.now()}` : null)
  if (id == null) return null

  return {
    id,
    ticket_id: ticketId,
    num_totem: raw.num_totem || raw.ticket_numero || raw.num_llamado || '',
    paciente_dni: raw.paciente_dni ? String(raw.paciente_dni) : '',
    paciente_nombre: raw.paciente_nombre || '',
    paciente_apellido: raw.paciente_apellido || '',
    box_numero: raw.box_numero ?? null,
    actor_nombre: raw.actor_nombre || raw.actor || 'Personal de Box',
    cambios: Array.isArray(raw.cambios) ? raw.cambios : [],
    leida: Boolean(raw.leida),
    leida_at: raw.leida_at || null,
    created_at: raw.created_at || raw.timestamp || new Date().toISOString()
  }
}

function getStudyChangeBadgeMeta(change) {
  if (typeof change === 'string') {
    return { accion: 'info', label: change }
  }
  const accion = String(change?.accion || '').toLowerCase()
  const name = change?.estudio_nombre || change?.nombre || 'Estudio'
  const motivo = change?.motivo ? ` (${change.motivo})` : ''

  if (accion === 'agregado') return { accion, label: `+ ${name}` }
  if (accion === 'reactivado') return { accion, label: `↺ ${name}` }
  if (accion === 'cancelado') return { accion, label: `✕ ${name}${motivo}` }
  return { accion: 'info', label: `${name}${motivo}` }
}

function formatNotificationPatient(notif) {
  const apellido = String(notif?.paciente_apellido || '').trim()
  const nombre = String(notif?.paciente_nombre || '').trim()
  if (apellido && nombre) return `${apellido}, ${nombre}`
  return apellido || nombre || 'Paciente sin nombre'
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

function parseManualCallNumber(data) {
  const prefijo = data?.prefijoLlamado || 'Ext'
  const rawNumero = String(data?.numeroLlamado || '').trim()
  if (!/^\d{1,4}$/.test(rawNumero)) return null

  const numericValue = parseInt(rawNumero, 10)
  if (!Number.isInteger(numericValue) || numericValue < 1) return null

  const padded = String(numericValue).padStart(2, '0')
  const callNumber = `${prefijo}-${padded}`
  return {
    prefijo,
    numero: numericValue,
    callNumber,
    key: getTicketNumberKey(callNumber)
  }
}

const ADMISSION_FIELD_FOCUS_ORDER = [
  { key: 'dni', id: 'admission-patient-dni' },
  { key: 'numeroLlamado', id: 'admission-call-seq' },
  { key: 'nombre', id: 'admission-patient-name' },
  { key: 'apellido', id: 'admission-patient-surname' },
  { key: 'obraSocial', id: 'admission-patient-obra-social' },
  { key: 'numeroAfiliado', id: 'admission-patient-numero-afiliado' },
  { key: 'justificacion', id: 'admission-justification-otro' },
  { key: 'estudios', id: 'shared-study-search' }
]

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
    numeroAfiliadoBase,
    numeroAfiliadoSufijo,
    validationErrors,
    existingPatient,
    reservationToken,
    resetReservationToken,
    handleFieldChange,
    handleAffiliateBaseChange,
    handleAffiliateSuffixChange,
    handleAffiliateSuffixBlur,
    handleToggleStudy,
    handleSetStudies,
    handleLoadPatient,
    validateAdmissionForm,
    resetAdmissionForm,
    clearEditableFieldsKeepTurno
  } = useAdmissionForm()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittingCallNumber, setSubmittingCallNumber] = useState('')
  const [issuedTicket, setIssuedTicket] = useState(null)
  const [ticketModalOrigin, setTicketModalOrigin] = useState(null)
  const [showOcrModal, setShowOcrModal] = useState(false)
  const [admissionError, setAdmissionError] = useState('')
  const [ticketNumberError, setTicketNumberError] = useState('')
  const [studyChangeNotifications, setStudyChangeNotifications] = useState([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isLoadingNotificationTicket, setIsLoadingNotificationTicket] = useState(false)
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)

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

  // Filtrado de tickets emitidos hoy delegado al hook
  const todayTickets = useTodayTickets(tickets)

  const formDataRef = useRef(formData)
  const existingPatientRef = useRef(existingPatient)
  const activeTurnoIdRef = useRef(activeReceptionTurnoId)
  const unregisteredAlertRef = useRef(unregisteredPatientAlert)
  const todayTicketsRef = useRef(todayTickets)
  const isCallingTurnoRef = useRef(false)
  const hydratedTurnoIdRef = useRef(null)
  const isMountedRef = useRef(true)
  const isSubmittingRef = useRef(false)
  const submittingCallNumberRef = useRef('')
  const reservationTokenRef = useRef(reservationToken)
  const hasActiveManualReservationRef = useRef(false)
  const reservedCallKeyRef = useRef('')
  const reserveDebounceTimerRef = useRef(null)
  const reserveRequestIdRef = useRef(0)
  const notificationsContainerRef = useRef(null)

  useEffect(() => {
    formDataRef.current = formData
    existingPatientRef.current = existingPatient
    activeTurnoIdRef.current = activeReceptionTurnoId
    unregisteredAlertRef.current = unregisteredPatientAlert
    todayTicketsRef.current = todayTickets
    reservationTokenRef.current = reservationToken
  }, [
    formData,
    existingPatient,
    activeReceptionTurnoId,
    unregisteredPatientAlert,
    todayTickets,
    reservationToken
  ])

  const releaseManualReservationIfNeeded = useCallback(
    (shouldResetToken = true) => {
      if (reserveDebounceTimerRef.current) {
        window.clearTimeout(reserveDebounceTimerRef.current)
        reserveDebounceTimerRef.current = null
      }
      reserveRequestIdRef.current += 1

      const currentToken = reservationTokenRef.current
      if (hasActiveManualReservationRef.current && currentToken) {
        hasActiveManualReservationRef.current = false
        reservedCallKeyRef.current = ''
        liberarReservaManualApi(currentToken).catch(() => {})
      } else {
        hasActiveManualReservationRef.current = false
        reservedCallKeyRef.current = ''
      }

      if (shouldResetToken && typeof resetReservationToken === 'function') {
        resetReservationToken()
      }
    },
    [resetReservationToken]
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (reserveDebounceTimerRef.current) {
        window.clearTimeout(reserveDebounceTimerRef.current)
        reserveDebounceTimerRef.current = null
      }
      if (
        hasActiveManualReservationRef.current &&
        reservationTokenRef.current &&
        !isSubmittingRef.current
      ) {
        liberarReservaManualApi(reservationTokenRef.current).catch(() => {})
      }
    }
  }, [])

  // Cerrar panel de notificaciones al hacer click fuera
  useEffect(() => {
    if (!isNotificationsOpen) return
    const handleOutsideClick = (event) => {
      if (
        notificationsContainerRef.current &&
        !notificationsContainerRef.current.contains(event.target)
      ) {
        setIsNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isNotificationsOpen])

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

  // Cargar notificaciones persistidas en BD al montar (solo rol Admisión)
  const loadStudyNotifications = useCallback(async () => {
    if (userData?.rol !== 'Admision') return
    try {
      const response = await fetchStudyNotificationsApi()
      if (!isMountedRef.current) return
      const rawList = Array.isArray(response) ? response : response?.results || []
      setStudyChangeNotifications(rawList.map(normalizeNotificationItem).filter(Boolean))
    } catch (error) {
      console.warn('No se pudieron cargar las notificaciones de estudios:', error)
    }
  }, [userData?.rol])

  useEffect(() => {
    loadStudyNotifications()
  }, [loadStudyNotifications])

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

  // Reserva manual inmediata hacia el Tótem (con debounce ~350ms y onBlur)
  const reserveManualCallNumber = useCallback(
    async (dataSnapshot, { checkLocalDuplicate = false } = {}) => {
      if (activeTurnoIdRef.current || isSubmittingRef.current) return true

      const parsed = parseManualCallNumber(dataSnapshot)
      if (!parsed) {
        if (hasActiveManualReservationRef.current) {
          releaseManualReservationIfNeeded(false)
        }
        return true
      }

      if (submittingCallNumberRef.current && submittingCallNumberRef.current === parsed.key) {
        return true
      }

      if (
        checkLocalDuplicate &&
        isTicketNumberAlreadyUsed(parsed.callNumber, todayTicketsRef.current)
      ) {
        setTicketNumberError(
          `El número de llamado ${parsed.callNumber} ya fue utilizado hoy. Ingrese otro número para evitar duplicar el ticket.`
        )
        return false
      }

      const token = reservationTokenRef.current
      if (!token) return true

      const reservationKey = `${parsed.key}:${token}`
      if (hasActiveManualReservationRef.current && reservedCallKeyRef.current === reservationKey) {
        return true
      }

      const requestId = ++reserveRequestIdRef.current
      try {
        await reservarNumeroManualApi({
          prefijo: parsed.prefijo,
          numero: parsed.numero,
          reservationToken: token
        })

        if (
          !isMountedRef.current ||
          reserveRequestIdRef.current !== requestId ||
          activeTurnoIdRef.current ||
          isSubmittingRef.current
        ) {
          return true
        }

        hasActiveManualReservationRef.current = true
        reservedCallKeyRef.current = reservationKey
        setTicketNumberError('')
        return true
      } catch (err) {
        if (
          !isMountedRef.current ||
          reserveRequestIdRef.current !== requestId ||
          activeTurnoIdRef.current ||
          isSubmittingRef.current
        ) {
          return false
        }

        if (err?.status === 409 || err?.data?.code === 'call_number_in_use') {
          hasActiveManualReservationRef.current = false
          reservedCallKeyRef.current = ''
          const conflictMessage =
            err?.data?.error ||
            err?.message ||
            `El número de llamado ${parsed.callNumber} ya fue utilizado hoy. Ingrese otro número para evitar duplicar el ticket.`
          setTicketNumberError(conflictMessage)
          return false
        }

        console.warn('Aviso al reservar número manual en Tótem:', err)
        return true
      }
    },
    [releaseManualReservationIfNeeded]
  )

  useEffect(() => {
    if (reserveDebounceTimerRef.current) {
      window.clearTimeout(reserveDebounceTimerRef.current)
      reserveDebounceTimerRef.current = null
    }

    if (activeReceptionTurnoId || isSubmitting) {
      return undefined
    }

    const parsed = parseManualCallNumber({
      prefijoLlamado: formData.prefijoLlamado,
      numeroLlamado: formData.numeroLlamado
    })
    if (!parsed) {
      if (hasActiveManualReservationRef.current) {
        releaseManualReservationIfNeeded(false)
      }
      return undefined
    }

    reserveDebounceTimerRef.current = window.setTimeout(() => {
      reserveDebounceTimerRef.current = null
      reserveManualCallNumber(formDataRef.current, { checkLocalDuplicate: false })
    }, 350)

    return () => {
      if (reserveDebounceTimerRef.current) {
        window.clearTimeout(reserveDebounceTimerRef.current)
        reserveDebounceTimerRef.current = null
      }
    }
  }, [
    formData.prefijoLlamado,
    formData.numeroLlamado,
    activeReceptionTurnoId,
    isSubmitting,
    reservationToken,
    reserveManualCallNumber,
    releaseManualReservationIfNeeded
  ])

  const handleCallNumberBlur = useCallback(() => {
    if (reserveDebounceTimerRef.current) {
      window.clearTimeout(reserveDebounceTimerRef.current)
      reserveDebounceTimerRef.current = null
    }
    if (activeTurnoIdRef.current || isSubmittingRef.current) return
    reserveManualCallNumber(formDataRef.current, { checkLocalDuplicate: true })
  }, [reserveManualCallNumber])

  // Implementación de WebSocket para actualización reactiva en tiempo real
  const handleTicketWsMessage = useCallback(
    (wsTicketMessage) => {
      if (!wsTicketMessage) return

      const wsEvent =
        wsTicketMessage.event || wsTicketMessage.action || wsTicketMessage.tipo_evento

      if (wsEvent === 'ESTUDIOS_MODIFICADOS') {
        const rawNotif = wsTicketMessage.notificacion || {
          id: wsTicketMessage.notification_id,
          ticket_id:
            wsTicketMessage.ticket_id ||
            wsTicketMessage.id_ticket ||
            wsTicketMessage.ticket?.id ||
            wsTicketMessage.ticket?.id_ticket,
          num_totem: wsTicketMessage.num_totem || wsTicketMessage.ticket?.num_totem || '',
          paciente_dni: wsTicketMessage.paciente_dni || '',
          paciente_nombre: wsTicketMessage.paciente_nombre || '',
          paciente_apellido: wsTicketMessage.paciente_apellido || '',
          box_numero: wsTicketMessage.box_numero ?? null,
          actor_nombre: wsTicketMessage.actor || wsTicketMessage.actor_nombre || 'Personal de Box',
          cambios: wsTicketMessage.cambios || [],
          leida: false,
          created_at: wsTicketMessage.timestamp || new Date().toISOString()
        }
        const normalizedNotif = normalizeNotificationItem(rawNotif)
        if (normalizedNotif) {
          setStudyChangeNotifications((current) => {
            const existingIndex = current.findIndex((item) => item.id === normalizedNotif.id)
            if (existingIndex >= 0) {
              const next = [...current]
              next[existingIndex] = { ...next[existingIndex], ...normalizedNotif }
              return next
            }
            return [normalizedNotif, ...current]
          })
        }
        refreshTickets()
        return
      }

      if (wsEvent === 'NOTIFICATIONS_ALL_READ') {
        setStudyChangeNotifications((current) =>
          current.map((notif) => ({
            ...notif,
            leida: true,
            leida_at: notif.leida_at || new Date().toISOString()
          }))
        )
        return
      }

      if (wsEvent === 'TICKET_LABELS_PRINTED' || wsEvent === 'NOTIFICATION_READ') {
        const markedIds = Array.isArray(wsTicketMessage.notifications_marked_read)
          ? wsTicketMessage.notifications_marked_read
          : Array.isArray(wsTicketMessage.notification_ids)
            ? wsTicketMessage.notification_ids
            : wsTicketMessage.notification_id != null
              ? [wsTicketMessage.notification_id]
              : []
        const targetTicketId = wsTicketMessage.ticket_id || wsTicketMessage.id_ticket || null

        setStudyChangeNotifications((current) =>
          current.map((notif) => {
            const matchesId = markedIds.length > 0 && markedIds.includes(notif.id)
            const matchesTicket =
              markedIds.length === 0 &&
              targetTicketId != null &&
              String(notif.ticket_id) === String(targetTicketId)
            if (matchesId || matchesTicket) {
              return { ...notif, leida: true, leida_at: notif.leida_at || new Date().toISOString() }
            }
            return notif
          })
        )

        if (wsEvent === 'TICKET_LABELS_PRINTED') {
          refreshTickets()
        }
        return
      }

      if (
        [
          'TICKET_UPDATED',
          'TICKET_LLAMADO',
          'TICKET_FINISHED',
          'TICKET_CANCELLED',
          'TICKET_STUDIES_UPDATED',
          'BOX_STUDIES_UPDATED'
        ].includes(wsEvent)
      ) {
        refreshTickets()
        return
      }

      const isTicketCreated =
        wsEvent === 'TICKET_CREATED' || wsEvent === 'NEW_TICKET'

      const isReceptionEvent =
        wsEvent === 'RECEPTION_UPDATED' ||
        [
          'TURNO_CREATED',
          'TURNO_CALLED',
          'TURNO_CANCELLED',
          'TURNO_FINALIZED',
          'MANUAL_NUMBER_RESERVED',
          'MANUAL_NUMBER_RELEASED'
        ].includes(wsEvent)

      if (isTicketCreated) {
        refreshTickets()
        fetchReceptionQueue()
      } else if (isReceptionEvent) {
        fetchReceptionQueue()
      }
    },
    [refreshTickets, fetchReceptionQueue]
  )

  useWebSocket('tickets', { onMessage: handleTicketWsMessage })

  const formattedSequence =
    formData.numeroLlamado && formData.numeroLlamado.trim()
      ? String(parseInt(formData.numeroLlamado.trim(), 10)).padStart(2, '0')
      : ''
  const enteredCallNumber = formattedSequence
    ? `${formData.prefijoLlamado || 'Ext'}-${formattedSequence}`
    : ''

  const handleTicketItemClick = useCallback((selectedTicket) => {
    setTicketModalOrigin('ingresos')
    setIssuedTicket(selectedTicket)
  }, [])

  const handleCloseTicketModal = useCallback(() => {
    setIssuedTicket(null)
    if (ticketModalOrigin === 'emission') {
      setActiveSideTab('recepcion')
    }
    setTicketModalOrigin(null)
  }, [ticketModalOrigin])

  const handleLabelsPrinted = useCallback(
    (updatedTicket, response) => {
      if (updatedTicket) {
        setIssuedTicket(updatedTicket)
      }
      const markedIds = Array.isArray(response?.notifications_marked_read)
        ? response.notifications_marked_read
        : []
      if (markedIds.length > 0) {
        setStudyChangeNotifications((current) =>
          current.map((notif) =>
            markedIds.includes(notif.id) ? { ...notif, leida: true } : notif
          )
        )
      } else {
        loadStudyNotifications()
      }
      refreshTickets()
    },
    [loadStudyNotifications, refreshTickets]
  )

  const handleNotificationClick = useCallback(
    async (notif) => {
      setIsNotificationsOpen(false)
      if (!notif?.ticket_id || isLoadingNotificationTicket) return

      setIsLoadingNotificationTicket(true)
      setAdmissionError('')
      try {
        const freshTicket = await fetchTicketByIdApi(notif.ticket_id, { cacheBust: true })
        if (!isMountedRef.current) return
        setTicketModalOrigin('notification')
        setIssuedTicket(freshTicket)
      } catch (err) {
        console.error('Error al abrir ticket desde notificación:', err)
        if (isMountedRef.current) {
          setAdmissionError(
            err.message || 'No se pudo obtener el ticket actualizado desde el servidor.'
          )
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingNotificationTicket(false)
        }
      }
    },
    [isLoadingNotificationTicket]
  )

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (isMarkingAllRead) return
    setIsMarkingAllRead(true)
    try {
      await markAllStudyNotificationsReadApi()
      if (!isMountedRef.current) return
      setStudyChangeNotifications((current) =>
        current.map((notif) => ({
          ...notif,
          leida: true,
          leida_at: notif.leida_at || new Date().toISOString()
        }))
      )
    } catch (err) {
      console.warn('No se pudieron marcar todas las notificaciones como leídas:', err)
    } finally {
      if (isMountedRef.current) {
        setIsMarkingAllRead(false)
      }
    }
  }, [isMarkingAllRead])

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

      releaseManualReservationIfNeeded(true)
      setTicketNumberError('')

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
      releaseManualReservationIfNeeded,
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
      // Sin turno de Tótem convocado: liberar reserva manual si existía y limpiar formulario
      releaseManualReservationIfNeeded(true)
      resetAdmissionForm()
      setTicketNumberError('')
      setAdmissionError('')
      setUnregisteredPatientAlert('')
    }
  }, [
    activeReceptionTurno,
    activeReceptionTurnoId,
    receptionQueue,
    enteredCallNumber,
    formData.dni,
    releaseManualReservationIfNeeded,
    resetAdmissionForm
  ])

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
        setTicketNumberError('')
        clearStoredActiveTurno()
        releaseManualReservationIfNeeded(true)
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

  const focusFirstInvalidField = useCallback((errorMap) => {
    if (!errorMap || typeof errorMap !== 'object' || typeof window === 'undefined') return
    const firstInvalid = ADMISSION_FIELD_FOCUS_ORDER.find(({ key }) => Boolean(errorMap[key]))
    if (!firstInvalid) return

    const runFocus = () => {
      const el = document.getElementById(firstInvalid.id)
      const target = el || document.querySelector('.admission-form__field')
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el && !el.disabled && !el.readOnly) {
        el.focus({ preventScroll: true })
      }
    }

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(runFocus)
    } else {
      runFocus()
    }
  }, [])

  const handleSubmitAdmission = async (event) => {
    event.preventDefault()
    if (isSubmittingRef.current || isSubmitting) return

    if (reserveDebounceTimerRef.current) {
      window.clearTimeout(reserveDebounceTimerRef.current)
      reserveDebounceTimerRef.current = null
    }

    setAdmissionError('')

    const { errors: formErrors } = validateAdmissionForm()
    const combinedErrors = { ...formErrors }

    if (
      !activeReceptionTurnoId &&
      enteredCallNumber &&
      isTicketNumberAlreadyUsed(enteredCallNumber, todayTickets)
    ) {
      const duplicateMsg = `El número de llamado ${enteredCallNumber} ya fue utilizado hoy. Ingrese otro número para evitar duplicar el ticket.`
      setTicketNumberError(duplicateMsg)
      setAdmissionError(duplicateMsg)
      combinedErrors.numeroLlamado = duplicateMsg
    } else if (ticketNumberError) {
      setAdmissionError(ticketNumberError)
      combinedErrors.numeroLlamado = ticketNumberError
    }

    if (
      formData.selectedStudies.some(
        (study) => study.id == null || !Number.isInteger(Number(study.id))
      )
    ) {
      const unlinkedStudiesMsg =
        'Uno o más estudios no están vinculados al catálogo. Selecciónelos nuevamente desde la búsqueda de estudios.'
      setAdmissionError(unlinkedStudiesMsg)
      combinedErrors.estudios = unlinkedStudiesMsg
    }

    if (Object.keys(combinedErrors).length > 0) {
      focusFirstInvalidField(combinedErrors)
      return
    }

    const resolvedCallNumber = enteredCallNumber
    const callKey = getTicketNumberKey(resolvedCallNumber)
    submittingCallNumberRef.current = callKey
    isSubmittingRef.current = true
    setSubmittingCallNumber(callKey)
    setIsSubmitting(true)
    setTicketNumberError('')

    try {
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
        reservation_token: reservationToken || '',
        mat_admision: userData?.matricula || '',
        personal_admision_matricula: userData?.matricula || '',
        personal_admision_nombre:
          userData?.nombre && userData?.apellidos
            ? `${userData.apellidos}, ${userData.nombre}`
            : userData?.nombre || ''
      }

      const generatedTicket = await createTicket(payload)

      // El backend finaliza el turno y consume la reserva atómicamente en POST /tickets/
      hasActiveManualReservationRef.current = false
      reservedCallKeyRef.current = ''
      if (typeof resetReservationToken === 'function') {
        resetReservationToken()
      }

      if (activeReceptionTurnoId) {
        hydratedTurnoIdRef.current = null
        setActiveReceptionTurnoId(null)
        setActiveReceptionTurno(null)
        clearStoredActiveTurno()
      }

      setTicketModalOrigin('emission')
      setIssuedTicket(generatedTicket)
      setUnregisteredPatientAlert('')
      setTicketNumberError('')
      resetAdmissionForm()
      fetchReceptionQueue()
    } catch (submissionError) {
      console.error(submissionError)
      const serverMessage = submissionError.message || 'Error al emitir el ticket.'
      const isConflict =
        submissionError.status === 409 ||
        submissionError.data?.code === 'duplicate_call_number' ||
        submissionError.data?.code === 'call_number_in_use' ||
        /duplic|unique|num_totem|num_llamado|ya existe|ya fue utilizado/i.test(serverMessage)

      if (isConflict) {
        const conflictText =
          submissionError.data?.error ||
          submissionError.data?.num_totem ||
          `No se pudo emitir el ticket porque el número de llamado ya está registrado. Verifique que no se repita. ${serverMessage}`
        setTicketNumberError(conflictText)
        setAdmissionError(conflictText)
        focusFirstInvalidField({ numeroLlamado: conflictText })
      } else {
        setAdmissionError(serverMessage)
      }
    } finally {
      submittingCallNumberRef.current = ''
      isSubmittingRef.current = false
      setSubmittingCallNumber('')
      setIsSubmitting(false)
    }
  }

  const unreadNotificationsCount = studyChangeNotifications.filter((n) => !n.leida).length
  const effectiveTicketNumberError =
    isSubmitting ||
    (submittingCallNumber &&
      submittingCallNumber === getTicketNumberKey(enteredCallNumber))
      ? ''
      : ticketNumberError

  const notificationsBell =
    userData?.rol === 'Admision' ? (
      <div className="admision-screen__notifications" ref={notificationsContainerRef}>
        <button
          type="button"
          className={`admision-screen__notification-btn ${
            unreadNotificationsCount > 0 ? 'admision-screen__notification-btn--unread' : ''
          }`}
          aria-label={`Notificaciones de cambios de estudios: ${unreadNotificationsCount} sin leer`}
          aria-expanded={isNotificationsOpen}
          onClick={() => setIsNotificationsOpen((isOpen) => !isOpen)}
        >
          <Bell size={20} />
          {unreadNotificationsCount > 0 && (
            <span className="admision-screen__notification-count">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
        {isNotificationsOpen && (
          <section
            className="admision-screen__notification-panel"
            aria-label="Cambios en estudios"
          >
            <div className="admision-screen__notification-panel-header">
              <h2>Cambios de estudios en Box</h2>
              <button
                type="button"
                className="admision-screen__notification-mark-all"
                onClick={handleMarkAllNotificationsRead}
                disabled={unreadNotificationsCount === 0 || isMarkingAllRead}
              >
                {isMarkingAllRead ? 'Marcando...' : 'Marcar todas como leídas'}
              </button>
            </div>
            {studyChangeNotifications.length === 0 ? (
              <p className="admision-screen__notification-empty">
                Todavía no hay modificaciones.
              </p>
            ) : (
              <ul>
                {studyChangeNotifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={`admision-screen__notification-item ${
                        !notification.leida ? 'admision-screen__notification-item--unread' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      disabled={isLoadingNotificationTicket}
                    >
                      <div className="admision-screen__notification-top">
                        <strong>
                          Ticket {notification.num_totem || notification.ticket_id}
                          {notification.box_numero ? ` · Box ${notification.box_numero}` : ''}
                        </strong>
                        {!notification.leida && (
                          <span className="admision-screen__notification-unread-badge">
                            Nueva
                          </span>
                        )}
                      </div>
                      <span className="admision-screen__notification-patient">
                        {formatNotificationPatient(notification)} · DNI{' '}
                        {notification.paciente_dni || 'No informado'}
                      </span>
                      <div className="admision-screen__notification-changes">
                        {notification.cambios.map((change, idx) => {
                          const meta = getStudyChangeBadgeMeta(change)
                          return (
                            <span
                              key={`${notification.id}-chg-${idx}`}
                              className={`admision-screen__notification-change-tag admision-screen__notification-change-tag--${meta.accion}`}
                            >
                              {meta.label}
                            </span>
                          )
                        })}
                      </div>
                      <small className="admision-screen__notification-meta">
                        {formatNotificationTimestamp(notification.created_at)} · Por{' '}
                        {notification.actor_nombre || 'Personal de Box'}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    ) : null

  return (
    <div className="admision-screen">
      <Navbar beforeProfileSlot={notificationsBell} />

      <main className="admision-screen__main">
        <header className="admision-screen__header">
          <div>
            <h1 className="admision-screen__title">Admision</h1>
            <p className="admision-screen__subtitle">
              Registro de pacientes, clasificacion de triage y emision de tickets
            </p>
          </div>
        </header>

        <div className="admision-screen__grid">
          {/* Columna Izquierda: Formulario Principal de Admisión */}
          <AdmissionForm
            formData={formData}
            validationErrors={validationErrors}
            ticketNumberError={effectiveTicketNumberError}
            admissionError={admissionError}
            existingPatient={existingPatient}
            unregisteredPatientAlert={unregisteredPatientAlert}
            onCallNextPatient={handleCallNextReceptionPatient}
            hasPendingTurnos={receptionQueue.length > 0}
            pendingTurnosCount={receptionQueue.length}
            isCallingTurno={Boolean(callingTurnoId)}
            hasActiveTurno={Boolean(activeReceptionTurno || activeReceptionTurnoId)}
            isReceptionTurnActive={Boolean(activeReceptionTurnoId)}
            onCallNumberBlur={handleCallNumberBlur}
            onCancelActiveTurno={handleCancelActiveTurno}
            onLoadPatient={(patient) => {
              handleLoadPatient(patient)
              setUnregisteredPatientAlert('')
            }}
            onFieldChange={(fieldName, fieldValue) => {
              setAdmissionError('')
              if (fieldName === 'numeroLlamado' || fieldName === 'prefijoLlamado') {
                setTicketNumberError('')
              }
              handleFieldChange(fieldName, fieldValue)
            }}
            numeroAfiliadoBase={numeroAfiliadoBase}
            numeroAfiliadoSufijo={numeroAfiliadoSufijo}
            onAffiliateBaseChange={(val) => {
              setAdmissionError('')
              handleAffiliateBaseChange(val)
            }}
            onAffiliateSuffixChange={(val) => {
              setAdmissionError('')
              handleAffiliateSuffixChange(val)
            }}
            onAffiliateSuffixBlur={handleAffiliateSuffixBlur}
            onToggleStudy={handleToggleStudy}
            onOpenOcrModal={() => setShowOcrModal(true)}
            onSubmitForm={handleSubmitAdmission}
            onResetForm={() => {
              setAdmissionError('')
              setTicketNumberError('')
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
                releaseManualReservationIfNeeded(true)
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

      {/* Modal de Ticket Emitido / Inspección desde Notificación */}
      {issuedTicket && (
        <TicketModal
          key={issuedTicket.id || issuedTicket.id_ticket}
          ticket={issuedTicket}
          onClose={handleCloseTicketModal}
          onLabelsPrinted={handleLabelsPrinted}
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
