import React, { useState } from 'react'
import { X, AlertCircle, Eye, EyeOff } from 'lucide-react'
import ShiftTimeInput from './ShiftTimeInput'
import WeekDaysSelector from './WeekDaysSelector'
import { isValidHalfHourTime } from '../../../utils/shiftTime.utils'
import './AddStaffModal.css'

export default function AddStaffModal({
  isOpen,
  onClose,
  onSubmit,
  currentUserRole
}) {
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffSurname, setNewStaffSurname] = useState('')
  const [newStaffDni, setNewStaffDni] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffPassword, setNewStaffPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newStaffMatricula, setNewStaffMatricula] = useState('')
  const [newStaffRol, setNewStaffRol] = useState('Box')
  const [newStaffShiftStart, setNewStaffShiftStart] = useState('07:00')
  const [newStaffShiftEnd, setNewStaffShiftEnd] = useState('15:00')
  const [newStaffWorkDays, setNewStaffWorkDays] = useState([0, 1, 2, 3, 4])
  const [staffError, setStaffError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const resetForm = () => {
    setNewStaffName('')
    setNewStaffSurname('')
    setNewStaffDni('')
    setNewStaffEmail('')
    setNewStaffPassword('')
    setShowPassword(false)
    setNewStaffMatricula('')
    setNewStaffRol('Box')
    setNewStaffShiftStart('07:00')
    setNewStaffShiftEnd('15:00')
    setNewStaffWorkDays([0, 1, 2, 3, 4])
    setStaffError(null)
  }

  const handleClose = (force = false) => {
    if (isSubmitting && !force) return
    resetForm()
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
    setStaffError(null)

    if (!isValidHalfHourTime(newStaffShiftStart) || !isValidHalfHourTime(newStaffShiftEnd)) {
      setStaffError('Ingresá las horas en formato HH:MM y en intervalos de 30 minutos (por ejemplo, 07:30).')
      return
    }

    if (currentUserRole === 'Jefa' && (newStaffRol === 'Admin' || newStaffRol === 'Jefa')) {
      setStaffError('Restricción RBAC: La Jefa solo puede dar de alta personal de Admisión o Box.')
      return
    }

    if (!newStaffWorkDays || newStaffWorkDays.length === 0) {
      setStaffError('Debes seleccionar al menos un día laboral en la semana para el personal.')
      return
    }

    if (newStaffPassword.trim() && newStaffPassword.trim().length < 8) {
      setStaffError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setIsSubmitting(true)

    try {
      const staffFullName = `${newStaffName} ${newStaffSurname}`.trim()
      await onSubmit({
        nombre: newStaffName,
        apellidos: newStaffSurname,
        dni: newStaffDni,
        email: newStaffEmail,
        password: newStaffPassword.trim() || undefined,
        matricula: newStaffMatricula,
        rol: newStaffRol,
        inicio_turno: newStaffShiftStart,
        fin_turno: newStaffShiftEnd,
        dias_laborales: newStaffWorkDays
      })
      handleClose(true)
      setTimeout(() => {
        window.alert(`¡Personal ${staffFullName || 'nuevo'} creado exitosamente!`)
      }, 50)
    } catch (error) {
      setStaffError(error.message || 'Error al incorporar personal.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="jefa-screen__modal-overlay">
      <div className="jefa-screen__modal-card">
        <button
          type="button"
          className="jefa-screen__modal-close"
          onClick={() => handleClose(false)}
          disabled={isSubmitting}
          aria-label="Cerrar modal"
        >
          <X className="jefa-screen__modal-close-icon" />
        </button>
        <h3 className="jefa-screen__modal-title">Alta de Personal Asistencial</h3>
        <p className="jefa-screen__modal-desc">
          Gestión de personal de Admisión y Box de Atención.
        </p>

        {staffError && (
          <div className="jefa-screen__modal-error">
            <AlertCircle className="jefa-screen__modal-error-icon" />
            <span>{staffError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="jefa-screen__staff-form">
          <div className="jefa-screen__modal-field">
            <label htmlFor="new-staff-name">Nombre:</label>
            <input
              id="new-staff-name"
              type="text"
              required
              placeholder="ej: Roberto"
              value={newStaffName}
              onChange={(event) => setNewStaffName(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label htmlFor="new-staff-surname">Apellido:</label>
            <input
              id="new-staff-surname"
              type="text"
              required
              placeholder="ej: Gomez"
              value={newStaffSurname}
              onChange={(event) => setNewStaffSurname(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label htmlFor="new-staff-dni">DNI:</label>
            <input
              id="new-staff-dni"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              placeholder="ej: 38472910"
              value={newStaffDni}
              onChange={(event) =>
                setNewStaffDni(event.target.value.replace(/\D/g, ''))
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label htmlFor="new-staff-email">Correo Institucional:</label>
            <input
              id="new-staff-email"
              type="email"
              required
              placeholder="rgomez@sgtp.hospital.gob.ar"
              value={newStaffEmail}
              onChange={(event) => setNewStaffEmail(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label htmlFor="new-staff-password">Contraseña de acceso:</label>
            <div className="jefa-screen__password-wrapper">
              <input
                id="new-staff-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="ej: SeguridadHospital2026!"
                value={newStaffPassword}
                onChange={(event) => setNewStaffPassword(event.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="jefa-screen__password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="jefa-screen__field-hint">
              Opcional. Si se deja vacía, se asignará la contraseña institucional predeterminada.
            </span>
          </div>

          <div className="jefa-screen__modal-field">
            <label htmlFor="new-staff-matricula">Matrícula Profesional:</label>
            <input
              id="new-staff-matricula"
              type="text"
              required
              placeholder="ej: TEC-8821"
              value={newStaffMatricula}
              onChange={(event) => setNewStaffMatricula(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label htmlFor="new-staff-role">Rol Asignado:</label>
            <select
              id="new-staff-role"
              value={newStaffRol}
              onChange={(event) => setNewStaffRol(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="Box">Técnico / Box</option>
              <option value="Admision">Admisión</option>
              {currentUserRole === 'Admin' && (
                <>
                  <option value="Secretaria">Secretaría</option>
                  <option value="Jefa">Jefa de Turno</option>
                </>
              )}
            </select>
          </div>

          <WeekDaysSelector
            selectedDays={newStaffWorkDays}
            onChange={setNewStaffWorkDays}
            required
            disabled={isSubmitting}
          />

          <div className="jefa-screen__modal-field jefa-screen__modal-field--shift">
            <ShiftTimeInput
              id="new-staff-shift-start"
              label="Inicio del turno:"
              value={newStaffShiftStart}
              onChange={setNewStaffShiftStart}
              disabled={isSubmitting}
            />
            <ShiftTimeInput
              id="new-staff-shift-end"
              label="Fin del turno:"
              value={newStaffShiftEnd}
              onChange={setNewStaffShiftEnd}
              disabled={isSubmitting}
            />
          </div>

          <div className="jefa-screen__modal-actions">
            <button
              type="submit"
              className="jefa-screen__btn-save"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creando Usuario...' : 'Crear Usuario'}
            </button>
            <button
              type="button"
              className="jefa-screen__btn-cancel"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
