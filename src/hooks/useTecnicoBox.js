import { useState } from 'react'
import { useBox } from '../context/BoxContext'
import { useTriageQueue } from '../context/TriageQueueContext'
import { useAuth } from '../context/AuthContext'

import { useFeedbackNotice } from './useFeedbackNotice'

export function useTecnicoBox() {
  const { boxes, currentBoxNumber, setCurrentBoxNumber, changeBoxStatus } = useBox()
  const { waitingQueue, activeInBoxes, callNextPatient, finishAttention } = useTriageQueue()
  const { userData } = useAuth()
  const { notice: feedbackMsg, showNotice: showNotification, clearNotice } = useFeedbackNotice(4000)

  const [completedStudies, setCompletedStudies] = useState({})
  const [isProcessing, setIsProcessing] = useState(false)

  const currentBoxKey = `Box ${currentBoxNumber}`
  const activeBoxData = boxes.find((boxItem) => boxItem.numero === Number(currentBoxNumber)) || {
    numero: currentBoxNumber,
    nombre: currentBoxKey,
    estado: 'Disponible'
  }

  const patientInBox = activeInBoxes[currentBoxKey]
  const matriculaTecnico = userData?.matricula || 'TEC-3391'

  const handleStatusChange = async (newStatus) => {
    try {
      await changeBoxStatus(currentBoxNumber, newStatus)
      showNotification(`Estado de ${currentBoxKey} actualizado a: ${newStatus}`)
    } catch (error) {
      alert(error.message)
    }
  }

  const handleCallNext = async () => {
    setIsProcessing(true)
    try {
      const calledTicket = await callNextPatient(currentBoxNumber, matriculaTecnico)
      await changeBoxStatus(currentBoxNumber, 'En atencion')
      showNotification(
        `Paciente ${calledTicket.paciente_nombre} ${calledTicket.paciente_apellido} (Llamado N° ${calledTicket.num_llamado}) convocado al ${currentBoxKey}`
      )
    } catch (error) {
      alert(error.message || 'Error al convocar paciente.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFinishConsultation = async () => {
    if (!patientInBox) {
      alert('No hay paciente en atención en este box.')
      return
    }

    setIsProcessing(true)
    try {
      await finishAttention(currentBoxNumber)
      await changeBoxStatus(currentBoxNumber, 'Disponible')
      showNotification(
        `Consulta finalizada con éxito para el paciente ${patientInBox.paciente_nombre}. Box disponible.`
      )
    } catch (error) {
      alert(error.message || 'Error al finalizar consulta.')
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleStudyCheck = (studyName) => {
    setCompletedStudies((previousCompleted) => ({
      ...previousCompleted,
      [studyName]: !previousCompleted[studyName]
    }))
  }

  return {
    boxes,
    currentBoxNumber,
    setCurrentBoxNumber,
    currentBoxKey,
    activeBoxData,
    patientInBox,
    waitingQueue,
    completedStudies,
    feedbackMsg,
    isProcessing,
    matriculaTecnico,
    handleStatusChange,
    handleCallNext,
    handleFinishConsultation,
    toggleStudyCheck,
    showNotification,
    clearNotice
  }
}
