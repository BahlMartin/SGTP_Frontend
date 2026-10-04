import React from 'react'
import { Bell, CheckCircle2 } from 'lucide-react'
import TriageBadge from '../../../../components/TriageBadge/TriageBadge'
import { formatTimeHHMM } from '../../../../utils/formatters'
import './PatientInAttentionCard.css'

export default function PatientInAttentionCard({
  patientInBox,
  currentBoxKey,
  matriculaTecnico,
  isProcessing = false,
  completedStudies = {},
  onToggleStudyCheck,
  onCallNext,
  onFinishConsultation
}) {
  const studiesList = patientInBox?.estudios || ['Muestra de Sangre', 'Orina']

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
          <div className="patient-attention-card__call-badge">
            <span className="patient-attention-card__call-label">N° LLAMADO</span>
            <span className="patient-attention-card__call-number">
              {patientInBox.num_llamado || patientInBox.num_totem}
            </span>
          </div>

          <div className="patient-attention-card__meta">
            <div className="patient-attention-card__name-row">
              <h4 className="patient-attention-card__patient-name">
                {patientInBox.paciente_nombre} {patientInBox.paciente_apellido}
              </h4>
              <TriageBadge categoryKey={patientInBox.clasificacion_triage} />
            </div>

            <div className="patient-attention-card__subdata">
              <span>
                DNI: <strong>{patientInBox.paciente_dni}</strong>
              </span>
              <span>
                N° afiliado: <strong>{patientInBox.paciente_numero_afiliado || 'No informado'}</strong>
              </span>
              <span>
                Ingreso: <strong>{formatTimeHHMM(patientInBox.fecha_hora_admision)} hs</strong>
              </span>
            </div>

            {patientInBox.justificacion_otro && (
              <div className="patient-attention-card__justification">
                <strong>Justificación clínica:</strong> {patientInBox.justificacion_otro}
              </div>
            )}

            <div className="patient-attention-card__checklist-container">
              <span className="patient-attention-card__checklist-title">
                Estudios clínicos a realizar (Check de muestra tomada):
              </span>
              <div className="patient-attention-card__checks-grid">
                {studiesList.map((studyName) => {
                  const isDone = Boolean(completedStudies[studyName])
                  return (
                    <label
                      key={studyName}
                      className={`patient-attention-card__checkbox-item ${
                        isDone ? 'patient-attention-card__checkbox-item--checked' : ''
                      }`}
                      onClick={() => onToggleStudyCheck(studyName)}
                    >
                      <input type="checkbox" checked={isDone} readOnly />
                      <span>{studyName}</span>
                    </label>
                  )
                })}
              </div>
            </div>
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
    </div>
  )
}
