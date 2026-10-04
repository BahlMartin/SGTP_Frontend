import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import ShiftTimeInput from './ShiftTimeInput'
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
  const [newStaffMatricula, setNewStaffMatricula] = useState('')
  const [newStaffRol, setNewStaffRol] = useState('Box')
  const [newStaffShiftStart, setNewStaffShiftStart] = useState('07:00')
  const [newStaffShiftEnd, setNewStaffShiftEnd] = useState('15:00')
  const [staffError, setStaffError] = useState(null)

  if (!isOpen) return null

  const resetForm = () => {
    setNewStaffName('')
    setNewStaffSurname('')
    setNewStaffDni('')
    setNewStaffEmail('')
    setNewStaffMatricula('')
    setNewStaffRol('Box')
    setNewStaffShiftStart('07:00')
    setNewStaffShiftEnd('15:00')
    setStaffError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStaffError(null)

    if (!isValidHalfHourTime(newStaffShiftStart) || !isValidHalfHourTime(newStaffShiftEnd)) {
      setStaffError('Ingresá las horas en formato HH:MM y en intervalos de 30 minutos (por ejemplo, 07:30).')
      return
    }

    if (currentUserRole === 'Jefa' && (newStaffRol === 'Admin' || newStaffRol === 'Jefa')) {
      setStaffError('Restricción RBAC: La Jefa solo puede dar de alta personal de Admisión o Box.')
      return
    }

    try {
      await onSubmit({
        nombre: newStaffName,
        apellidos: newStaffSurname,
        dni: newStaffDni,
        email: newStaffEmail,
        matricula: newStaffMatricula,
        rol: newStaffRol,
        inicio_turno: newStaffShiftStart,
        fin_turno: newStaffShiftEnd
      })
      handleClose()
    } catch (error) {
      setStaffError(error.message || 'Error al incorporar personal.')
    }
  }

  return (
    <div className="jefa-screen__modal-overlay">
      <div className="jefa-screen__modal-card">
        <button className="jefa-screen__modal-close" onClick={handleClose}>
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
            />
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
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label htmlFor="new-staff-role">Rol Asignado:</label>
            <select
              id="new-staff-role"
              value={newStaffRol}
              onChange={(event) => setNewStaffRol(event.target.value)}
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

          <div className="jefa-screen__modal-field jefa-screen__modal-field--shift">
            <ShiftTimeInput
              id="new-staff-shift-start"
              label="Inicio del turno:"
              value={newStaffShiftStart}
              onChange={setNewStaffShiftStart}
            />
            <ShiftTimeInput
              id="new-staff-shift-end"
              label="Fin del turno:"
              value={newStaffShiftEnd}
              onChange={setNewStaffShiftEnd}
            />
          </div>

          <div className="jefa-screen__modal-actions">
            <button type="submit" className="jefa-screen__btn-save">
              Crear Usuario
            </button>
            <button
              type="button"
              className="jefa-screen__btn-cancel"
              onClick={handleClose}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
