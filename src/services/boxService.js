import { getCurrentUtcIso } from '../utils/formatters'
import { DEMO_BOXES } from '../data/demoBoxes'

let runtimeBoxes = DEMO_BOXES.map((box) => ({ ...box }))

function getStoredBoxes() {
  return runtimeBoxes
}

function saveStoredBoxes(boxes) {
  runtimeBoxes = boxes
}

export async function fetchBoxesApi() {
  return getStoredBoxes()
}

export async function updateBoxStateApi(boxNumero, nuevoEstado) {
  const boxes = getStoredBoxes()
  const box = boxes.find((currentBox) => currentBox.numero === Number(boxNumero))
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
  const box = boxes.find((currentBox) => currentBox.numero === Number(boxNumero))
  if (!box) throw new Error('Box no encontrado.')
  
  box.estado = 'En atencion'
  box.ticketActualId = ticketId
  box.tecnicoMatricula = tecnicoMatricula || box.tecnicoMatricula
  saveStoredBoxes(boxes)

  return box
}

export async function finishAttentionInBoxApi(boxNumero) {
  const boxes = getStoredBoxes()
  const box = boxes.find((currentBox) => currentBox.numero === Number(boxNumero))
  if (!box) throw new Error('Box no encontrado.')

  const finishedTicketId = box.ticketActualId
  box.estado = 'Disponible'
  box.ticketActualId = null
  saveStoredBoxes(boxes)

  return { box, finishedTicketId }
}
