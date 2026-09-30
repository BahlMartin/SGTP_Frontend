import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import './AddStaffModal.css'

export default function AddStaffModal({
  isOpen,
  onClose,
  onSubmit,
  currentUserRole
}) {
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffMatricula, setNewStaffMatricula] = useState('')
  const [newStaffRol, setNewStaffRol] = useState('Box')
  const [newStaffTurno, setNewStaffTurno] = useState('')
  const [staffError, setStaffError] = useState(null)

  if (!isOpen) return null

  const resetForm = () => {
    setNewStaffName('')
    setNewStaffEmail('')
    setNewStaffMatricula('')
    setNewStaffRol('Box')
    setNewStaffTurno('')
    setStaffError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStaffError(null)

    if (currentUserRole === 'Jefa' && (newStaffRol === 'Admin' || newStaffRol === 'Jefa')) {
      setStaffError('Restricción RBAC: La Jefa solo puede dar de alta personal de Admisión o Box.')
      return
    }

    try {
      await onSubmit({
        nombre: newStaffName,
        email: newStaffEmail,
        matricula: newStaffMatricula,
        rol: newStaffRol,
        turno: newStaffTurno
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
            <label>Nombre y Apellido:</label>
            <input
              type="text"
              required
              placeholder="ej: Lic. Roberto Gomez"
              value={newStaffName}
              onChange={(event) => setNewStaffName(event.target.value)}
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label>Correo Institucional:</label>
            <input
              type="email"
              required
              placeholder="rgomez@sgtp.hospital.gob.ar"
              value={newStaffEmail}
              onChange={(event) => setNewStaffEmail(event.target.value)}
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label>Matrícula Profesional:</label>
            <input
              type="text"
              required
              placeholder="ej: TEC-8821"
              value={newStaffMatricula}
              onChange={(event) => setNewStaffMatricula(event.target.value)}
            />
          </div>

          <div className="jefa-screen__modal-field">
            <label>Rol Asignado:</label>
            <select
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

          <div className="jefa-screen__modal-field">
            <label>Turno Laboral:</label>
            <input
              type="text"
              required
              placeholder="ej: Mañana (07:00 - 15:00)"
              value={newStaffTurno}
              onChange={(event) => setNewStaffTurno(event.target.value)}
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
