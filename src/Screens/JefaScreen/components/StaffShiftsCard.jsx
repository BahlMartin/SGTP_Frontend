import React from 'react'
import { UserPlus, Plus, Trash2 } from 'lucide-react'
import './StaffShiftsCard.css'

export default function StaffShiftsCard({
  staffList = [],
  currentUserRole,
  onOpenAddStaff,
  onToggleShift,
  onDeleteStaff,
  onUnlockStaff,
  onReactivateStaff
}) {
  return (
    <div className="jefa-screen__shifts-card">
      <div className="jefa-screen__shifts-header">
        <div className="jefa-screen__shifts-title-wrap">
          <UserPlus className="jefa-screen__shifts-icon" />
          <h3 className="jefa-screen__shifts-title">Personal y asignacion de turnos</h3>
        </div>
        <button className="jefa-screen__btn-add-staff" onClick={onOpenAddStaff}>
          <Plus className="jefa-screen__btn-add-icon" />
          Nuevo Personal
        </button>
      </div>

      <div className="jefa-screen__shifts-table-wrap">
        <table className="jefa-screen__shifts-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Matricula</th>
              <th>Rol</th>
              <th>Turno</th>
              <th>Estado</th>
              <th>Habilitación Horaria</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((staffMember) => (
              <tr key={staffMember.id}>
                <td className="jefa-screen__shift-name">{staffMember.nombre}</td>
                <td className="jefa-screen__shift-mat">{staffMember.matricula}</td>
                <td>
                  <span className="jefa-screen__shift-role">{staffMember.rol}</span>
                </td>
                <td className="jefa-screen__shift-turno">{staffMember.turno}</td>
                <td>
                  <span
                    className={`jefa-screen__status-chip ${
                      staffMember.estado === 'En turno'
                        ? 'jefa-screen__status-chip--active'
                        : 'jefa-screen__status-chip--offline'
                    }`}
                  >
                    {staffMember.estado}
                  </span>
                </td>
                <td>
                  {staffMember.rol !== 'Admin' && staffMember.rol !== 'Jefa' ? (
                    <button
                      className={`jefa-screen__btn-toggle-shift ${
                        staffMember.estado === 'En turno'
                          ? 'jefa-screen__btn-toggle-shift--disable'
                          : 'jefa-screen__btn-toggle-shift--enable'
                      }`}
                      onClick={() => onToggleShift(staffMember.id, staffMember.estado)}
                    >
                      {staffMember.estado === 'En turno' ? 'Restringir' : 'Habilitar'}
                    </button>
                  ) : (
                    <span className="jefa-screen__permanent-badge">Acceso 24hs</span>
                  )}
                </td>
                <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {staffMember.cant_intentos >= 3 && onUnlockStaff && (
                    <button
                      className="jefa-screen__btn-toggle-shift jefa-screen__btn-toggle-shift--enable"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      title="Desbloquear cuenta por intentos fallidos"
                      onClick={() => onUnlockStaff(staffMember.id)}
                    >
                      Desbloquear
                    </button>
                  )}
                  {!staffMember.activo && onReactivateStaff && (
                    <button
                      className="jefa-screen__btn-toggle-shift jefa-screen__btn-toggle-shift--enable"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      title="Reactivar usuario"
                      onClick={() => onReactivateStaff(staffMember.id)}
                    >
                      Reactivar
                    </button>
                  )}
                  {(currentUserRole === 'Admin' || currentUserRole === 'Jefa') && staffMember.activo && (
                    <button
                      className="jefa-screen__btn-delete-staff"
                      title="Eliminar personal"
                      onClick={() =>
                        onDeleteStaff(staffMember.id, staffMember.nombre, staffMember.rol)
                      }
                    >
                      <Trash2 className="jefa-screen__btn-delete-icon" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
