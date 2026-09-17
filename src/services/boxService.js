import { getCurrentUtcIso } from '../utils/formatters'

const LOCAL_BOXES_KEY = 'sgtp_boxes_db'

const INITIAL_BOXES = [
  { id: 1, numero: 1, nombre: 'Box 1', estado: 'En atencion', activo: true, tecnicoMatricula: 'TEC-3391', ticketActualId: 'TCK-1002' },
  { id: 2, numero: 2, nombre: 'Box 2', estado: 'Disponible', activo: true, tecnicoMatricula: 'TEC-4402', ticketActualId: null },
  { id: 3, numero: 3, nombre: 'Box 3', estado: 'Disponible', activo: true, tecnicoMatricula: 'TEC-5519', ticketActualId: null },
  { id: 4, numero: 4, nombre: 'Box 4', estado: 'Fuera de servicio', activo: false, tecnicoMatricula: null, ticketActualId: null }
]

function getStoredBoxes() {
  const stored = localStorage.getItem(LOCAL_BOXES_KEY)
  if (!stored) {
    localStorage.setItem(LOCAL_BOXES_KEY, JSON.stringify(INITIAL_BOXES))
    return INITIAL_BOXES
  }
  return JSON.parse(stored)
}

function saveStoredBoxes(boxes) {
  localStorage.setItem(LOCAL_BOXES_KEY, JSON.stringify(boxes))
}

export async function fetchBoxesApi() {
  return getStoredBoxes()
}

export async function updateBoxStateApi(boxNumero, nuevoEstado) {
  const boxes = getStoredBoxes()
  const box = boxes.find((b) => b.numero === Number(boxNumero))
  if (!box) throw new Error('Box no encontrado.')
  box.estado = nuevoEstado
  if (nuevoEstado === 'Fuera de servicio') {
    box.activo = false
  } else {
    box.activo = true
  }
  saveStoredBoxes(boxes)
  return box
}

export async function assignCallToBoxApi(boxNumero, ticketId, tecnicoMatricula) {
  const boxes = getStoredBoxes()
  const box = boxes.find((b) => b.numero === Number(boxNumero))
  if (!box) throw new Error('Box no encontrado.')
  
  box.estado = 'En atencion'
  box.ticketActualId = ticketId
  box.tecnicoMatricula = tecnicoMatricula || box.tecnicoMatricula
  saveStoredBoxes(boxes)

  return box
}

export async function finishAttentionInBoxApi(boxNumero) {
  const boxes = getStoredBoxes()
  const box = boxes.find((b) => b.numero === Number(boxNumero))
  if (!box) throw new Error('Box no encontrado.')

  const finishedTicketId = box.ticketActualId
  box.estado = 'Disponible'
  box.ticketActualId = null
  saveStoredBoxes(boxes)

  return { box, finishedTicketId }
}
