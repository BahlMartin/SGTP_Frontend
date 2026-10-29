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
  const [isCallingNext, setIsCallingNext] = useState(false)
  const [callingTicketId, setCallingTicketId] = useState(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isModifyingStudies, setIsModifyingStudies] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const isProcessing = isCallingNext || Boolean(callingTicketId) || isFinishing || isCancelling || isModifyingStudies || isChangingStatus

  const currentBoxKey = `Box ${currentBoxNumber}`
  const activeBoxData = boxes.find(
    (boxItem) => Number(boxItem.numero) === Number(currentBoxNumber)
  ) || {
    numero: currentBoxNumber,
    nombre: currentBoxKey,
    estado: 'Disponible'
  }

  const isBoxOutOfService = activeBoxData?.estado === 'Fuera de servicio'
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
      const updatedBox = await tomarBox(newBoxNumber)
      if (updatedBox?.estado === 'Fuera de servicio') {
        showNotification(
          `Posicionado en Box ${newBoxNumber} (Fuera de servicio — solo la Jefa puede habilitarlo)`
        )
      } else {
        showNotification(`Posicionado en Box ${newBoxNumber}`)
      }
    } catch (error) {
      console.error('Error al tomar box:', error)
    }
  }

  const handleStatusChange = async (newStatus) => {
    if (isBoxOutOfService || newStatus === 'Fuera de servicio') {
      showNotification('Solo la Jefa de Laboratorio puede habilitar o poner fuera de servicio un box.')
      return
    }
    setIsChangingStatus(true)
    try {
      await changeBoxStatus(currentBoxNumber, newStatus)
      showNotification(`Estado de ${currentBoxKey} actualizado a: ${newStatus}`)
    } catch (error) {
      alert(error.message)
    } finally {
      setIsChangingStatus(false)
    }
  }

  const handleCallNext = async () => {
    if (isBoxOutOfService) {
      alert('El box se encuentra fuera de servicio. Solicite a la Jefa de Laboratorio su habilitación para llamar pacientes.')
      return
    }

    setIsCallingNext(true)
    try {
      const calledTicket = await callNextPatient(currentBoxNumber)
      await refreshBoxes()
      showNotification(
        `Paciente ${calledTicket.paciente_nombre} ${calledTicket.paciente_apellido} (Llamado N° ${calledTicket.num_llamado}) convocado al ${currentBoxKey}`
      )
    } catch (error) {
      alert(error.message || 'Error al convocar paciente.')
    } finally {
      setIsCallingNext(false)
    }
  }

  const handleFinishConsultation = async () => {
    if (!patientInBox) {
      alert('No hay paciente en atención en este box.')
      return
    }

    setIsFinishing(true)
    try {
      await finishAttention(currentBoxNumber)
      await refreshBoxes()
      showNotification(
        `Consulta finalizada con éxito para el paciente ${patientInBox.paciente_nombre}. Box disponible.`
      )
    } catch (error) {
      alert(error.message || 'Error al finalizar consulta.')
      throw error
    } finally {
      setIsFinishing(false)
    }
  }

  const handleCancelConsultation = async (observaciones = '') => {
    if (!patientInBox) {
      alert('No hay paciente en atención en este box.')
      return
    }

    setIsCancelling(true)
    try {
      const nombrePaciente = `${patientInBox.paciente_nombre || ''} ${patientInBox.paciente_apellido || ''}`.trim()
      await finishAttention(currentBoxNumber, 'Cancelado', observaciones)
      await refreshBoxes()
      showNotification(
        `Turno de ${nombrePaciente || 'paciente'} cancelado por ausencia. ${currentBoxKey} disponible.`
      )
    } catch (error) {
      alert(error.message || 'Error al cancelar el turno del paciente.')
      throw error
    } finally {
      setIsCancelling(false)
    }
  }

  const handleModifyStudies = async ({ cancelarEstudios, agregarEstudios }) => {
    if (!patientInBox) {
      alert('No hay paciente en atención en este box.')
      return
    }

    setIsModifyingStudies(true)
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
      setIsModifyingStudies(false)
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
    if (isBoxOutOfService) {
      alert('El box se encuentra fuera de servicio. Solicite a la Jefa de Laboratorio su habilitación para llamar pacientes.')
      return
    }

    if (patientInBox) {
      alert(`El ${currentBoxKey} ya tiene un paciente en atención (${patientInBox.paciente_nombre} ${patientInBox.paciente_apellido}). Finalice la consulta actual antes de llamar a otro paciente.`)
      return
    }

    setCallingTicketId(ticketId)
    try {
      const calledTicket = await callNextPatient(currentBoxNumber, ticketId)
      await refreshBoxes()
      showNotification(
        `Paciente ${calledTicket.paciente_nombre} ${calledTicket.paciente_apellido} convocado directamente a ${currentBoxKey}`
      )
    } catch (error) {
      alert(error.message || 'Error al convocar al paciente.')
    } finally {
      setCallingTicketId(null)
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
    isBoxOutOfService,
    patientInBox,
    waitingQueue,
    refreshTickets,
    completedStudies,
    feedbackMsg,
    isProcessing,
    isCallingNext,
    callingTicketId,
    isFinishing,
    isCancelling,
    isModifyingStudies,
    isChangingStatus,
    matriculaTecnico,
    handleStatusChange,
    handleCallNext,
    handleCallSpecificPatient,
    handleFinishConsultation,
    handleCancelConsultation,
    handleModifyStudies,
    toggleStudyCheck,
    handleSelectAllStudies,
    showNotification,
    clearNotice
  }
}
