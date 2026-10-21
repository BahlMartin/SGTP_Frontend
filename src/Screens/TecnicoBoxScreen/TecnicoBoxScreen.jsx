import React, { useEffect, useState } from 'react'
import { CheckCircle2, MoreHorizontal, Search, Tv, X } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import { useTecnicoBox } from '../../hooks/useTecnicoBox'
import BoxControlCard from './components/BoxControlCard/BoxControlCard'
import ActiveBoxesCard from '../../components/ActiveBoxesCard/ActiveBoxesCard'
import RefreshButton from '../../components/RefreshButton/RefreshButton'
import PatientInAttentionCard from './components/PatientInAttentionCard/PatientInAttentionCard'
import MultiboxQueueCard from './components/MultiboxQueueCard/MultiboxQueueCard'
import './TecnicoBoxScreen.css'

const SECONDARY_PANELS = [
  { id: 'control', label: 'Panel de control de box', icon: Tv },
  { id: 'search', label: 'Búsqueda de paciente', icon: Search },
  { id: 'boxes', label: 'Boxes de atención', icon: Tv }
]

export default function TecnicoBoxScreen() {
  const [activeSecondaryPanel, setActiveSecondaryPanel] = useState(null)
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false)
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
    toggleStudyCheck,
    handleSelectAllStudies,
    handleCallSpecificPatient
  } = useTecnicoBox()

  useEffect(() => {
    if (!activeSecondaryPanel && !isOptionsMenuOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveSecondaryPanel(null)
        setIsOptionsMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSecondaryPanel, isOptionsMenuOpen])

  useEffect(() => {
    if (!activeSecondaryPanel) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activeSecondaryPanel])

  useEffect(() => {
    const closePanelsOnDesktop = () => {
      if (window.innerWidth > 1024) {
        setActiveSecondaryPanel(null)
        setIsOptionsMenuOpen(false)
      }
    }

    window.addEventListener('resize', closePanelsOnDesktop)
    return () => window.removeEventListener('resize', closePanelsOnDesktop)
  }, [])

  const selectedPanel = SECONDARY_PANELS.find(
    (panel) => panel.id === activeSecondaryPanel
  )

  return (
    <div className="box-screen">
      <Navbar />

      <main className="box-screen__main">
        <header className="box-screen__header">
          <div className="box-screen__heading">
            <h1 className="box-screen__title">Box de atención</h1>
            <p className="box-screen__subtitle">Cola multibox centralizada y control operativo del box</p>
          </div>
          <div className="box-screen__options">
            <button
              type="button"
              className="box-screen__options-button"
              aria-haspopup="menu"
              aria-expanded={isOptionsMenuOpen}
              aria-controls="box-screen-options-menu"
              onClick={() => {
                setActiveSecondaryPanel(null)
                setIsOptionsMenuOpen((isOpen) => !isOpen)
              }}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
              Más opciones
            </button>
            {isOptionsMenuOpen && (
              <div
                id="box-screen-options-menu"
                className="box-screen__options-menu"
                role="menu"
                aria-label="Otras opciones de Box"
              >
                {SECONDARY_PANELS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className="box-screen__options-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setIsOptionsMenuOpen(false)
                      setActiveSecondaryPanel(id)
                    }}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {feedbackMsg && (
          <div className="box-screen__feedback-banner">
            <CheckCircle2 className="box-screen__feedback-icon" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="box-screen__grid">
          <section
            className={`box-screen__secondary-panel ${
              activeSecondaryPanel ? 'box-screen__secondary-panel--open' : ''
            }`}
            aria-label="Opciones secundarias de Box"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setActiveSecondaryPanel(null)
            }}
          >
            <div
              className={`box-screen__secondary-dialog ${
                activeSecondaryPanel === 'search'
                  ? 'box-screen__secondary-dialog--search'
                  : ''
              }`}
              role={activeSecondaryPanel ? 'dialog' : undefined}
              aria-modal={activeSecondaryPanel ? 'true' : undefined}
              aria-labelledby={activeSecondaryPanel ? 'box-screen-secondary-title' : undefined}
            >
              <div className="box-screen__secondary-panel-header">
                <h2
                  id="box-screen-secondary-title"
                  className="box-screen__secondary-panel-title"
                >
                  {selectedPanel?.label}
                </h2>
                <button
                  type="button"
                  className="box-screen__secondary-panel-close"
                  onClick={() => setActiveSecondaryPanel(null)}
                  aria-label="Cerrar opciones"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="box-screen__secondary-content">
                <div className="box-screen__left-column">
                  <div
                    className={`box-screen__secondary-item ${
                      activeSecondaryPanel === 'control' ? 'box-screen__secondary-item--active' : ''
                    }`}
                  >
                    <BoxControlCard
                      boxesList={boxes}
                      currentBoxNumber={currentBoxNumber}
                      onSelectBox={handleSelectBox}
                      currentStatus={activeBoxData.estado}
                      onStatusChange={handleStatusChange}
                      disabled={isProcessing}
                    />
                  </div>

                  <div
                    className={`box-screen__secondary-item ${
                      activeSecondaryPanel === 'search' ? 'box-screen__secondary-item--active' : ''
                    }`}
                  >
                    <PatientSearch />
                  </div>

                  <div
                    className={`box-screen__secondary-item ${
                      activeSecondaryPanel === 'boxes' ? 'box-screen__secondary-item--active' : ''
                    }`}
                  >
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
                </div>
              </div>
            </div>
          </section>

          {/* Columna Derecha: Paciente en atención y Cola Multibox Centralizada */}
          <div className="box-screen__right-column">
            <PatientInAttentionCard
              patientInBox={patientInBox}
              currentBoxKey={currentBoxKey}
              matriculaTecnico={matriculaTecnico}
              isProcessing={isProcessing}
              completedStudies={completedStudies}
              onToggleStudyCheck={toggleStudyCheck}
              onSelectAllStudies={handleSelectAllStudies}
              onCallNext={handleCallNext}
              onFinishConsultation={handleFinishConsultation}
              onModifyStudies={handleModifyStudies}
            />

            <MultiboxQueueCard
              waitingQueue={waitingQueue}
              onCallSpecificPatient={handleCallSpecificPatient}
              isProcessing={isProcessing}
              hasPatientInBox={Boolean(patientInBox)}
              currentBoxNumber={currentBoxNumber}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
