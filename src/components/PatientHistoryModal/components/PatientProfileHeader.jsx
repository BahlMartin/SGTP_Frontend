import React from 'react'
import './PatientProfileHeader.css'

export default function PatientProfileHeader({ patientData, totalVisits = 0 }) {
  if (!patientData) return null

  return (
    <div className="patient-history-modal__patient">
      <h3>{patientData.nombre} {patientData.apellidos || patientData.apellido}</h3>
      <dl>
        <div>
          <dt>DNI</dt>
          <dd>{patientData.dni || 'No informado'}</dd>
        </div>
        <div>
          <dt>Número de afiliado</dt>
          <dd>{patientData.num_obra_social || patientData.numeroAfiliado || 'No informado'}</dd>
        </div>
        <div>
          <dt>Obra Social</dt>
          <dd>{patientData.obra_social || patientData.obraSocial || 'Particular'}</dd>
        </div>
        <div>
          <dt>Total atenciones</dt>
          <dd>{totalVisits}</dd>
        </div>
      </dl>
    </div>
  )
}
