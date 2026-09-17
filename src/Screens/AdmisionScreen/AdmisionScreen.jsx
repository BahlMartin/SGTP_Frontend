import React, { useState } from 'react'
import { UserPlus, Sparkles, Check, PlusCircle } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import TicketModal from '../../components/TicketModal/TicketModal'
import RecipeOcrModal from '../../components/RecipeOcrModal/RecipeOcrModal'
import TriageBadge from '../../components/TriageBadge/TriageBadge'
import { TRIAGE_LIST } from '../../utils/triageAlgorithm'
import { validatePersonName, validateDni } from '../../utils/validators'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { formatTimeHHMM } from '../../utils/formatters'
import './AdmisionScreen.css'

export default function AdmisionScreen() {
  const { createTicket, tickets } = useTriageQueue()
  const { userData } = useAuth()

  const [dni, setDni] = useState('')
  const [obraSocial, setObraSocial] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [numLlamado, setNumLlamado] = useState('')
  const [selectedTriage, setSelectedTriage] = useState('Guardia')
  const [justificacionOtro, setJustificacionOtro] = useState('')
  const [selectedStudies, setSelectedStudies] = useState([])

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [issuedTicket, setIssuedTicket] = useState(null)
  const [showOcrModal, setShowOcrModal] = useState(false)

  // Filtrar tickets emitidos hoy
  const todayTickets = tickets.filter((t) => {
    if (!t.fecha_hora_admision) return false
    return new Date(t.fecha_hora_admision).toDateString() === new Date().toDateString()
  })

  const handlePatientSelectFromSearch = (patient) => {
    setDni(patient.dni)
    setObraSocial(patient.obraSocial || '')
    setNombre(patient.nombre)
    setApellido(patient.apellido)
    setErrors({})
  }

  const handleTriageSelect = (triageKey) => {
    setSelectedTriage(triageKey)
    if (triageKey !== 'Otro') {
      setJustificacionOtro('')
    }
  }

  const handleAddManualStudy = (studyName) => {
    if (!selectedStudies.includes(studyName)) {
      setSelectedStudies([...selectedStudies, studyName])
    }
  }

  const handleRemoveStudy = (studyName) => {
    setSelectedStudies(selectedStudies.filter((s) => s !== studyName))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}

    const dniVal = validateDni(dni)
    if (!dniVal.isValid) newErrors.dni = dniVal.error

    const nomVal = validatePersonName(nombre)
    if (!nomVal.isValid) newErrors.nombre = nomVal.error

    const apeVal = validatePersonName(apellido)
    if (!apeVal.isValid) newErrors.apellido = apeVal.error

    if (selectedTriage === 'Otro' && (!justificacionOtro || justificacionOtro.trim().length < 5)) {
      newErrors.justificacion = 'La categoría "Otro" exige una justificación técnica obligatoria.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      const payload = {
        paciente_dni: dni.trim(),
        paciente_obra_social: obraSocial.trim() || 'Particular',
        paciente_nombre: nombre.trim(),
        paciente_apellido: apellido.trim(),
        num_llamado: numLlamado.trim() || String(Math.floor(100 + Math.random() * 900)),
        clasificacion_triage: selectedTriage,
        justificacion_otro: justificacionOtro.trim(),
        estudios: selectedStudies.length > 0 ? selectedStudies : ['Rutina Básica'],
        mat_admision: userData?.matricula || 'ADM-4412'
      }

      const ticket = await createTicket(payload)
      setIssuedTicket(ticket)

      // Limpiar formulario
      setDni('')
      setObraSocial('')
      setNombre('')
      setApellido('')
      setNumLlamado('')
      setSelectedTriage('Guardia')
      setJustificacionOtro('')
      setSelectedStudies([])
    } catch (err) {
      console.error(err)
      alert(err.message || 'Error al emitir el ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admision-screen-layout">
      <Navbar />

      <main className="admision-main-content">
        <div className="admision-header-text">
          <h1 className="page-title">Admision</h1>
          <p className="page-subtitle">Registro de pacientes, clasificacion de triage y emision de tickets</p>
        </div>

        <div className="admision-grid-container">
          {/* Columna Izquierda: Formulario Principal de Admisión */}
          <div className="admision-form-card">
            <div className="card-header-icon-title">
              <UserPlus size={24} className="header-icon-blue" />
              <h2>Ingreso y clasificacion de pacientes</h2>
            </div>

            <form onSubmit={handleSubmit} className="admision-form">
              <div className="form-row-two-cols">
                <div className="input-group">
                  <label>DNI</label>
                  <input
                    type="text"
                    className={`form-input ${errors.dni ? 'error' : ''}`}
                    placeholder="ej: 38472910"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                  />
                  {errors.dni && <span className="error-text">{errors.dni}</span>}
                </div>

                <div className="input-group">
                  <label>Obra social</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ej: OSDE, PAMI, IOMA"
                    value={obraSocial}
                    onChange={(e) => setObraSocial(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-two-cols">
                <div className="input-group">
                  <label>Nombre</label>
                  <input
                    type="text"
                    className={`form-input ${errors.nombre ? 'error' : ''}`}
                    placeholder="Nombre del paciente"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                  {errors.nombre && <span className="error-text">{errors.nombre}</span>}
                </div>

                <div className="input-group">
                  <label>Apellido</label>
                  <input
                    type="text"
                    className={`form-input ${errors.apellido ? 'error' : ''}`}
                    placeholder="Apellido del paciente"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                  />
                  {errors.apellido && <span className="error-text">{errors.apellido}</span>}
                </div>
              </div>

              <div className="form-row-center">
                <div className="input-group center-group">
                  <label>N° de llamado(sistema externo)</label>
                  <input
                    type="text"
                    className="form-input center-input"
                    placeholder="ej: 104"
                    value={numLlamado}
                    onChange={(e) => setNumLlamado(e.target.value)}
                  />
                </div>
              </div>

              {/* Categorías de Triage según Imagen 3 */}
              <div className="triage-section">
                <label className="section-label">Categoria de triage</label>
                <div className="triage-buttons-grid">
                  {TRIAGE_LIST.map((t) => {
                    const isSelected = selectedTriage === t.key
                    return (
                      <button
                        type="button"
                        key={t.id}
                        className={`triage-btn-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleTriageSelect(t.key)}
                      >
                        <span className="triage-circle-dot" style={{ backgroundColor: t.color }} />
                        <div className="triage-btn-text">
                          <span className="triage-label-main">{t.label}</span>
                          <span className="triage-subtitle-desc">{t.subtitle}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {selectedTriage === 'Otro' && (
                  <div className="justification-wrapper">
                    <label>Justificación técnica requerida:</label>
                    <textarea
                      className={`justification-textarea ${errors.justificacion ? 'error' : ''}`}
                      rows={2}
                      placeholder="Indique motivo clínico o derivación especial..."
                      value={justificacionOtro}
                      onChange={(e) => setJustificacionOtro(e.target.value)}
                    />
                    {errors.justificacion && <span className="error-text">{errors.justificacion}</span>}
                  </div>
                )}
              </div>

              {/* Sección de Estudios Solicitados con OCR y Selección Rápida */}
              <div className="studies-section">
                <div className="studies-header">
                  <label className="section-label">Estudios solicitados</label>
                  <button
                    type="button"
                    className="btn-scan-ocr"
                    onClick={() => setShowOcrModal(true)}
                  >
                    <Sparkles size={16} />
                    Escanear Receta con IA (OCR)
                  </button>
                </div>

                <div className="studies-quick-tags">
                  {['Hemograma', 'Bioquimica', 'Orina', 'Cultivo', 'Glucemia', 'Coagulograma'].map((st) => (
                    <button
                      type="button"
                      key={st}
                      className={`study-chip ${selectedStudies.includes(st) ? 'active' : ''}`}
                      onClick={() =>
                        selectedStudies.includes(st) ? handleRemoveStudy(st) : handleAddManualStudy(st)
                      }
                    >
                      {selectedStudies.includes(st) ? <Check size={14} /> : <PlusCircle size={14} />}
                      {st}
                    </button>
                  ))}
                </div>

                {selectedStudies.length > 0 && (
                  <div className="selected-studies-summary">
                    <span>Cargados ({selectedStudies.length}): </span>
                    <strong>{selectedStudies.join(', ')}</strong>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-emit-ticket" disabled={isSubmitting}>
                {isSubmitting ? 'Generando ticket...' : 'Emitir Ticket Asistencial'}
              </button>
            </form>
          </div>

          {/* Columna Derecha: Últimos ingresos y Búsqueda de Paciente */}
          <div className="admision-side-column">
            <div className="recent-entries-card">
              <h3 className="side-card-title">Últimos ingresos de hoy</h3>
              {todayTickets.length === 0 ? (
                <p className="empty-notice">No hubo ningun ingreso</p>
              ) : (
                <ul className="recent-entries-list">
                  {todayTickets.slice(0, 6).map((t) => (
                    <li key={t.id} className="recent-entry-item" onClick={() => setIssuedTicket(t)}>
                      <div className="entry-left">
                        <span className="entry-call-num">{t.num_llamado || t.num_totem}</span>
                        <div className="entry-details">
                          <span className="entry-patient-name">
                            {t.paciente_nombre} {t.paciente_apellido}
                          </span>
                          <span className="entry-time">{formatTimeHHMM(t.fecha_hora_admision)} hs</span>
                        </div>
                      </div>
                      <TriageBadge categoryKey={t.clasificacion_triage} showPriority={false} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <PatientSearch onSelectPatient={handlePatientSelectFromSearch} />
          </div>
        </div>
      </main>

      {/* Modal de Ticket Emitido */}
      {issuedTicket && (
        <TicketModal ticket={issuedTicket} onClose={() => setIssuedTicket(null)} />
      )}

      {/* Modal de Escaneo OCR con Human-in-the-Loop */}
      {showOcrModal && (
        <RecipeOcrModal
          onClose={() => setShowOcrModal(false)}
          onConfirmStudies={(extracted) => setSelectedStudies(extracted)}
        />
      )}
    </div>
  )
}
