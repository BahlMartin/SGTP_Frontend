import React, { useState } from 'react'
import {
  Bell,
  CheckCircle2,
  Pencil,
  CreditCard,
  ShieldCheck,
  Clock,
  AlertCircle,
  Calendar,
  User,
  Trash2
} from 'lucide-react'
import { getTriageInfo } from '../../../../constants/triage.constants'
import { formatTimeHHMM } from '../../../../utils/formatters'
import ModalModificarEstudios from '../ModalModificarEstudios/ModalModificarEstudios'
import './PatientInAttentionCard.css'

export default function PatientInAttentionCard({
  patientInBox,
  currentBoxKey,
  matriculaTecnico,
  isProcessing = false,
  completedStudies = {},
  onToggleStudyCheck,
  onCallNext,
  onFinishConsultation,
  onModifyStudies
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const studiesList = patientInBox?.estudios || ['Muestra de Sangre', 'Orina']
  const cancelledStudies = patientInBox?.estudios_cancelados || []

  const completedCount = studiesList.filter((s) => completedStudies[s]).length
  const isAllCompleted = studiesList.length > 0 && completedCount === studiesList.length

  const triageInfo = getTriageInfo(patientInBox?.clasificacion_triage)
  const boxDisplay = currentBoxKey ? String(currentBoxKey).replace(/^box\s*/i, '') : '1'

  return (
    <div className="patient-attention-card">
      <div className="patient-attention-card__header">
        <div>
          <h3 className="patient-attention-card__title">Paciente en atención</h3>
          <span className="patient-attention-card__code">
            {currentBoxKey} - {matriculaTecnico}
          </span>
        </div>

        <div className="patient-attention-card__actions">
          <button
            type="button"
            className="patient-attention-card__btn-call"
            disabled={isProcessing || Boolean(patientInBox)}
            onClick={onCallNext}
          >
            <Bell className="patient-attention-card__btn-icon" />
            Llamar siguiente
          </button>
          <button
            type="button"
            className="patient-attention-card__btn-finish"
            disabled={isProcessing || !patientInBox}
            onClick={onFinishConsultation}
          >
            <CheckCircle2 className="patient-attention-card__btn-icon" />
            Finalizar consulta
          </button>
        </div>
      </div>

      {patientInBox ? (
        <div className="patient-attention-card__details">
          {/* Ticket Clínico Asistencial del Paciente */}
          <div className="patient-ticket">
            {/* Cuerpo Izquierdo del Ticket */}
            <div className="patient-ticket__body">
              {/* Barra Superior de Triage */}
              <div className={`patient-ticket__triage-bar patient-ticket__triage-bar--${triageInfo.id || 'guardia'}`}>
                <div className="patient-ticket__triage-left">
                  <span className="patient-ticket__triage-dot" />
                  <span className="patient-ticket__triage-title">
                    {triageInfo.code ? `${triageInfo.code}. ` : ''}{triageInfo.key ? triageInfo.key.toUpperCase() : 'GUARDIA'}
                  </span>
                </div>
                <div className="patient-ticket__triage-right">
                  <span className="patient-ticket__status-dot" />
                  <span className="patient-ticket__status-text">En atención en Box</span>
                </div>
              </div>

              <div className="patient-ticket__content">
                {/* Bloque Nombre Paciente */}
                <div className="patient-ticket__patient-box">
                  <span className="patient-ticket__patient-label">PACIENTE</span>
                  <h4 className="patient-ticket__patient-name">
                    {patientInBox.paciente_nombre} {patientInBox.paciente_apellido}
                  </h4>
                </div>

                {/* Pills de Datos Clínicos */}
                <div className="patient-ticket__data-pill">
                  <CreditCard className="patient-ticket__pill-icon" size={14} />
                  <span className="patient-ticket__pill-label">DNI:</span>
                  <strong className="patient-ticket__pill-value">
                    {patientInBox.paciente_dni || 'Sin DNI'}
                  </strong>
                </div>

                <div className="patient-ticket__data-pill">
                  <ShieldCheck className="patient-ticket__pill-icon" size={14} />
                  <span className="patient-ticket__pill-label">N° Afiliado:</span>
                  <strong className="patient-ticket__pill-value">
                    {patientInBox.paciente_numero_afiliado || '1'}
                  </strong>
                </div>

                <div className="patient-ticket__data-pill">
                  <Clock className="patient-ticket__pill-icon" size={14} />
                  <span className="patient-ticket__pill-label">Admisión:</span>
                  <strong className="patient-ticket__pill-value">
                    {formatTimeHHMM(patientInBox.fecha_hora_admision)} hs
                  </strong>
                </div>

                {/* Fila Inferior: Box y Médico */}
                <div className="patient-ticket__footer-grid">
                  <div className="patient-ticket__footer-card">
                    <div className="patient-ticket__footer-icon-box">
                      <Calendar size={15} />
                    </div>
                    <div className="patient-ticket__footer-text">
                      <span className="patient-ticket__footer-label">BOX</span>
                      <strong className="patient-ticket__footer-value">
                        {boxDisplay}
                      </strong>
                    </div>
                  </div>

                  <div className="patient-ticket__footer-card">
                    <div className="patient-ticket__footer-icon-box">
                      <User size={15} />
                    </div>
                    <div className="patient-ticket__footer-text">
                      <span className="patient-ticket__footer-label">MÉDICO</span>
                      <strong className="patient-ticket__footer-value">
                        {matriculaTecnico || 'MP-1052'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Justificación clínica médica si existe */}
                {patientInBox.justificacion_otro && (
                  <div className="patient-ticket__justification">
                    <AlertCircle size={15} className="patient-ticket__justification-icon" />
                    <div className="patient-ticket__justification-content">
                      <strong className="patient-ticket__justification-title">
                        Justificación clínica:
                      </strong>{' '}
                      <span className="patient-ticket__justification-text">
                        {patientInBox.justificacion_otro}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stub Lateral Derecho del Turno (Troquelado Azul) */}
            <div className="patient-ticket__stub">
              {/* Notches troquelados */}
              <span className="patient-ticket__notch patient-ticket__notch--top" />
              <span className="patient-ticket__notch patient-ticket__notch--bottom" />

              <div className="patient-ticket__stub-content">
                <span className="patient-ticket__stub-label">TURNO</span>
                <span className="patient-ticket__stub-number">
                  {patientInBox.num_llamado || patientInBox.num_totem}
                </span>
              </div>
            </div>
          </div>

          {/* Div al costado: Panel de Estudios tipo lista con scroll táctil */}
          <div className="patient-attention-card__studies-panel">
            <div className="patient-attention-card__studies-header">
              <div className="patient-attention-card__studies-title-box">
                <span className="patient-attention-card__studies-title">
                  Estudios a realizar
                </span>
                <span
                  className={`patient-attention-card__progress-badge ${
                    isAllCompleted ? 'patient-attention-card__progress-badge--done' : ''
                  }`}
                >
                  {completedCount}/{studiesList.length} tomadas
                </span>
              </div>

              <div className="patient-attention-card__modify-wrapper">
                <button
                  type="button"
                  className="patient-attention-card__btn-modify-studies"
                  onClick={() => setIsModalOpen(true)}
                  disabled={isProcessing}
                  title="Modificar estudios"
                  aria-label="Modificar estudios"
                >
                  <Pencil size={15} />
                </button>
                <span className="patient-attention-card__modify-tooltip">Modificar estudios</span>
              </div>
            </div>

            <div className="patient-attention-card__studies-list">
              {studiesList.map((studyName) => {
                const isDone = Boolean(completedStudies[studyName])
                const rawMatch = patientInBox.estudios_raw?.find(
                  (e) => (e?.estudio_detalle?.nombre || e?.nombre) === studyName
                )
                const isFromBox = rawMatch?.origen === 'box'

                return (
                  <div
                    key={studyName}
                    className={`patient-attention-card__study-item ${
                      isDone ? 'patient-attention-card__study-item--done' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="patient-attention-card__study-toggle-btn"
                      onClick={() => onToggleStudyCheck(studyName)}
                      title={isDone ? 'Muestra tomada. Clic para destildar' : 'Pendiente. Clic para marcar tomada'}
                    >
                      <div className="patient-attention-card__study-info">
                        <span className="patient-attention-card__study-name">{studyName}</span>
                        {isFromBox && (
                          <span className="patient-attention-card__tag-box" title="Agregado en box">
                            + Box
                          </span>
                        )}
                      </div>

                      <span className="patient-attention-card__status-pill">
                        {isDone ? 'Tomada' : 'Pendiente'}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="patient-attention-card__study-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsModalOpen(true)
                      }}
                      disabled={isProcessing}
                      title={`Eliminar o cancelar ${studyName} de la orden`}
                      aria-label={`Eliminar estudio ${studyName}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Si hay estudios cancelados en la atención */}
            {cancelledStudies.length > 0 && (
              <div className="patient-attention-card__cancelled-box">
                <span className="patient-attention-card__cancelled-title">
                  Cancelados en Box ({cancelledStudies.length}):
                </span>
                <div className="patient-attention-card__cancelled-list">
                  {cancelledStudies.map((cs) => {
                    const nombre = cs.estudio_detalle?.nombre || cs.nombre || 'Estudio'
                    const motivo = cs.motivo_modificacion ? ` (${cs.motivo_modificacion})` : ''
                    return (
                      <span
                        key={cs.id || nombre}
                        className="patient-attention-card__cancelled-tag"
                        title={`Cancelado: ${motivo}`}
                      >
                        {nombre}{motivo}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="patient-attention-card__empty-state">
          <p className="patient-attention-card__empty-title">
            No hay paciente en atención en este puesto.
          </p>
          <span className="patient-attention-card__empty-hint">
            Presione <strong>"Llamar siguiente"</strong> para convocar al paciente más crítico de la
            cola multibox.
          </span>
        </div>
      )}

      {/* Modal de modificación de estudios */}
      <ModalModificarEstudios
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientInBox={patientInBox}
        onSave={onModifyStudies}
        isProcessing={isProcessing}
      />
    </div>
  )
}
