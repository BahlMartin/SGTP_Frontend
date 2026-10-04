import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { formatDateDDMMAAAA, formatTimeHHMM } from '../../utils/formatters'
import './PatientHistoryModal.css'

export default function PatientHistoryModal({
  patient,
  history,
  isLoading = false,
  error = '',
  onUsePatient,
  onClose
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!patient) return null

  const patientData = history?.paciente || patient
  const visits = history?.atenciones || []

  return (
    <div
      className="patient-history-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-history-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <section className="patient-history-modal__card">
        <button
          type="button"
          className="patient-history-modal__close"
          onClick={onClose}
          aria-label="Cerrar historial"
        >
          <X size={20} />
        </button>

        <h2 id="patient-history-title" className="patient-history-modal__title">
          Historial del paciente
        </h2>

        <div className="patient-history-modal__patient">
          <h3>{patientData.nombre} {patientData.apellidos || patientData.apellido}</h3>
          <dl>
            <div><dt>DNI</dt><dd>{patientData.dni || 'No informado'}</dd></div>
            <div><dt>Número de afiliado</dt><dd>{patientData.num_obra_social || patientData.numeroAfiliado || 'No informado'}</dd></div>
            <div><dt>Alta en sistema</dt><dd>{patientData.fecha_creacion ? formatDateDDMMAAAA(patientData.fecha_creacion) : 'No informado'}</dd></div>
          </dl>
        </div>

        <div className="patient-history-modal__visits">
          <h3>Atenciones, estudios y box</h3>
          {isLoading ? (
            <p className="patient-history-modal__status" role="status">Cargando historial...</p>
          ) : error ? (
            <p className="patient-history-modal__status patient-history-modal__status--error" role="alert">{error}</p>
          ) : visits.length === 0 ? (
            <p className="patient-history-modal__status">No hay atenciones registradas para este paciente.</p>
          ) : (
            <ul className="patient-history-modal__visit-list">
              {visits.map((visit) => (
                <li key={visit.id_ticket}>
                  <div className="patient-history-modal__visit-header">
                    <strong>{formatDateDDMMAAAA(visit.fecha_hora_admision)} · {formatTimeHHMM(visit.fecha_hora_admision)}</strong>
                    <span>{visit.box_numero ? `Box ${visit.box_numero}` : 'Box no informado'}</span>
                  </div>
                  <p>Ticket: {visit.num_totem} · Estado: {visit.estado}</p>
                  <p>Estudios: {
                    visit.estudios?.length
                      ? visit.estudios.map((study) => study.estudio_detalle?.nombre || study.nombre).filter(Boolean).join(', ')
                      : 'Sin estudios registrados'
                  }</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="patient-history-modal__actions">
          <button
            type="button"
            className="patient-history-modal__use"
            onClick={() => onUsePatient?.(patientData)}
            disabled={isLoading}
          >
            Seleccionar paciente
          </button>
          <button type="button" className="patient-history-modal__cancel" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </section>
    </div>
  )
}
