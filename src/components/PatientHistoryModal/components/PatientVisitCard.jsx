import React from 'react'
import { Clock, Receipt, Loader2 } from 'lucide-react'
import { formatDateDDMMAAAA, formatTimeHHMM } from '../../../utils/formatters'
import './PatientVisitCard.css'

export default function PatientVisitCard({ visit, onViewTicket, isFetching = false }) {
  if (!visit) return null

  const visitId = visit.id_ticket || visit.id
  const fecha = visit.fecha_hora_atencion || visit.fecha_hora_admision

  const getStudyNames = (studies = []) => studies
    .map((study) => {
      if (typeof study === 'string') return study
      return study?.estudio_detalle?.nombre || study?.estudio?.nombre || study?.nombre || ''
    })
    .filter(Boolean)

  const studyNames = getStudyNames(visit.estudios)
  const studiesText = studyNames.length > 0 ? studyNames.join(', ') : 'Rutina estándar'

  const boxDisplay = visit.box_numero || (visit.box_actual ? visit.box_actual.numero || visit.box_actual : null)
    ? `Box ${visit.box_numero || (visit.box_actual?.numero || visit.box_actual)}`
    : (visit.box_asignado || 'Sin box asignado')

  const formatProWithMatricula = (nombre, matricula) => {
    const n = nombre?.trim()
    const m = matricula?.trim()
    if (n && m) return `${n} (Mat. ${m})`
    if (n) return n
    if (m) return `Mat. ${m}`
    return 'No registrado'
  }

  const admisionDisplay = formatProWithMatricula(
    visit.personal_admision_nombre,
    visit.personal_admision_matricula || visit.mat_admision
  )

  const boxProDisplay = formatProWithMatricula(
    visit.personal_box_nombre,
    visit.personal_box_matricula
  )

  const stateClass = (visit.estado || 'default').toLowerCase().replace(/\s+/g, '-')

  return (
    <li className="patient-history-modal__visit-item">
      <div className="patient-history-modal__visit-card">
        <div className="patient-history-modal__visit-card-header">
          <div className="patient-history-modal__visit-time">
            <Clock size={15} />
            <span>
              {fecha
                ? `${formatDateDDMMAAAA(fecha)} · ${formatTimeHHMM(fecha)}`
                : 'Fecha no informada'}
            </span>
          </div>

          <div className="patient-history-modal__visit-tags">
            <span className="patient-history-modal__badge-totem">
              {visit.num_totem || 'Ticket'}
            </span>
            <span className={`patient-history-modal__badge-state patient-history-modal__badge-state--${stateClass}`}>
              {visit.estado || 'Atendido'}
            </span>
            <span className="patient-history-modal__badge-box">
              {boxDisplay}
            </span>
          </div>
        </div>

        <div className="patient-history-modal__visit-card-body">
          <div className="patient-history-modal__pro-grid">
            <div className="patient-history-modal__pro-col">
              <span className="patient-history-modal__pro-caption">Admisión:</span>
              <span className="patient-history-modal__pro-val">{admisionDisplay}</span>
            </div>

            <div className="patient-history-modal__pro-col">
              <span className="patient-history-modal__pro-caption">Técnico / Box:</span>
              <span className="patient-history-modal__pro-val">{boxProDisplay}</span>
            </div>
          </div>

          <div className="patient-history-modal__studies-row">
            <span className="patient-history-modal__studies-caption">Estudios:</span>
            <span className="patient-history-modal__studies-val">{studiesText}</span>
          </div>
        </div>

        <div className="patient-history-modal__visit-card-footer">
          <button
            type="button"
            className="patient-history-modal__view-ticket-btn"
            onClick={() => onViewTicket(visitId)}
            disabled={isFetching}
            aria-label={`Ver comprobante del ticket ${visit.num_totem || ''}`}
          >
            {isFetching ? (
              <>
                <Loader2 size={16} className="patient-history-modal__spinner" />
                <span>Consultando ticket...</span>
              </>
            ) : (
              <>
                <Receipt size={16} />
                <span>Ver Comprobante de Atención</span>
              </>
            )}
          </button>
        </div>
      </div>
    </li>
  )
}
