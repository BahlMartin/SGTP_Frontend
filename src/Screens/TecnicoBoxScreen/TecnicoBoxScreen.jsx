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
    <div className="box-screen">
      <Navbar />

      <main className="box-screen__main">
        <div className="box-screen__header">
          <h1 className="box-screen__title">Box de atención</h1>
          <p className="box-screen__subtitle">Cola multibox centralizada y control operativo del box</p>
        </div>

        {feedbackMsg && (
          <div className="box-screen__feedback-banner">
            <CheckCircle2 size={18} />
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="box-screen__grid">
          {/* Columna Izquierda: Panel de control de box, Búsqueda y Boxes en línea */}
          <div className="box-screen__left-column">
            {/* Panel de control de box (Imagen 4) */}
            <div className="box-screen__control-card">
              <div className="box-screen__card-header">
                <Tv size={20} className="box-screen__card-icon" />
                <h2 className="box-screen__card-title">Panel de control de box</h2>
              </div>

              <div className="box-screen__select-wrap">
                <label className="box-screen__select-label">Box asignado</label>
                <select
                  className="box-screen__select-input"
                  value={currentBoxNumber}
                  onChange={(e) => setCurrentBoxNumber(Number(e.target.value))}
                >
                  <option value={1}>Box 1</option>
                  <option value={2}>Box 2</option>
                  <option value={3}>Box 3</option>
                  <option value={4}>Box 4</option>
                </select>
              </div>

              <div className="box-screen__status-buttons">
                <button
                  type="button"
                  className={`box-screen__status-btn box-screen__status-btn--disponible ${
                    activeBoxData.estado === 'Disponible' ? 'box-screen__status-btn--disponible-active' : ''
                  }`}
                  onClick={() => handleStatusChange('Disponible')}
                >
                  Disponible
                </button>
                <button
                  type="button"
                  className={`box-screen__status-btn box-screen__status-btn--atencion ${
                    activeBoxData.estado === 'En atencion' ? 'box-screen__status-btn--atencion-active' : ''
                  }`}
                  onClick={() => handleStatusChange('En atencion')}
                >
                  En atencion
                </button>
                <button
                  type="button"
                  className={`box-screen__status-btn box-screen__status-btn--fuera ${
                    activeBoxData.estado === 'Fuera de servicio' ? 'box-screen__status-btn--fuera-active' : ''
                  }`}
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
            <div className="box-screen__online-card">
              <h3 className="box-screen__online-title">Boxes en linea</h3>
              <ul className="box-screen__online-list">
                {boxes.map((b) => (
                  <li key={b.id} className="box-screen__online-item">
                    <span className="box-screen__online-label">{b.nombre}</span>
                    <span
                      className={`box-screen__online-pill ${
                        b.estado === 'Disponible'
                          ? 'box-screen__online-pill--disponible'
                          : b.estado === 'En atencion'
                          ? 'box-screen__online-pill--atencion'
                          : 'box-screen__online-pill--fuera'
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
          <div className="box-screen__right-column">
            {/* Paciente en atención (Imagen 4) */}
            <div className="box-screen__service-card">
              <div className="box-screen__service-header">
                <div>
                  <h3 className="box-screen__service-title">Paciente en atención</h3>
                  <span className="box-screen__service-code">
                    {currentBoxKey} - {userData?.matricula || 'TEC-3391'}
                  </span>
                </div>

                <div className="box-screen__service-actions">
                  <button
                    className="box-screen__btn-call-next"
                    disabled={isProcessing || Boolean(patientInBox)}
                    onClick={handleCallNext}
                  >
                    <Bell size={18} />
                    Llamar siguiente
                  </button>
                  <button
                    className="box-screen__btn-finish"
                    disabled={isProcessing || !patientInBox}
                    onClick={handleFinishConsultation}
                  >
                    <CheckCircle2 size={18} />
                    Finalizar consulta
                  </button>
                </div>
              </div>

              {patientInBox ? (
                <div className="box-screen__active-details">
                  <div className="box-screen__call-badge">
                    <span className="box-screen__call-label">N° LLAMADO</span>
                    <span className="box-screen__call-number">{patientInBox.num_llamado || patientInBox.num_totem}</span>
                  </div>

                  <div className="box-screen__patient-meta">
                    <div className="box-screen__name-triage">
                      <h4 className="box-screen__patient-name">
                        {patientInBox.paciente_nombre} {patientInBox.paciente_apellido}
                      </h4>
                      <TriageBadge categoryKey={patientInBox.clasificacion_triage} />
                    </div>

                    <div className="box-screen__patient-subdata">
                      <span>DNI: <strong>{patientInBox.paciente_dni}</strong></span>
                      <span>Obra Social: <strong>{patientInBox.paciente_obra_social}</strong></span>
                      <span>Ingreso: <strong>{formatTimeHHMM(patientInBox.fecha_hora_admision)} hs</strong></span>
                    </div>

                    {patientInBox.justificacion_otro && (
                      <div className="box-screen__justification-note">
                        <strong>Justificación clínica:</strong> {patientInBox.justificacion_otro}
                      </div>
                    )}

                    {/* Checklist de Estudios para Toma de Muestra */}
                    <div className="box-screen__checklist-area">
                      <span className="box-screen__checklist-title">Estudios clínicos a realizar (Check de muestra tomada):</span>
                      <div className="box-screen__checks-grid">
                        {(patientInBox.estudios || ['Muestra de Sangre', 'Orina']).map((st) => {
                          const done = completedStudies[st]
                          return (
                            <label
                              key={st}
                              className={`box-screen__check-box ${done ? 'box-screen__check-box--checked' : ''}`}
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
                <div className="box-screen__empty-attention">
                  <p>No hay paciente en atención en este puesto.</p>
                  <span className="box-screen__empty-hint">
                    Presione <strong>"Llamar siguiente"</strong> para convocar al paciente más crítico de la cola multibox.
                  </span>
                </div>
              )}
            </div>

            {/* Cola Multibox Centralizada (Imagen 4) */}
            <div className="box-screen__queue-card">
              <div className="box-screen__queue-header">
                <div className="box-screen__queue-title-wrap">
                  <Radio size={18} className="box-screen__live-icon" />
                  <h3 className="box-screen__queue-title">Cola multibox centralizada</h3>
                </div>
                <span className="box-screen__queue-badge">
                  {waitingQueue.length} paciente(s) en espera
                </span>
              </div>

              {waitingQueue.length === 0 ? (
                <div className="box-screen__queue-empty">
                  <p>La cola de espera se encuentra despejada en este momento.</p>
                </div>
              ) : (
                <div className="box-screen__table-wrapper">
                  <table className="box-screen__table">
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
                          <tr key={ticket.id} className={idx === 0 ? 'box-screen__table-row--top-priority' : ''}>
                            <td>
                              <span className="box-screen__table-call-pill">{ticket.num_llamado || ticket.num_totem}</span>
                            </td>
                            <td>
                              <div className="box-screen__table-patient">
                                <span className="box-screen__table-patient-name">{ticket.paciente_nombre} {ticket.paciente_apellido}</span>
                                <span className="box-screen__table-patient-dni">DNI: {ticket.paciente_dni}</span>
                              </div>
                            </td>
                            <td>
                              <TriageBadge categoryKey={ticket.clasificacion_triage} />
                            </td>
                            <td>
                              <span className="box-screen__table-wait-time">
                                <Clock size={13} />
                                {waitMins || 0} min
                              </span>
                            </td>
                            <td>
                              <span className="box-screen__table-studies">
                                {ticket.estudios?.length || 1} estudio(s)
                              </span>
                            </td>
                            <td>
                              <button
                                className="box-screen__table-call-btn"
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
