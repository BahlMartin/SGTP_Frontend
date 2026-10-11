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
 * Valida que una extensión horaria no colisione con el turno habitual si es día laboral.
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
  if (horaInicio >= horaFin) return 'La hora de inicio debe ser estrictamente anterior a la hora de fin.'

  if (!fecha) return null

  // Determinar si la fecha seleccionada es un día laboral habitual
  const [y, m, d] = fecha.split('-').map(Number)
  const fechaObj = new Date(y, m - 1, d)
  const diaSemanaNum = fechaObj.getDay() === 0 ? 6 : fechaObj.getDay() - 1
  const trabajaEseDia = !diasLaboralesDetalle || diasLaboralesDetalle.includes(diaSemanaNum)

  // Si no trabaja ese día (ej: fin de semana o franco), cualquier franja es válida
  if (!trabajaEseDia) return null

  // Si trabaja ese día, verificar solapamiento con su turno ordinario
  const tInicio = String(turnoInicio || '').slice(0, 5)
  const tFin = String(turnoFin || '').slice(0, 5)

  if (tInicio && tFin && tInicio < tFin) {
    const seSolapa = !(horaFin <= tInicio || horaInicio >= tFin)
    if (seSolapa) {
      return `Conflicto de horario: El personal ya tiene turno regular de ${tInicio} a ${tFin}. ` +
             `La extensión debe ser previa a ${tInicio} o posterior a ${tFin}.`
    }
  }

  return null
}
