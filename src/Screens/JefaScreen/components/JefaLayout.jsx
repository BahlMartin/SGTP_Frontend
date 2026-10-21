import React, { useEffect, useState } from 'react'
import { ArrowLeft, MoreHorizontal, Search, Tv, X } from 'lucide-react'
import Navbar from '../../../components/Navbar/Navbar'
import './JefaLayout.css'

const SECONDARY_PANELS = [
  { id: 'search', label: 'Búsqueda de pacientes', icon: Search },
  { id: 'boxes', label: 'Boxes en atención', icon: Tv }
]

export default function JefaLayout({
  headerContent,
  primaryContent,
  managementContent,
  desktopSearchContent,
  desktopManagementContent,
  isManagementView,
  onGoToManagement,
  onBackToMain,
  searchContent,
  boxesContent
}) {
  const [activePanel, setActivePanel] = useState(null)
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false)
  const [isCompactLayout, setIsCompactLayout] = useState(
    () => window.matchMedia('(max-width: 1024px)').matches
  )
  const selectedPanel = SECONDARY_PANELS.find((panel) => panel.id === activePanel)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    const handleLayoutChange = (event) => {
      setIsCompactLayout(event.matches)
      if (!event.matches) {
        setActivePanel(null)
        setIsOptionsMenuOpen(false)
        onBackToMain()
      }
    }

    mediaQuery.addEventListener('change', handleLayoutChange)
    return () => mediaQuery.removeEventListener('change', handleLayoutChange)
  }, [onBackToMain])

  useEffect(() => {
    if (!activePanel && !isOptionsMenuOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActivePanel(null)
        setIsOptionsMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePanel, isOptionsMenuOpen])

  useEffect(() => {
    if (!activePanel) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activePanel])

  return (
    <div className="jefa-screen">
      <Navbar />
      <main className="jefa-screen__main">
        <div
          className={`jefa-screen__page-header ${
            isManagementView ? 'jefa-screen__page-header--management' : ''
          }`}
        >
          {isCompactLayout && isManagementView && (
            <button
              type="button"
              className="jefa-screen__back-button"
              onClick={() => {
                setActivePanel(null)
                setIsOptionsMenuOpen(false)
                onBackToMain()
              }}
            >
              <ArrowLeft size={17} aria-hidden="true" />
              Volver al inicio
            </button>
          )}
          {headerContent}
          {isCompactLayout && !isManagementView && (
            <div className="jefa-screen__options">
              <button
                type="button"
                className="jefa-screen__options-button"
                aria-haspopup="menu"
                aria-expanded={isOptionsMenuOpen}
                aria-controls="jefa-screen-options-menu"
                onClick={() => {
                  setActivePanel(null)
                  setIsOptionsMenuOpen((isOpen) => !isOpen)
                }}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
                Más opciones
              </button>
              {isOptionsMenuOpen && (
                <div
                  id="jefa-screen-options-menu"
                  className="jefa-screen__options-menu"
                  role="menu"
                  aria-label="Otras opciones de Supervisión"
                >
                  {SECONDARY_PANELS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className="jefa-screen__options-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setIsOptionsMenuOpen(false)
                        setActivePanel(id)
                      }}
                    >
                      <Icon size={17} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="jefa-screen__options-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setIsOptionsMenuOpen(false)
                      setActivePanel(null)
                      onGoToManagement()
                    }}
                  >
                    <ArrowLeft size={17} aria-hidden="true" />
                    Gestión de personal y cuentas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {isCompactLayout ? (
          isManagementView ? managementContent : primaryContent
        ) : (
          <>
            {desktopSearchContent}
            {primaryContent}
            {desktopManagementContent}
          </>
        )}
      </main>

      {isCompactLayout && activePanel && (
        <div
          className="jefa-screen__secondary-panel"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivePanel(null)
          }}
        >
          <section
            className={`jefa-screen__secondary-dialog ${
              activePanel === 'search' ? 'jefa-screen__secondary-dialog--search' : ''
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="jefa-screen-secondary-title"
          >
            <div className="jefa-screen__secondary-panel-header">
              <h2
                id="jefa-screen-secondary-title"
                className="jefa-screen__secondary-panel-title"
              >
                {selectedPanel?.label}
              </h2>
              <button
                type="button"
                className="jefa-screen__secondary-panel-close"
                onClick={() => setActivePanel(null)}
                aria-label="Cerrar opciones"
              >
                <X size={20} />
              </button>
            </div>
            <div className="jefa-screen__secondary-content">
              {activePanel === 'search' ? searchContent : boxesContent}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
