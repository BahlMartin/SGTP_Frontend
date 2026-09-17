import { isWithin24HourWindow } from '../utils/validators'
import { getCurrentUtcIso } from '../utils/formatters'

const LOCAL_TICKETS_KEY = 'sgtp_tickets_db'

const INITIAL_MOCK_TICKETS = [
  {
    id: 'TCK-1001',
    num_totem: 'G-01',
    num_llamado: '101',
    fecha_hora_admision: new Date(Date.now() - 45 * 60000).toISOString(),
    fecha_hora_llamado: new Date(Date.now() - 25 * 60000).toISOString(),
    fecha_hora_cierre: new Date(Date.now() - 10 * 60000).toISOString(),
    id_personal_admision: 'ADM-4412',
    mat_admision: 'ADM-4412',
    mat_box: 'TEC-3391',
    box_asignado: 'Box 1',
    paciente_dni: '32849102',
    paciente_nombre: 'Esteban',
    paciente_apellido: 'Gómez',
    paciente_obra_social: 'OSDE 310',
    clasificacion_triage: 'Guardia',
    justificacion_otro: '',
    estudios: ['Hemograma', 'Glucemia'],
    estado: 'Atendido',
    is_deleted: false
  },
  {
    id: 'TCK-1002',
    num_totem: 'M-04',
    num_llamado: '102',
    fecha_hora_admision: new Date(Date.now() - 35 * 60000).toISOString(),
    fecha_hora_llamado: new Date(Date.now() - 15 * 60000).toISOString(),
    fecha_hora_cierre: null,
    id_personal_admision: 'ADM-4412',
    mat_admision: 'ADM-4412',
    mat_box: 'TEC-3391',
    box_asignado: 'Box 1',
    paciente_dni: '28472910',
    paciente_nombre: 'María Elena',
    paciente_apellido: 'Vázquez',
    paciente_obra_social: 'IOMA',
    clasificacion_triage: 'Medicos',
    justificacion_otro: '',
    estudios: ['Urocultivo', 'Sedimento Urinario'],
    estado: 'En atencion',
    is_deleted: false
  },
  {
    id: 'TCK-1003',
    num_totem: 'D-02',
    num_llamado: '103',
    fecha_hora_admision: new Date(Date.now() - 20 * 60000).toISOString(),
    fecha_hora_llamado: null,
    fecha_hora_cierre: null,
    id_personal_admision: 'ADM-4412',
    mat_admision: 'ADM-4412',
    mat_box: null,
    box_asignado: null,
    paciente_dni: '41920481',
    paciente_nombre: 'Jorge',
    paciente_apellido: 'Albarracín',
    paciente_obra_social: 'PAMI',
    clasificacion_triage: 'Discapacidad',
    justificacion_otro: '',
    estudios: ['Hemograma', 'Bioquimica'],
    estado: 'Espera',
    is_deleted: false
  },
  {
    id: 'TCK-1004',
    num_totem: 'O-07',
    num_llamado: '104',
    fecha_hora_admision: new Date(Date.now() - 15 * 60000).toISOString(),
    fecha_hora_llamado: null,
    fecha_hora_cierre: null,
    id_personal_admision: 'ADM-4412',
    mat_admision: 'ADM-4412',
    mat_box: null,
    box_asignado: null,
    paciente_dni: '22839102',
    paciente_nombre: 'Clara',
    paciente_apellido: 'Mendoza',
    paciente_obra_social: 'Swiss Medical',
    clasificacion_triage: 'Oncologia',
    justificacion_otro: '',
    estudios: ['Hemograma', 'Perfil Hepático', 'Orina'],
    estado: 'Espera',
    is_deleted: false
  },
  {
    id: 'TCK-1005',
    num_totem: 'ET-12',
    num_llamado: '105',
    fecha_hora_admision: new Date(Date.now() - 10 * 60000).toISOString(),
    fecha_hora_llamado: null,
    fecha_hora_cierre: null,
    id_personal_admision: 'ADM-4412',
    mat_admision: 'ADM-4412',
    mat_box: null,
    box_asignado: null,
    paciente_dni: '38192834',
    paciente_nombre: 'Rodrigo',
    paciente_apellido: 'Paredes',
    paciente_obra_social: 'Particular',
    clasificacion_triage: 'Extraccion con turno',
    justificacion_otro: '',
    estudios: ['Coagulograma'],
    estado: 'Espera',
    is_deleted: false
  }
]

function getStoredTickets() {
  const stored = localStorage.getItem(LOCAL_TICKETS_KEY)
  if (!stored) {
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(INITIAL_MOCK_TICKETS))
    return INITIAL_MOCK_TICKETS
  }
  return JSON.parse(stored)
}

function saveStoredTickets(tickets) {
  localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(tickets))
}

export async function fetchTicketsApi() {
  return getStoredTickets().filter((t) => !t.is_deleted)
}

export async function createTicketApi(ticketData) {
  const tickets = getStoredTickets()
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const newTicket = {
    id: `TCK-${randomSuffix}`,
    num_totem: `T-${tickets.length + 1}`,
    num_llamado: ticketData.num_llamado || String(tickets.length + 101),
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
