import React from 'react'
import { Pencil } from 'lucide-react'
import './PatientProfileHeader.css'

export default function PatientProfileHeader({
  patientData,
  totalVisits = 0,
  canEdit = false,
  onEdit
}) {
  if (!patientData) return null

  const getInitials = (nombre = '', apellidos = '') => {
    const full = `${nombre} ${apellidos}`.trim()
    const parts = full.split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return (parts[0]?.[0] || 'PA').toUpperCase()
  }

  const patientName = `${patientData.nombre || ''} ${patientData.apellidos || patientData.apellido || ''}`.trim() || 'Paciente'
  const dni = patientData.dni ? `DNI: ${patientData.dni}` : 'DNI no informado'
  const obraSocial = patientData.obra_social || patientData.obraSocial || 'Particular'
  const numAfiliado = patientData.num_obra_social || patientData.numeroAfiliado

  return (
    <div className="patient-history-modal__patient">
      <div className="patient-history-modal__patient-left">
        <div className="patient-history-modal__patient-avatar">
          {getInitials(patientData.nombre, patientData.apellidos || patientData.apellido)}
        </div>
        <div className="patient-history-modal__patient-details">
          <div className="patient-history-modal__patient-name-wrap">
            <span className="patient-history-modal__patient-name">{patientName}</span>
            <span className="patient-history-modal__patient-badge">
              {obraSocial}
            </span>
          </div>
          <div className="patient-history-modal__patient-meta">
            <span>{dni}</span>
            {numAfiliado && <span>· Afiliado: {numAfiliado}</span>}
          </div>
        </div>
      </div>

      <div className="patient-history-modal__patient-actions-group">
        {canEdit && onEdit && (
          <button
            type="button"
            className="patient-history-modal__patient-edit-btn"
            onClick={onEdit}
            title="Editar datos del paciente"
            aria-label="Editar datos del paciente"
          >
            <Pencil size={17} />
          </button>
        )}
        <div className="patient-history-modal__patient-kpi">
          <span className="patient-history-modal__patient-kpi-num">{totalVisits}</span>
          <span className="patient-history-modal__patient-kpi-lbl">Total Atenciones</span>
        </div>
      </div>
    </div>
  )
}
