import { useState, useEffect, useCallback, useMemo } from 'react'
import { isValidHalfHourTime, adjustTime } from '../../../utils/shiftTime.utils'
import { getTodayLocalDateString } from '../../../utils/formatters'
import { fetchHabilitacionesHorariasApi } from '../../../services/userService'
import {
  validateOvertimeNoOverlap,
  computeOvertimeDuration,
  splitOvernightShift
} from '../../../utils/shiftValidation.utils'

export const MOTIVOS_FRECUENTES = [
  'Extensión post-turno por alta demanda asistencial',
  'Cobertura anticipada de guardia (pre-turno)',
  'Refuerzo en toma de muestras críticas',
  'Reemplazo extraordinario de personal ausente'
]

export function useOvertimeAuthorization(staffMember, { onSubmit, onRevoke, onClose }) {
  const hoyStr = getTodayLocalDateString()
  const [fecha, setFecha] = useState(hoyStr)
  const turnoInicio = String(staffMember?.inicio_turno || '08:00').slice(0, 5)
  const turnoFin = String(staffMember?.fin_turno || '16:00').slice(0, 5)

  const [tipoExtension, setTipoExtension] = useState('post') // 'post' | 'pre' | 'libre'
  const [horaInicio, setHoraInicio] = useState(turnoFin)
  const [horaFin, setHoraFin] = useState(() => adjustTime(turnoFin, 120))
  const [motivo, setMotivo] = useState(MOTIVOS_FRECUENTES[0])
  const [motivoPersonalizado, setMotivoPersonalizado] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [habilitacionesPrevias, setHabilitacionesPrevias] = useState([])
  const [loadingPrevias, setLoadingPrevias] = useState(false)

  const staffMemberId = staffMember?.id

  // Carga reactiva de habilitaciones vigentes para esta persona y fecha
  const cargarHabilitaciones = useCallback(async () => {
    if (!staffMemberId) return
    try {
      setLoadingPrevias(true)
      const data = await fetchHabilitacionesHorariasApi(false, staffMemberId, fecha)
      setHabilitacionesPrevias(data)
    } catch (err) {
      console.warn('Error al cargar habilitaciones previas:', err)
    } finally {
      setLoadingPrevias(false)
    }
  }, [staffMemberId, fecha])

  useEffect(() => {
    cargarHabilitaciones()
  }, [cargarHabilitaciones])

  // Selección de tipo de extensión con autoajuste de horas
  const handleSelectTipo = (tipo) => {
    setTipoExtension(tipo)
    setErrorMsg('')
    if (tipo === 'post') {
      setHoraInicio(turnoFin)
      setHoraFin(adjustTime(turnoFin, 120))
    } else if (tipo === 'pre') {
      setHoraInicio(adjustTime(turnoInicio, -120))
      setHoraFin(turnoInicio)
    }
  }

  const handlePresetDuracion = (minutos) => {
    setHoraFin(adjustTime(horaInicio, minutos))
  }

  // Cómputo de duración y tramos nocturnos
  const duracionTotal = useMemo(() => {
    return computeOvertimeDuration(horaInicio, horaFin)
  }, [horaInicio, horaFin])

  const tramosOvernight = useMemo(() => {
    return splitOvernightShift({ fecha, horaInicio, horaFin })
  }, [fecha, horaInicio, horaFin])

  const esNocturno = tramosOvernight.length > 1

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!isValidHalfHourTime(horaInicio) || !isValidHalfHourTime(horaFin)) {
      setErrorMsg('Las horas deben ingresarse en formato HH:MM y en intervalos de 30 min (ej: 16:30).')
      return
    }

    if (duracionTotal <= 0) {
      setErrorMsg('La hora de inicio no puede ser idéntica a la hora de fin.')
      return
    }

    const errorSolapamiento = validateOvertimeNoOverlap({
      horaInicio,
      horaFin,
      turnoInicio,
      turnoFin,
      fecha,
      diasLaboralesDetalle: staffMember?.dias_laborales_detalle
    })

    if (errorSolapamiento) {
      setErrorMsg(errorSolapamiento)
      return
    }

    const motivoFinal = (motivo === 'OTRO' ? motivoPersonalizado : motivo).trim()
    setIsSaving(true)
    try {
      await onSubmit({
        personal: staffMember.id,
        fecha,
        hora_inicio: `${horaInicio}:00`,
        hora_fin: `${horaFin}:00`,
        motivo: motivoFinal
      })
      if (onClose) onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Error al autorizar el horario excepcional.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevocarItem = async (habId) => {
    if (!window.confirm('¿Deseás revocar esta habilitación horaria?')) return
    try {
      await onRevoke(habId)
      await cargarHabilitaciones()
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo revocar la habilitación.')
    }
  }

  return {
    fecha,
    setFecha,
    turnoInicio,
    turnoFin,
    tipoExtension,
    horaInicio,
    setHoraInicio,
    horaFin,
    setHoraFin,
    duracionTotal,
    tramosOvernight,
    esNocturno,
    motivo,
    setMotivo,
    motivoPersonalizado,
    setMotivoPersonalizado,
    errorMsg,
    isSaving,
    habilitacionesPrevias,
    loadingPrevias,
    handleSelectTipo,
    handlePresetDuracion,
    handleSubmit,
    handleRevocarItem
  }
}

