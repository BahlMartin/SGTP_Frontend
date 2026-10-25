import React, { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import { useTecnicoBox } from '../../hooks/useTecnicoBox'
import BoxControlCard from './components/BoxControlCard/BoxControlCard'
import ActiveBoxesCard from '../../components/ActiveBoxesCard/ActiveBoxesCard'
import RefreshButton from '../../components/RefreshButton/RefreshButton'
import PatientInAttentionCard from './components/PatientInAttentionCard/PatientInAttentionCard'
import MultiboxQueueCard from './components/MultiboxQueueCard/MultiboxQueueCard'
import './TecnicoBoxScreen.css'
import { useWebSocket } from '../../hooks/useWebSocket'

export default function TecnicoBoxScreen() {
  const {
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
    completedStudies,
    feedbackMsg,
    isProcessing,
    matriculaTecnico,
    handleStatusChange,
    handleCallNext,
    handleFinishConsultation,
    handleModifyStudies,
    toggleStudyCheck
  } = useTecnicoBox()

  // Implementación de WebSocket
  const { lastMessage: wsQueueMessage } = useWebSocket('queue')
  const { lastMessage: wsBoxMessage } = useWebSocket('boxes')

  useEffect(() => {
    // Si la cola se actualiza, se llama un paciente o un compañero actualiza/libera un box, recargamos la vista
    const qEvt = wsQueueMessage?.event || wsQueueMessage?.action
    const bEvt = wsBoxMessage?.event || wsBoxMessage?.action

    const isQueueChange = ['QUEUE_UPDATED', 'TICKET_LLAMADO', 'TICKET_CALLED', 'TICKET_CREATED', 'NEW_TICKET'].includes(qEvt)
    const isBoxChange = ['BOX_ATTENDING', 'BOX_UPDATED', 'UPDATE_BOX'].includes(bEvt)

    if (isQueueChange || isBoxChange) {
      refreshBoxes()
    }
  }, [wsQueueMessage, wsBoxMessage, refreshBoxes])


  return (
    <div className="box-screen">
      <Navbar />

      <main className="box-screen__main">
        <header className="box-screen__header">
          <h1 className="box-screen__title">Box de atención</h1>
          <p className="box-screen__subtitle">Cola multibox centralizada y control operativo del box</p>
        </header>

        {feedbackMsg && (
          <div className="box-screen__feedback-banner">
            <CheckCircle2 className="box-screen__feedback-icon" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="box-screen__grid">
          {/* Columna Izquierda: Panel de control de box, Búsqueda y Boxes en línea */}
          <div className="box-screen__left-column">
            <BoxControlCard
              boxesList={boxes}
              currentBoxNumber={currentBoxNumber}
              onSelectBox={handleSelectBox}
              currentStatus={activeBoxData.estado}
              onStatusChange={handleStatusChange}
              disabled={isProcessing}
            />

            <PatientSearch />

            <ActiveBoxesCard
              canToggleStatus={false}
              onSelectStaff={null}
              actionSlot={
                <RefreshButton
                  onRefresh={refreshBoxes}
                  isLoading={boxesLoading}
                />
              }
            />
          </div>

          {/* Columna Derecha: Paciente en atención y Cola Multibox Centralizada */}
          <div className="box-screen__right-column">
            <PatientInAttentionCard
              patientInBox={patientInBox}
              currentBoxKey={currentBoxKey}
              matriculaTecnico={matriculaTecnico}
              isProcessing={isProcessing}
              completedStudies={completedStudies}
              onToggleStudyCheck={toggleStudyCheck}
              onCallNext={handleCallNext}
              onFinishConsultation={handleFinishConsultation}
              onModifyStudies={handleModifyStudies}
            />

            <MultiboxQueueCard
              waitingQueue={waitingQueue}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
