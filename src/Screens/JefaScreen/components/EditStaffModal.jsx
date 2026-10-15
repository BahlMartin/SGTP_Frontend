import React, { useState } from 'react'
import { AlertCircle, X, Eye, EyeOff } from 'lucide-react'
import ShiftTimeInput from './ShiftTimeInput'
import WeekDaysSelector from './WeekDaysSelector'
import { isValidHalfHourTime } from '../../../utils/shiftTime.utils'
import './AddStaffModal.css'

function getInitialForm(staffMember) {
  return {
    nombre: staffMember?.primerNombre || '',
    apellidos: staffMember?.apellidos || '',
    email: staffMember?.email || '',
    password: '',
    matricula: staffMember?.matricula || '',
    inicio_turno: String(staffMember?.inicio_turno || '').slice(0, 5),
    fin_turno: String(staffMember?.fin_turno || '').slice(0, 5),
    dias_laborales: Array.isArray(staffMember?.dias_laborales_detalle)
      ? staffMember.dias_laborales_detalle
      : [0, 1, 2, 3, 4]
  }
}

export default function EditStaffModal({ staffMember, onClose, onSubmit }) {
  const [formData, setFormData] = useState(() => getInitialForm(staffMember))
  const [showPassword, setShowPassword] = useState(false)
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

    if (!formData.dias_laborales || formData.dias_laborales.length === 0) {
      setStaffError('Debes seleccionar al menos un día laboral en la semana para el personal.')
      return
    }

    if (formData.password?.trim() && formData.password.trim().length < 8) {
      setStaffError('La nueva contraseña debe contener al menos 8 caracteres.')
      return
    }

    setIsSaving(true)

    try {
      const updatePayload = {
        nombre: formData.nombre.trim(),
        apellidos: formData.apellidos.trim(),
        email: formData.email.trim().toLowerCase(),
        matricula: formData.matricula.trim(),
        inicio_turno: `${formData.inicio_turno}:00`,
        fin_turno: `${formData.fin_turno}:00`,
        dias_laborales: formData.dias_laborales
      }
      if (formData.password?.trim()) {
        updatePayload.password = formData.password.trim()
      }
      await onSubmit(staffMember.id, updatePayload)
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
          <div className="jefa-screen__modal-field">
            <label htmlFor="edit-staff-password">Nueva Contraseña (Opcional):</label>
            <div className="jefa-screen__password-wrapper">
              <input
                id="edit-staff-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Dejar en blanco para no modificar"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="jefa-screen__password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="jefa-screen__field-hint">
              Completá solo si deseás resetear o actualizar la clave de acceso del personal.
            </span>
          </div>
          <WeekDaysSelector
            selectedDays={formData.dias_laborales}
            onChange={(newDays) => setFormData((previousData) => ({
              ...previousData,
              dias_laborales: newDays
            }))}
            required
          />
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
