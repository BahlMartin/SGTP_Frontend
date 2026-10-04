import React, { useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import ShiftTimeInput from './ShiftTimeInput'
import { isValidHalfHourTime } from '../../../utils/shiftTime.utils'
import './AddStaffModal.css'

function getInitialForm(staffMember) {
  return {
    nombre: staffMember?.primerNombre || '',
    apellidos: staffMember?.apellidos || '',
    email: staffMember?.email || '',
    matricula: staffMember?.matricula || '',
    inicio_turno: String(staffMember?.inicio_turno || '').slice(0, 5),
    fin_turno: String(staffMember?.fin_turno || '').slice(0, 5)
  }
}

export default function EditStaffModal({ staffMember, onClose, onSubmit }) {
  const [formData, setFormData] = useState(() => getInitialForm(staffMember))
  const [staffError, setStaffError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!staffMember) return null

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((previousData) => ({ ...previousData, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStaffError('')

    if (!isValidHalfHourTime(formData.inicio_turno) || !isValidHalfHourTime(formData.fin_turno)) {
      setStaffError('Ingresá las horas en formato HH:MM y en intervalos de 30 minutos (por ejemplo, 07:30).')
      return
    }

    setIsSaving(true)

    try {
      await onSubmit(staffMember.id, {
        nombre: formData.nombre.trim(),
        apellidos: formData.apellidos.trim(),
        email: formData.email.trim().toLowerCase(),
        matricula: formData.matricula.trim(),
        inicio_turno: `${formData.inicio_turno}:00`,
        fin_turno: `${formData.fin_turno}:00`
      })
    } catch (error) {
      setStaffError(error.message || 'Error al actualizar los datos del personal.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="jefa-screen__modal-overlay">
      <div
        className="jefa-screen__modal-card jefa-screen__modal-card--edit"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-staff-title"
      >
        <button
          type="button"
          className="jefa-screen__modal-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X className="jefa-screen__modal-close-icon" />
        </button>
        <h3 id="edit-staff-title" className="jefa-screen__modal-title">Editar personal</h3>
        <p className="jefa-screen__modal-desc">
          Actualizá los datos y el horario de {staffMember.nombre}.
        </p>

        {staffError && (
          <div className="jefa-screen__modal-error" role="alert">
            <AlertCircle className="jefa-screen__modal-error-icon" />
            <span>{staffError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="jefa-screen__staff-form">
          <div className="jefa-screen__modal-field">
            <label htmlFor="edit-staff-nombre">Nombre:</label>
            <input
              id="edit-staff-nombre"
              name="nombre"
              type="text"
              required
              value={formData.nombre}
              onChange={handleChange}
            />
          </div>
          <div className="jefa-screen__modal-field">
            <label htmlFor="edit-staff-apellidos">Apellido:</label>
            <input
              id="edit-staff-apellidos"
              name="apellidos"
              type="text"
              required
              value={formData.apellidos}
              onChange={handleChange}
            />
          </div>
          <div className="jefa-screen__modal-field">
            <label htmlFor="edit-staff-email">Correo institucional:</label>
            <input
              id="edit-staff-email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div className="jefa-screen__modal-field">
            <label htmlFor="edit-staff-matricula">Matrícula profesional:</label>
            <input
              id="edit-staff-matricula"
              name="matricula"
              type="text"
              required
              value={formData.matricula}
              onChange={handleChange}
            />
          </div>
          <div className="jefa-screen__modal-field jefa-screen__modal-field--shift">
            <ShiftTimeInput
              id="edit-staff-inicio"
              label="Inicio del turno:"
              value={formData.inicio_turno}
              onChange={(value) => setFormData((previousData) => ({
                ...previousData,
                inicio_turno: value
              }))}
            />
            <ShiftTimeInput
              id="edit-staff-fin"
              label="Fin del turno:"
              value={formData.fin_turno}
              onChange={(value) => setFormData((previousData) => ({
                ...previousData,
                fin_turno: value
              }))}
            />
          </div>

          <div className="jefa-screen__modal-actions">
            <button type="submit" className="jefa-screen__btn-save" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button type="button" className="jefa-screen__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
