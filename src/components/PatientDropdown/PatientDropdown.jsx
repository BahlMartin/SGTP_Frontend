import React from 'react'
import { UserCheck } from 'lucide-react'
import './PatientDropdown.css'

/**
 * Componente reutilizable para desplegar listas predictivas de búsqueda de pacientes.
 * Usado tanto en el buscador general (PatientSearch) como en el formulario de admisión (AdmissionForm).
 */
export default function PatientDropdown({
  isOpen = true,
  isSearching = false,
  error = '',
  results = [],
  emptyMessage = 'No se encontraron registros previos.',
  onSelectPatient = () => {},
  className = ''
}) {
  if (!isOpen) return null

  return (
    <div className={`patient-dropdown ${className}`}>
      {isSearching ? (
        <div className="patient-dropdown__status">Buscando paciente...</div>
      ) : error ? (
        <div className="patient-dropdown__status patient-dropdown__status--error" role="alert">
          {error}
        </div>
      ) : results.length === 0 ? (
        <div className="patient-dropdown__status">{emptyMessage}</div>
      ) : (
        <ul className="patient-dropdown__list">
          {results.map((patient) => {
            const affiliateNumber =
              patient.num_obra_social || patient.numeroAfiliado || 'No informado'
            const healthInsurance =
              patient.obra_social || patient.obraSocial || 'Particular'
            const fullName = `${patient.nombre || ''} ${
              patient.apellido || patient.apellidos || ''
            }`.trim()

            return (
              <li
                key={patient.dni || patient.id_paciente}
                className="patient-dropdown__item"
                onClick={() => onSelectPatient(patient)}
              >
                <div className="patient-dropdown__avatar">
                  <UserCheck className="patient-dropdown__avatar-icon" />
                </div>
                <div className="patient-dropdown__info">
                  <span className="patient-dropdown__name">{fullName}</span>
                  <span className="patient-dropdown__details">
                    DNI: <strong>{patient.dni}</strong> | {healthInsurance} - N° afiliado:{' '}
                    <strong>{affiliateNumber}</strong>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
