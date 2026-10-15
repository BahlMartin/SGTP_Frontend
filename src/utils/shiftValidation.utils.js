export const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const DIAS_SEMANA_LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Formatea los días laborales de forma concisa y amigable.
 * Ejemplo: [0, 1, 2, 3, 4] -> "Lun a Vie"
 */
export function formatDiasLaborales(diasIndices) {
  if (!diasIndices || diasIndices.length === 0) return 'Sin asignar'
  const ordenados = [...diasIndices].sort((a, b) => a - b)
  if (ordenados.length === 5 && ordenados.every((d, i) => d === i)) return 'Lun a Vie'
  if (ordenados.length === 6 && ordenados.every((d, i) => d === i)) return 'Lun a Sáb'
  if (ordenados.length === 7) return 'Todos los días'
  return ordenados.map((d) => DIAS_SEMANA_CORTO[d]).join(', ')
}

/**
 * Calcula la fecha siguiente en formato YYYY-MM-DD.
 */
export function getNextDateString(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + 1)
  const ny = dt.getFullYear()
  const nm = String(dt.getMonth() + 1).padStart(2, '0')
  const nd = String(dt.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

/**
 * Computa la duración en horas (soporta turnos nocturnos con cruce de medianoche).
 * Ej: 22:00 a 02:00 -> 4.0 hs
 */
export function computeOvertimeDuration(horaInicio, horaFin) {
  if (!horaInicio || !horaFin || horaInicio === horaFin) return 0
  const [h1, m1] = horaInicio.split(':').map(Number)
  const [h2, m2] = horaFin.split(':').map(Number)
  const mIni = h1 * 60 + m1
  const mFin = h2 * 60 + m2
  const minutos = horaInicio < horaFin ? mFin - mIni : (24 * 60 - mIni) + mFin
  return Number((minutos / 60).toFixed(1))
}

/**
 * Desglosa una extensión horaria en tramos diarios si cruza la medianoche (00:00).
 * Si horaInicio < horaFin: 1 tramo.
 * Si horaInicio >= horaFin: 2 tramos (Día D de horaInicio a 23:59, y Día D+1 de 00:00 a horaFin).
 */
export function splitOvernightShift({ fecha, horaInicio, horaFin }) {
  if (!horaInicio || !horaFin) return []
  const duracionTotal = computeOvertimeDuration(horaInicio, horaFin)
  if (horaInicio < horaFin) {
    return [
      {
        fecha,
        horaInicio,
        horaFin,
        duracionHoras: duracionTotal,
        esNocturno: false,
        tramo: 1,
        totalTramos: 1
      }
    ]
  }

  const fechaD2 = getNextDateString(fecha)
  const dur1 = computeOvertimeDuration(horaInicio, '24:00')
  const dur2 = computeOvertimeDuration('00:00', horaFin)

  return [
    {
      fecha,
      horaInicio,
      horaFin: '23:59',
      duracionHoras: dur1,
      esNocturno: true,
      tramo: 1,
      totalTramos: 2
    },
    {
      fecha: fechaD2,
      horaInicio: '00:00',
      horaFin,
      duracionHoras: dur2,
      esNocturno: true,
      tramo: 2,
      totalTramos: 2
    }
  ]
}

/**
 * Valida que una extensión horaria no colisione con el turno habitual si es día laboral.
 * Soporta turnos nocturnos que cruzan la medianoche validando ambos días involucrados.
 * Retorna null si es válido, o un mensaje de error explicativo si colisiona.
 */
export function validateOvertimeNoOverlap({
  horaInicio,
  horaFin,
  turnoInicio,
  turnoFin,
  fecha,
  diasLaboralesDetalle
}) {
  if (!horaInicio || !horaFin) return 'Debe ingresar hora de inicio y fin.'
  if (horaInicio === horaFin) return 'La hora de inicio no puede ser idéntica a la hora de fin.'

  if (!fecha) return null

  const isWorkingDay = (fStr) => {
    if (!fStr) return false
    const [y, m, d] = fStr.split('-').map(Number)
    const fechaObj = new Date(y, m - 1, d)
    const diaSemanaNum = fechaObj.getDay() === 0 ? 6 : fechaObj.getDay() - 1
    return !diasLaboralesDetalle || diasLaboralesDetalle.includes(diaSemanaNum)
  }

  const checkSegmentOverlap = (segIni, segFin, fStr, diaLabel) => {
    if (!isWorkingDay(fStr)) return null
    const tInicio = String(turnoInicio || '').slice(0, 5)
    const tFin = String(turnoFin || '').slice(0, 5)
    if (tInicio && tFin && tInicio < tFin) {
      const seSolapa = !(segFin <= tInicio || segIni >= tFin)
      if (seSolapa) {
        return `Conflicto de horario en ${diaLabel} (${fStr}): El personal tiene turno regular de ${tInicio} a ${tFin}. ` +
               `La extensión (${segIni} a ${segFin}) no puede solaparse con su turno.`
      }
    }
    return null
  }

  if (horaInicio < horaFin) {
    return checkSegmentOverlap(horaInicio, horaFin, fecha, 'el día seleccionado')
  } else {
    // Cruce de medianoche: Validar ambos tramos correlativos
    const fechaD2 = getNextDateString(fecha)
    const errorD1 = checkSegmentOverlap(horaInicio, '23:59', fecha, 'el primer día')
    if (errorD1) return errorD1
    const errorD2 = checkSegmentOverlap('00:00', horaFin, fechaD2, 'el día siguiente')
    if (errorD2) return errorD2
    return null
  }
}
