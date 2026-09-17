import React, { useState } from 'react'
import { Tv, Bell, CheckCircle2, Clock, Radio } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import TriageBadge from '../../components/TriageBadge/TriageBadge'
import { useBox } from '../../context/BoxContext'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { formatTimeHHMM, calculateMinutesDiff } from '../../utils/formatters'
import './TecnicoBoxScreen.css'

export default function TecnicoBoxScreen() {
  const { boxes, currentBoxNumber, setCurrentBoxNumber, changeBoxStatus } = useBox()
  const { waitingQueue, activeInBoxes, callNextPatient, finishAttention } = useTriageQueue()
  const { userData } = useAuth()

  const [completedStudies, setCompletedStudies] = useState({})
  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const currentBoxKey = `Box ${currentBoxNumber}`
  const activeBoxData = boxes.find((b) => b.numero === Number(currentBoxNumber)) || {
    numero: currentBoxNumber,
    nombre: currentBoxKey,
    estado: 'Disponible'
  }

  // Paciente actualmente en este box
  const patientInBox = activeInBoxes[currentBoxKey]

  const handleStatusChange = async (newStatus) => {
    try {
      await changeBoxStatus(currentBoxNumber, newStatus)
      showNotification(`Estado de ${currentBoxKey} actualizado a: ${newStatus}`)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCallNext = async () => {
    setIsProcessing(true)
    try {
      const tecnicoMat = userData?.matricula || 'TEC-3391'
      const called = await callNextPatient(currentBoxNumber, tecnicoMat)
      await changeBoxStatus(currentBoxNumber, 'En atencion')
      showNotification(`Paciente ${called.paciente_nombre} ${called.paciente_apellido} (Llamado N° ${called.num_llamado}) convocado al ${currentBoxKey}`)
    } catch (err) {
      alert(err.message || 'Error al convocar paciente.')
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
      showNotification(`Consulta finalizada con éxito para el paciente ${patientInBox.paciente_nombre}. Box disponible.`)
    } catch (err) {
      alert(err.message || 'Error al finalizar consulta.')
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleStudyCheck = (studyName) => {
    setCompletedStudies((prev) => ({
      ...prev,
      [studyName]: !prev[studyName]
    }))
  }

  const showNotification = (msg) => {
    setFeedbackMsg(msg)
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  return (
    <div className="box-screen-layout">
      <Navbar />

      <main className="box-main-content">
        <div className="box-header-text">
          <h1 className="page-title">Box de atención</h1>
          <p className="page-subtitle">Cola multibox centralizada y control operativo del box</p>
        </div>

        {feedbackMsg && (
          <div className="box-feedback-banner">
            <CheckCircle2 size={18} />
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="box-grid-container">
          {/* Columna Izquierda: Panel de control de box, Búsqueda y Boxes en línea */}
          <div className="box-left-column">
            {/* Panel de control de box (Imagen 4) */}
            <div className="box-control-card">
              <div className="card-header-icon-title">
                <Tv size={20} className="header-icon-blue" />
                <h2>Panel de control de box</h2>
              </div>

              <div className="assigned-box-select-wrap">
                <label>Box asignado</label>
                <select
                  className="box-select-input"
                  value={currentBoxNumber}
                  onChange={(e) => setCurrentBoxNumber(Number(e.target.value))}
                >
                  <option value={1}>Box 1</option>
                  <option value={2}>Box 2</option>
                  <option value={3}>Box 3</option>
                  <option value={4}>Box 4</option>
                </select>
              </div>

              <div className="box-status-toggle-buttons">
                <button
                  type="button"
                  className={`btn-status-toggle btn-disp ${activeBoxData.estado === 'Disponible' ? 'active' : ''}`}
                  onClick={() => handleStatusChange('Disponible')}
                >
                  Disponible
                </button>
                <button
                  type="button"
                  className={`btn-status-toggle btn-aten ${activeBoxData.estado === 'En atencion' ? 'active' : ''}`}
                  onClick={() => handleStatusChange('En atencion')}
                >
                  En atencion
                </button>
                <button
                  type="button"
                  className={`btn-status-toggle btn-fuera ${activeBoxData.estado === 'Fuera de servicio' ? 'active' : ''}`}
                  onClick={() => handleStatusChange('Fuera de servicio')}
                >
                  Fuera de servicio
                </button>
              </div>
            </div>

            {/* Búsqueda de Paciente */}
            <PatientSearch
              onSelectPatient={(p) => {
                showNotification(`Paciente localizado: ${p.nombre} ${p.apellido} (DNI ${p.dni})`)
              }}
            />

            {/* Boxes en línea (Imagen 4) */}
            <div className="boxes-online-card">
              <h3 className="online-title">Boxes en linea</h3>
              <ul className="boxes-online-list">
                {boxes.map((b) => (
                  <li key={b.id} className="box-online-item">
                    <span className="box-name-label">{b.nombre}</span>
                    <span
                      className={`box-status-pill ${
                        b.estado === 'Disponible'
                          ? 'pill-green'
                          : b.estado === 'En atencion'
                          ? 'pill-blue'
                          : 'pill-red'
                      }`}
                    >
                      {b.estado}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Columna Derecha: Paciente en atención y Cola Multibox Centralizada */}
          <div className="box-right-column">
            {/* Paciente en atención (Imagen 4) */}
            <div className="patient-in-service-card">
              <div className="patient-service-header">
                <div>
                  <h3 className="service-card-title">Paciente en atención</h3>
                  <span className="box-technician-code">
                    {currentBoxKey} - {userData?.matricula || 'TEC-3391'}
                  </span>
                </div>

                <div className="service-header-actions">
                  <button
                    className="btn-call-next"
                    disabled={isProcessing || Boolean(patientInBox)}
                    onClick={handleCallNext}
                  >
                    <Bell size={18} />
                    Llamar siguiente
                  </button>
                  <button
                    className="btn-finish-consultation"
                    disabled={isProcessing || !patientInBox}
                    onClick={handleFinishConsultation}
                  >
                    <CheckCircle2 size={18} />
                    Finalizar consulta
                  </button>
                </div>
              </div>

              {patientInBox ? (
                <div className="active-patient-details">
                  <div className="patient-big-call-badge">
                    <span className="call-lbl">N° LLAMADO</span>
                    <span className="call-number">{patientInBox.num_llamado || patientInBox.num_totem}</span>
                  </div>

                  <div className="patient-info-meta">
                    <div className="patient-name-triage">
                      <h4 className="active-name">
                        {patientInBox.paciente_nombre} {patientInBox.paciente_apellido}
                      </h4>
                      <TriageBadge categoryKey={patientInBox.clasificacion_triage} />
                    </div>

                    <div className="patient-subdata">
                      <span>DNI: <strong>{patientInBox.paciente_dni}</strong></span>
                      <span>Obra Social: <strong>{patientInBox.paciente_obra_social}</strong></span>
                      <span>Ingreso: <strong>{formatTimeHHMM(patientInBox.fecha_hora_admision)} hs</strong></span>
                    </div>

                    {patientInBox.justificacion_otro && (
                      <div className="justification-note">
                        <strong>Justificación clínica:</strong> {patientInBox.justificacion_otro}
                      </div>
                    )}

                    {/* Checklist de Estudios para Toma de Muestra */}
                    <div className="studies-checklist-area">
                      <span className="checklist-title">Estudios clínicos a realizar (Check de muestra tomada):</span>
                      <div className="studies-checks-grid">
                        {(patientInBox.estudios || ['Muestra de Sangre', 'Orina']).map((st) => {
                          const done = completedStudies[st]
                          return (
                            <label
                              key={st}
                              className={`study-check-box ${done ? 'checked' : ''}`}
                              onClick={() => toggleStudyCheck(st)}
                            >
                              <input type="checkbox" checked={Boolean(done)} readOnly />
                              <span>{st}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-attention-box">
                  <p>No hay paciente en atención en este puesto.</p>
                  <span className="empty-hint">
                    Presione <strong>"Llamar siguiente"</strong> para convocar al paciente más crítico de la cola multibox.
                  </span>
                </div>
              )}
            </div>

            {/* Cola Multibox Centralizada (Imagen 4) */}
            <div className="multibox-queue-card">
              <div className="multibox-queue-header">
                <div className="queue-title-wrap">
                  <Radio size={18} className="live-icon" />
                  <h3>Cola multibox centralizada</h3>
                </div>
                <span className="queue-count-badge">
                  {waitingQueue.length} paciente(s) en espera
                </span>
              </div>

              {waitingQueue.length === 0 ? (
                <div className="empty-queue-msg">
                  <p>La cola de espera se encuentra despejada en este momento.</p>
                </div>
              ) : (
                <div className="queue-table-wrapper">
                  <table className="queue-table">
                    <thead>
                      <tr>
                        <th>N° LLAMADO</th>
                        <th>PACIENTE</th>
                        <th>CLASIFICACIÓN TRIAGE</th>
                        <th>ESPERA</th>
                        <th>ESTUDIOS</th>
                        <th>ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waitingQueue.map((ticket, idx) => {
                        const waitMins = calculateMinutesDiff(ticket.fecha_hora_admision, new Date().toISOString())
                        return (
                          <tr key={ticket.id} className={idx === 0 ? 'top-priority-row' : ''}>
                            <td>
                              <span className="table-call-pill">{ticket.num_llamado || ticket.num_totem}</span>
                            </td>
                            <td>
                              <div className="table-patient-cell">
                                <span className="p-name">{ticket.paciente_nombre} {ticket.paciente_apellido}</span>
                                <span className="p-dni">DNI: {ticket.paciente_dni}</span>
                              </div>
                            </td>
                            <td>
                              <TriageBadge categoryKey={ticket.clasificacion_triage} />
                            </td>
                            <td>
                              <span className="table-wait-time">
                                <Clock size={13} />
                                {waitMins || 0} min
                              </span>
                            </td>
                            <td>
                              <span className="table-studies-summary">
                                {ticket.estudios?.length || 1} estudio(s)
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn-call-direct"
                                disabled={Boolean(patientInBox)}
                                onClick={handleCallNext}
                                title="Convocar a este paciente al box activo"
                              >
                                Llamar a {currentBoxKey}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
