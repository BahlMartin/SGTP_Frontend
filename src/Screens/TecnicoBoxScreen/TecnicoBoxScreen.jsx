import React from 'react'
import { CheckCircle2 } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import { useTecnicoBox } from '../../hooks/useTecnicoBox'
import BoxControlCard from './components/BoxControlCard/BoxControlCard'
import OnlineBoxesCard from './components/OnlineBoxesCard/OnlineBoxesCard'
import PatientInAttentionCard from './components/PatientInAttentionCard/PatientInAttentionCard'
import MultiboxQueueCard from './components/MultiboxQueueCard/MultiboxQueueCard'
import './TecnicoBoxScreen.css'

export default function TecnicoBoxScreen() {
  const {
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
    showNotification
  } = useTecnicoBox()

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
              currentBoxNumber={currentBoxNumber}
              onSelectBox={(boxNumber) => setCurrentBoxNumber(boxNumber)}
              currentStatus={activeBoxData.estado}
              onStatusChange={handleStatusChange}
              disabled={isProcessing}
            />

            <PatientSearch
              onSelectPatient={(selectedPatient) => {
                showNotification(
                  `Paciente localizado: ${selectedPatient.nombre} ${selectedPatient.apellido} (DNI ${selectedPatient.dni})`
                )
              }}
            />

            <OnlineBoxesCard boxesList={boxes} />
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
            />

            <MultiboxQueueCard
              waitingQueue={waitingQueue}
              currentBoxKey={currentBoxKey}
              hasPatientInBox={Boolean(patientInBox)}
              onCallNext={handleCallNext}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
