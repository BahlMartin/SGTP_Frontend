import { useState, useEffect } from 'react'
import { useBox } from '../context/BoxContext'
import { useTriageQueue } from '../context/TriageQueueContext'
import { useAuth } from '../context/AuthContext'

import { useFeedbackNotice } from './useFeedbackNotice'

export function useTecnicoBox() {
  const {
    boxes,
    boxesLoading,
    boxesError,
    currentBoxNumber,
    setCurrentBoxNumber,
    changeBoxStatus,
    tomarBox,
    refreshBoxes
  } = useBox()
  const {
    waitingQueue,
    activeInBoxes,
    callNextPatient,
    finishAttention,
    updateBoxStudies,
    refreshTickets
  } = useTriageQueue()
  const { userData } = useAuth()
  const { notice: feedbackMsg, showNotice: showNotification, clearNotice } = useFeedbackNotice(4000)

  const [completedStudies, setCompletedStudies] = useState({})
  const [isProcessing, setIsProcessing] = useState(false)

  const currentBoxKey = `Box ${currentBoxNumber}`
  const activeBoxData = boxes.find(
    (boxItem) => Number(boxItem.numero) === Number(currentBoxNumber)
  ) || {
    numero: currentBoxNumber,
    nombre: currentBoxKey,
    estado: 'Disponible'
  }

  const patientInBox = activeInBoxes[currentBoxKey]
  const matriculaTecnico = userData?.matricula || 'TEC-3391'

  // Al llamar o posicionar un paciente en el box, los estudios inician en 'Pendiente' por defecto
  useEffect(() => {
    setCompletedStudies({})
  }, [
    patientInBox?.id_ticket || patientInBox?.id,
    patientInBox?.num_llamado,
    patientInBox?.num_totem,
    patientInBox?.estudios?.join(',')
  ])

  // Posicionar al técnico en su box inicial al ingresar
  useEffect(() => {
    if (userData?.rol === 'Box' && currentBoxNumber) {
      tomarBox(currentBoxNumber).catch((err) => {
        console.error('Error al posicionar box inicial:', err)
      })
    }
  }, [userData?.rol])


  const handleSelectBox = async (newBoxNumber) => {
    setCurrentBoxNumber(newBoxNumber)
    try {
      await tomarBox(newBoxNumber)
      showNotification(`Posicionado en Box ${newBoxNumber}`)
    } catch (error) {
      console.error('Error al tomar box:', error)
    }
  }

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

  const handleModifyStudies = async ({ cancelarEstudios, agregarEstudios }) => {
    if (!patientInBox) {
      alert('No hay paciente en atención en este box.')
      return
    }

    setIsProcessing(true)
    try {
      const result = await updateBoxStudies(currentBoxNumber, {
        cancelarEstudios,
        agregarEstudios
      })
      showNotification(
        result.mensaje || 'Estudios de la orden médica actualizados correctamente.'
      )
      return result
    } catch (error) {
      alert(error.message || 'Error al modificar estudios en Box.')
      throw error
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

  const handleSelectAllStudies = (markAsCompleted = true) => {
    if (!patientInBox || !Array.isArray(patientInBox.estudios)) return
    const newMap = {}
    patientInBox.estudios.forEach((studyName) => {
      newMap[studyName] = markAsCompleted
    })
    setCompletedStudies(newMap)
  }

  const handleCallSpecificPatient = async (ticketId) => {
    if (patientInBox) {
      alert(`El ${currentBoxKey} ya tiene un paciente en atención (${patientInBox.paciente_nombre} ${patientInBox.paciente_apellido}). Finalice la consulta actual antes de llamar a otro paciente.`)
      return
    }

    setIsProcessing(true)
    try {
      const calledTicket = await callNextPatient(currentBoxNumber, ticketId)
      await changeBoxStatus(currentBoxNumber, 'En atencion')
      showNotification(
        `Paciente ${calledTicket.paciente_nombre} ${calledTicket.paciente_apellido} convocado directamente a ${currentBoxKey}`
      )
    } catch (error) {
      alert(error.message || 'Error al convocar al paciente.')
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    boxes,
    boxesLoading,
    boxesError,
    refreshBoxes,
    currentBoxNumber,
    setCurrentBoxNumber,
    handleSelectBox,
    currentBoxKey,
    activeBoxData,
    patientInBox,
    waitingQueue,
    refreshTickets,
    completedStudies,
    feedbackMsg,
    isProcessing,
    matriculaTecnico,
    handleStatusChange,
    handleCallNext,
    handleCallSpecificPatient,
    handleFinishConsultation,
    handleModifyStudies,
    toggleStudyCheck,
    handleSelectAllStudies,
    showNotification,
    clearNotice
  }
}
