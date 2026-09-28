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
    <div className="admision-screen">
      <Navbar />

      <main className="admision-screen__main">
        <div className="admision-screen__header">
          <h1 className="admision-screen__title">Admision</h1>
          <p className="admision-screen__subtitle">Registro de pacientes, clasificacion de triage y emision de tickets</p>
        </div>

        <div className="admision-screen__grid">
          {/* Columna Izquierda: Formulario Principal de Admisión */}
          <div className="admision-screen__form-card">
            <div className="admision-screen__card-header">
              <UserPlus size={24} className="admision-screen__card-icon" />
              <h2 className="admision-screen__card-title">Ingreso y clasificacion de pacientes</h2>
            </div>

            <form onSubmit={handleSubmit} className="admision-screen__form">
              <div className="admision-screen__form-row">
                <div className="admision-screen__field">
                  <label className="admision-screen__label">DNI</label>
                  <input
                    type="text"
                    className={`admision-screen__input ${errors.dni ? 'admision-screen__input--error' : ''}`}
                    placeholder="ej: 38472910"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                  />
                  {errors.dni && <span className="admision-screen__error-text">{errors.dni}</span>}
                </div>

                <div className="admision-screen__field">
                  <label className="admision-screen__label">Obra social</label>
                  <input
                    type="text"
                    className="admision-screen__input"
                    placeholder="ej: OSDE, PAMI, IOMA"
                    value={obraSocial}
                    onChange={(e) => setObraSocial(e.target.value)}
                  />
                </div>
              </div>

              <div className="admision-screen__form-row">
                <div className="admision-screen__field">
                  <label className="admision-screen__label">Nombre</label>
                  <input
                    type="text"
                    className={`admision-screen__input ${errors.nombre ? 'admision-screen__input--error' : ''}`}
                    placeholder="Nombre del paciente"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                  {errors.nombre && <span className="admision-screen__error-text">{errors.nombre}</span>}
                </div>

                <div className="admision-screen__field">
                  <label className="admision-screen__label">Apellido</label>
                  <input
                    type="text"
                    className={`admision-screen__input ${errors.apellido ? 'admision-screen__input--error' : ''}`}
                    placeholder="Apellido del paciente"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                  />
                  {errors.apellido && <span className="admision-screen__error-text">{errors.apellido}</span>}
                </div>
              </div>

              <div className="admision-screen__form-row admision-screen__form-row--center">
                <div className="admision-screen__field admision-screen__field--center">
                  <label className="admision-screen__label">N° de llamado(sistema externo)</label>
                  <input
                    type="text"
                    className="admision-screen__input admision-screen__input--center"
                    placeholder="ej: 104"
                    value={numLlamado}
                    onChange={(e) => setNumLlamado(e.target.value)}
                  />
                </div>
              </div>

              {/* Categorías de Triage según Imagen 3 */}
              <div className="admision-screen__triage-section">
                <label className="admision-screen__section-label">Categoria de triage</label>
                <div className="admision-screen__triage-grid">
                  {TRIAGE_LIST.map((t) => {
                    const isSelected = selectedTriage === t.key
                    return (
                      <button
                        type="button"
                        key={t.id}
                        className={`admision-screen__triage-card ${isSelected ? 'admision-screen__triage-card--selected' : ''}`}
                        onClick={() => handleTriageSelect(t.key)}
                      >
                        <span className="admision-screen__triage-dot" style={{ backgroundColor: t.color }} />
                        <div className="admision-screen__triage-text">
                          <span className="admision-screen__triage-label">{t.label}</span>
                          <span className="admision-screen__triage-desc">{t.subtitle}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {selectedTriage === 'Otro' && (
                  <div className="admision-screen__justification">
                    <label className="admision-screen__justification-label">Justificación técnica requerida:</label>
                    <textarea
                      className={`admision-screen__justification-input ${errors.justificacion ? 'admision-screen__justification-input--error' : ''}`}
                      rows={2}
                      placeholder="Indique motivo clínico o derivación especial..."
                      value={justificacionOtro}
                      onChange={(e) => setJustificacionOtro(e.target.value)}
                    />
                    {errors.justificacion && <span className="admision-screen__error-text">{errors.justificacion}</span>}
                  </div>
                )}
              </div>

              {/* Sección de Estudios Solicitados con OCR y Selección Rápida */}
              <div className="admision-screen__studies-section">
                <div className="admision-screen__studies-header">
                  <label className="admision-screen__section-label">Estudios solicitados</label>
                  <button
                    type="button"
                    className="admision-screen__scan-ocr-btn"
                    onClick={() => setShowOcrModal(true)}
                  >
                    <Sparkles size={16} />
                    Escanear Receta con IA (OCR)
                  </button>
                </div>

                <div className="admision-screen__studies-tags">
                  {['Hemograma', 'Bioquimica', 'Orina', 'Cultivo', 'Glucemia', 'Coagulograma'].map((st) => (
                    <button
                      type="button"
                      key={st}
                      className={`admision-screen__study-chip ${selectedStudies.includes(st) ? 'admision-screen__study-chip--active' : ''}`}
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
                  <div className="admision-screen__studies-summary">
                    <span>Cargados ({selectedStudies.length}): </span>
                    <strong>{selectedStudies.join(', ')}</strong>
                  </div>
                )}
              </div>

              <button type="submit" className="admision-screen__submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Generando ticket...' : 'Emitir Ticket Asistencial'}
              </button>
            </form>
          </div>

          {/* Columna Derecha: Últimos ingresos y Búsqueda de Paciente */}
          <div className="admision-screen__side-column">
            <div className="admision-screen__recent-card">
              <h3 className="admision-screen__side-title">Últimos ingresos de hoy</h3>
              {todayTickets.length === 0 ? (
                <p className="admision-screen__empty-notice">No hubo ningun ingreso</p>
              ) : (
                <ul className="admision-screen__recent-list">
                  {todayTickets.slice(0, 6).map((t) => (
                    <li key={t.id} className="admision-screen__recent-item" onClick={() => setIssuedTicket(t)}>
                      <div className="admision-screen__entry-left">
                        <span className="admision-screen__entry-call-num">{t.num_llamado || t.num_totem}</span>
                        <div className="admision-screen__entry-details">
                          <span className="admision-screen__entry-name">
                            {t.paciente_nombre} {t.paciente_apellido}
                          </span>
                          <span className="admision-screen__entry-time">{formatTimeHHMM(t.fecha_hora_admision)} hs</span>
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
