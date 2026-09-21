import { isWithin24HourWindow } from '../utils/validators'
import { getCurrentUtcIso } from '../utils/formatters'
import { DEMO_TICKETS } from '../data/demoTickets'

let runtimeTickets = DEMO_TICKETS.map((ticket) => ({
  ...ticket,
  estudios: [...ticket.estudios]
}))

function getStoredTickets() {
  return runtimeTickets
}

function saveStoredTickets(tickets) {
  runtimeTickets = tickets
}

export async function fetchTicketsApi() {
  return getStoredTickets().filter((t) => !t.is_deleted)
}

export async function createTicketApi(ticketData) {
  const tickets = getStoredTickets()
  const requestedCallNumber = ticketData.num_llamado?.trim()
  const nextCallNumber = requestedCallNumber || String(tickets.length + 101)

  if (tickets.some((ticket) => ticket.num_llamado === nextCallNumber)) {
    throw new Error(`El número de llamado ${nextCallNumber} ya está asignado a otro ticket.`)
  }

  let randomSuffix = Math.floor(1000 + Math.random() * 9000)
  while (tickets.some((ticket) => ticket.id === `TCK-${randomSuffix}`)) {
    randomSuffix = Math.floor(1000 + Math.random() * 9000)
  }

  let ticketSequence = tickets.length + 1
  while (tickets.some((ticket) => ticket.num_totem === `T-${ticketSequence}`)) {
    ticketSequence += 1
  }

  const newTicket = {
    id: `TCK-${randomSuffix}`,
    num_totem: `T-${ticketSequence}`,
    num_llamado: nextCallNumber,
    fecha_hora_admision: getCurrentUtcIso(),
    fecha_hora_llamado: null,
    fecha_hora_cierre: null,
    id_personal_admision: ticketData.mat_admision || 'ADM-4412',
    mat_admision: ticketData.mat_admision || 'ADM-4412',
    mat_box: null,
    box_asignado: null,
    paciente_dni: ticketData.paciente_dni,
    paciente_nombre: ticketData.paciente_nombre,
    paciente_apellido: ticketData.paciente_apellido,
    paciente_obra_social: ticketData.paciente_obra_social,
    clasificacion_triage: ticketData.clasificacion_triage,
    justificacion_otro: ticketData.justificacion_otro || '',
    estudios: ticketData.estudios || [],
    estado: 'Espera',
    is_deleted: false
  }

  tickets.unshift(newTicket)
  saveStoredTickets(tickets)
  return newTicket
}

export async function updateTicketByJefaApi(ticketId, updatedFields, userRole) {
  if (userRole !== 'Jefa' && userRole !== 'Admin') {
    throw new Error('Solo el rol de Jefa o Admin tiene autorización para modificar tickets emitidos.')
  }

  const tickets = getStoredTickets()
  const index = tickets.findIndex((t) => t.id === ticketId)
  if (index === -1) throw new Error('Ticket no encontrado.')

  const current = tickets[index]
  // Validación de la regla de inmutabilidad de 24 horas
  if (!isWithin24HourWindow(current.fecha_hora_admision)) {
    throw new Error('Inmutabilidad activa: Ha vencido la ventana de 24 horas permitida para modificar este ticket.')
  }

  tickets[index] = {
    ...current,
    ...updatedFields
  }
  saveStoredTickets(tickets)
  return tickets[index]
}

export async function searchPatientsApi(query) {
  if (!query) return []
  const clean = query.trim().toLowerCase()
  const tickets = getStoredTickets()
  
  // Devuelve pacientes únicos encontrados por DNI u Obra Social
  const matches = []
  const seenDnis = new Set()

  tickets.forEach((t) => {
    if (
      (t.paciente_dni && t.paciente_dni.includes(clean)) ||
      (t.paciente_obra_social && t.paciente_obra_social.toLowerCase().includes(clean)) ||
      (t.paciente_nombre && t.paciente_nombre.toLowerCase().includes(clean)) ||
      (t.paciente_apellido && t.paciente_apellido.toLowerCase().includes(clean))
    ) {
      if (!seenDnis.has(t.paciente_dni)) {
        seenDnis.add(t.paciente_dni)
        matches.push({
          dni: t.paciente_dni,
          nombre: t.paciente_nombre,
          apellido: t.paciente_apellido,
          obraSocial: t.paciente_obra_social,
          ultimoTicket: t
        })
      }
    }
  })

  return matches
}
