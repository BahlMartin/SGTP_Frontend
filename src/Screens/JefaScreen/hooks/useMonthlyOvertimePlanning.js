import { useState, useMemo, useCallback } from 'react'
import { adjustTime, isValidHalfHourTime } from '../../../utils/shiftTime.utils'
import { validateOvertimeNoOverlap } from '../../../utils/shiftValidation.utils'

export const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export const MOTIVOS_PLANIFICACION = [
  'Cobertura asistencial de guardia programada',
  'Extensión post-turno por alta demanda analítica en laboratorio',
  'Cobertura anticipada de guardia (pre-turno)',
  'Refuerzo extraordinario fines de semana / feriados',
  'Reemplazo de personal con licencia',
  'OTRO'
]

export function useMonthlyOvertimePlanning(staffMember, { onSubmit, onClose }) {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1) // 1 a 12

  const turnoInicio = String(staffMember?.inicio_turno || '08:00').slice(0, 5)
  const turnoFin = String(staffMember?.fin_turno || '16:00').slice(0, 5)
  const diasLaborales = useMemo(
    () => staffMember?.dias_laborales_detalle || [0, 1, 2, 3, 4],
    [staffMember?.dias_laborales_detalle]
  )

  const [tipoExtension, setTipoExtension] = useState('POST_TURNO')
  const [horaInicio, setHoraInicio] = useState(turnoFin)
  const [horaFin, setHoraFin] = useState(() => adjustTime(turnoFin, 240)) // +4 horas default
  const [diasActivos, setDiasActivos] = useState(() => new Set())
  const [motivo, setMotivo] = useState(MOTIVOS_PLANIFICACION[0])
  const [motivoPersonalizado, setMotivoPersonalizado] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Duración en horas por día
  const horasDiarias = useMemo(() => {
    if (!horaInicio || !horaFin || horaInicio >= horaFin) return 0
    const [h1, m1] = horaInicio.split(':').map(Number)
    const [h2, m2] = horaFin.split(':').map(Number)
    const minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
    return Number((minutos / 60).toFixed(1))
  }, [horaInicio, horaFin])

  // Total acumulado de horas extras del mes
  const totalHorasMes = useMemo(() => {
    return Number((diasActivos.size * horasDiarias).toFixed(1))
  }, [diasActivos.size, horasDiarias])

  // Aplicar patrón predefinido para el mes seleccionado
  const aplicarPatron = useCallback((tipo) => {
    setTipoExtension(tipo)
    setErrorMsg('')

    if (tipo === 'DESMARCAR') {
      setDiasActivos(new Set())
      return
    }

    const totalDiasMes = new Date(anio, mes, 0).getDate()
    const nuevoSet = new Set()

    for (let d = 1; d <= totalDiasMes; d++) {
      const fechaObj = new Date(anio, mes - 1, d)
      const diaSemanaNum = fechaObj.getDay() === 0 ? 6 : fechaObj.getDay() - 1
      const mesStr = String(mes).padStart(2, '0')
      const diaStr = String(d).padStart(2, '0')
      const fechaStr = `${anio}-${mesStr}-${diaStr}`

      const esDiaLaboral = diasLaborales.includes(diaSemanaNum)

      if (tipo === 'POST_TURNO' || tipo === 'PRE_TURNO') {
        if (esDiaLaboral) {
          nuevoSet.add(fechaStr)
        }
      } else if (tipo === 'GUARDIA') {
        if (!esDiaLaboral) {
          nuevoSet.add(fechaStr)
        }
      }
    }

    if (tipo === 'POST_TURNO') {
      setHoraInicio(turnoFin)
      setHoraFin(adjustTime(turnoFin, 240))
    } else if (tipo === 'PRE_TURNO') {
      setHoraInicio(adjustTime(turnoInicio, -120))
      setHoraFin(turnoInicio)
    } else if (tipo === 'GUARDIA') {
      setHoraInicio('08:00')
      setHoraFin('16:00')
    }

    setDiasActivos(nuevoSet)
  }, [anio, mes, diasLaborales, turnoFin, turnoInicio])

  // Conmutar día individual (hacer clic para marcar o desmarcar)
  const toggleDia = useCallback((fechaStr) => {
    setErrorMsg('')
    setDiasActivos((prev) => {
      const next = new Set(prev)
      if (next.has(fechaStr)) {
        next.delete(fechaStr)
      } else {
        next.add(fechaStr)
      }
      return next
    })
  }, [])

  // Cambiar mes con preservación o reinicio inteligente
  const cambiarMes = useCallback((delta) => {
    setErrorMsg('')
    let nuevoMes = mes + delta
    let nuevoAnio = anio
    if (nuevoMes > 12) {
      nuevoMes = 1
      nuevoAnio += 1
    } else if (nuevoMes < 1) {
      nuevoMes = 12
      nuevoAnio -= 1
    }
    setMes(nuevoMes)
    setAnio(nuevoAnio)
    setDiasActivos(new Set())
  }, [mes, anio])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (diasActivos.size === 0) {
      setErrorMsg('Debe seleccionar al menos un día en el calendario para autorizar horas extras.')
      return
    }

    if (!isValidHalfHourTime(horaInicio) || !isValidHalfHourTime(horaFin)) {
      setErrorMsg('Las horas deben ingresarse en formato HH:MM y en intervalos de 30 min (ej: 16:00).')
      return
    }

    if (horasDiarias <= 0) {
      setErrorMsg('La hora de inicio debe ser estrictamente anterior a la hora de fin.')
      return
    }

    // Validar solapamiento para los días seleccionados
    for (const fechaStr of diasActivos) {
      const errorSolapamiento = validateOvertimeNoOverlap({
        horaInicio,
        horaFin,
        turnoInicio,
        turnoFin,
        fecha: fechaStr,
        diasLaboralesDetalle: diasLaborales
      })
      if (errorSolapamiento) {
        setErrorMsg(`Conflicto en la fecha ${fechaStr}: ${errorSolapamiento}`)
        return
      }
    }

    const motivoFinal = (motivo === 'OTRO' ? motivoPersonalizado : motivo).trim()
    if (!motivoFinal) {
      setErrorMsg('Debe indicar un motivo para la autorización de horas extras.')
      return
    }

    setIsSaving(true)
    try {
      await onSubmit({
        personal: staffMember.id,
        anio,
        mes,
        tipo_extension: tipoExtension,
        hora_inicio: `${horaInicio}:00`,
        hora_fin: `${horaFin}:00`,
        motivo: motivoFinal,
        fechas_seleccionadas: Array.from(diasActivos).sort()
      })
      if (onClose) onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar la planificación de horas extras.')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    anio,
    mes,
    setAnio,
    setMes,
    cambiarMes,
    tipoExtension,
    setTipoExtension,
    turnoInicio,
    turnoFin,
    horaInicio,
    setHoraInicio,
    horaFin,
    setHoraFin,
    horasDiarias,
    totalHorasMes,
    diasActivos,
    toggleDia,
    aplicarPatron,
    motivo,
    setMotivo,
    motivoPersonalizado,
    setMotivoPersonalizado,
    errorMsg,
    isSaving,
    handleSubmit,
    diasLaborales
  }
}
