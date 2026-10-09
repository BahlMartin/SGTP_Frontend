import React from 'react'
import { UserPlus, Plus, Trash2, Pencil, Unlock, RotateCcw, Clock3 } from 'lucide-react'
import './StaffShiftsCard.css'

export default function StaffShiftsCard({
  staffList = [],
  currentUserRole,
  onOpenAddStaff,
  onToggleShift,
  onDeleteStaff,
  onEditStaff,
  onUnlockStaff,
  onReactivateStaff
}) {
  const visibleStaff = staffList.filter((staffMember) => staffMember.rol !== 'Admin')

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
              <th>Personal / matrícula</th>
              <th>Rol</th>
              <th>Turno</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((staffMember) => {
              const statusLabel = !staffMember.activo
                ? (staffMember.cant_intentos >= 3 ? 'Cuenta bloqueada' : 'Cuenta inactiva')
                : staffMember.dentro_horario === false
                  ? 'Fuera de horario'
                  : 'En horario'
              const statusClass = !staffMember.activo
                ? 'jefa-screen__status-dot--inactive'
                : staffMember.dentro_horario === false
                  ? 'jefa-screen__status-dot--outside'
                  : 'jefa-screen__status-dot--active'
              return (
                <tr key={staffMember.id}>
                <td className="jefa-screen__shift-person">
                  <span className="jefa-screen__shift-name">{staffMember.nombre}</span>
                  <span className="jefa-screen__shift-mat">
                    Matrícula: {staffMember.matricula || 'No informada'}
                  </span>
                </td>
                <td>
                  <span className="jefa-screen__shift-role">{staffMember.rol}</span>
                </td>
                <td className="jefa-screen__shift-turno">{staffMember.turno}</td>
                <td>
                  <span
                    className={`jefa-screen__status-dot ${statusClass}`}
                    role="img"
                    aria-label={statusLabel}
                    title={statusLabel}
                  >
                  </span>
                </td>
                <td className="jefa-screen__shift-actions">
                  {staffMember.rol !== 'Jefa' && staffMember.activo && onToggleShift && (
                    <button
                      className="jefa-screen__btn-toggle-shift jefa-screen__btn-toggle-shift--enable"
                      title="Autorizar horario excepcional por hoy"
                      aria-label={`Habilitar horario excepcional para ${staffMember.nombre}`}
                      onClick={() => onToggleShift(staffMember.id)}
                    >
                      <Clock3 className="jefa-screen__btn-action-icon" />
                      <span>Habilitar</span>
                    </button>
                  )}
                  {staffMember.cant_intentos >= 3 && onUnlockStaff && (
                    <button
                      className="jefa-screen__btn-toggle-shift jefa-screen__btn-toggle-shift--enable"
                      title="Desbloquear cuenta por intentos fallidos"
                      aria-label={`Desbloquear a ${staffMember.nombre}`}
                      onClick={() => onUnlockStaff(staffMember.id)}
                    >
                      <Unlock className="jefa-screen__btn-action-icon" />
                      <span>Desbloquear</span>
                    </button>
                  )}
                  {!staffMember.activo && onReactivateStaff && (
                    <button
                      className="jefa-screen__btn-toggle-shift jefa-screen__btn-toggle-shift--enable"
                      title="Reactivar usuario"
                      aria-label={`Reactivar a ${staffMember.nombre}`}
                      onClick={() => onReactivateStaff(staffMember.id)}
                    >
                      <RotateCcw className="jefa-screen__btn-action-icon" />
                      <span>Reactivar</span>
                    </button>
                  )}
                  {(currentUserRole === 'Admin' ||
                    (currentUserRole === 'Jefa' &&
                      staffMember.rol !== 'Admin' &&
                      staffMember.rol !== 'Jefa')) && (
                    <>
                      {onEditStaff && (
                        <button
                          className="jefa-screen__btn-edit-staff"
                          title="Editar datos y horario"
                          aria-label={`Editar datos de ${staffMember.nombre}`}
                          onClick={() => onEditStaff(staffMember)}
                        >
                          <Pencil className="jefa-screen__btn-delete-icon" />
                        </button>
                      )}
                      {staffMember.activo && onDeleteStaff && (
                        <button
                          className="jefa-screen__btn-delete-staff"
                          title="Eliminar personal"
                          aria-label={`Eliminar a ${staffMember.nombre}`}
                          onClick={() =>
                            onDeleteStaff(staffMember.id, staffMember.nombre, staffMember.rol)
                          }
                        >
                          <Trash2 className="jefa-screen__btn-delete-icon" />
                        </button>
                      )}
                    </>
                  )}
                </td>
                </tr>
              )
            })}
            {visibleStaff.length === 0 && (
              <tr>
                <td className="jefa-screen__empty-row" colSpan={5}>No hay personal registrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
