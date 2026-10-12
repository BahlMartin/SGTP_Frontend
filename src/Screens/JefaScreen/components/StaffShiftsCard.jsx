import React from 'react'
import { UserPlus, Plus, Trash2, Pencil, Unlock, RotateCcw, Clock3 } from 'lucide-react'
import StaffSearchInput from './StaffSearchInput/StaffSearchInput'
import { useStaffSearchFilter } from '../hooks/useStaffSearchFilter'
import { formatDiasLaborales, DIAS_SEMANA_LETRAS } from '../../../utils/shiftValidation.utils'
import './StaffShiftsCard.css'

export default function StaffShiftsCard({
  staffList = [],
  currentUserRole,
  onOpenAddStaff,
  onAuthorizeOvertime,
  onToggleShift,
  onDeleteStaff,
  onEditStaff,
  onUnlockStaff,
  onReactivateStaff
}) {
  const {
    searchTerm,
    setSearchTerm,
    clearSearch,
    filteredStaff,
    isSearching
  } = useStaffSearchFilter(staffList)

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

      <div className="jefa-screen__shifts-search-wrap">
        <StaffSearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          onClear={clearSearch}
          placeholder="Buscar personal por nombre, matrícula o rol..."
        />
      </div>

      <div className="jefa-screen__shifts-table-wrap">
        <table className="jefa-screen__shifts-table">
          <thead>
            <tr>
              <th>Personal / matrícula</th>
              <th>Rol</th>
              <th>Días Habilitados</th>
              <th>Turno Habitual</th>
              <th>Extensión Horaria (Hoy)</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((staffMember) => {
              const statusLabel = !staffMember.activo
                ? (staffMember.cant_intentos >= 3 ? 'Cuenta bloqueada' : 'Cuenta inactiva')
                : staffMember.dentro_horario === false
                  ? 'Fuera de horario'
                  : staffMember.tiene_extension_hoy
                    ? 'En horario (Extensión activa)'
                    : 'En horario'

              const statusClass = !staffMember.activo
                ? 'jefa-screen__status-dot--inactive'
                : staffMember.dentro_horario === false
                  ? 'jefa-screen__status-dot--outside'
                  : 'jefa-screen__status-dot--active'

              const extensionHoy = staffMember.extension_vigente
              const dias = staffMember.dias_laborales_detalle || [0, 1, 2, 3, 4]

              return (
                <tr key={staffMember.id}>
                  {/* Columna 1: Personal */}
                  <td className="jefa-screen__shift-person">
                    <span className="jefa-screen__shift-name">{staffMember.nombre}</span>
                    <span className="jefa-screen__shift-mat">
                      Matrícula: {staffMember.matricula || 'No informada'}
                    </span>
                  </td>

                  {/* Columna 2: Rol */}
                  <td>
                    <span className="jefa-screen__shift-role">{staffMember.rol}</span>
                  </td>

                  {/* Columna 3: Días Habilitados */}
                  <td className="jefa-screen__shift-dias-col">
                    <span className="jefa-screen__shift-dias-text">
                      {formatDiasLaborales(dias)}
                    </span>
                    <div className="jefa-screen__shift-dias-chips" aria-hidden="true">
                      {DIAS_SEMANA_LETRAS.map((letra, idx) => {
                        const activo = dias.includes(idx)
                        return (
                          <span
                            key={idx}
                            className={`jefa-screen__dia-chip ${activo ? 'jefa-screen__dia-chip--active' : ''}`}
                            title={formatDiasLaborales([idx])}
                          >
                            {letra}
                          </span>
                        )
                      })}
                    </div>
                  </td>

                  {/* Columna 4: Turno Habitual */}
                  <td>
                    <span className="jefa-screen__shift-turno">{staffMember.turno}</span>
                  </td>

                  {/* Columna 5: Extensión Horaria Hoy */}
                  <td>
                    {extensionHoy ? (
                      <div className="jefa-screen__extension-badge" title={extensionHoy.motivo}>
                        <Clock3 className="jefa-screen__extension-badge-icon" />
                        <span className="jefa-screen__extension-badge-hours">
                          {extensionHoy.hora_inicio} - {extensionHoy.hora_fin}
                        </span>
                      </div>
                    ) : (
                      <span className="jefa-screen__extension-none">Sin extensión</span>
                    )}
                  </td>

                  {/* Columna 6: Estado */}
                  <td>
                    <span
                      className={`jefa-screen__status-dot ${statusClass}`}
                      role="img"
                      aria-label={statusLabel}
                      title={statusLabel}
                    />
                  </td>

                  {/* Columna 7: Acciones */}
                  <td className="jefa-screen__shift-actions">
                    {staffMember.rol !== 'Jefa' && staffMember.activo && (onAuthorizeOvertime || onToggleShift) && (
                      <button
                        className="jefa-screen__btn-action-icon-only jefa-screen__btn-action-icon-only--enable"
                        title="Autorizar horario excepcional"
                        aria-label={`Autorizar horario excepcional para ${staffMember.nombre}`}
                        onClick={() =>
                          onAuthorizeOvertime
                            ? onAuthorizeOvertime(staffMember)
                            : onToggleShift(staffMember.id)
                        }
                      >
                        <Clock3 className="jefa-screen__btn-action-icon" />
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
            {filteredStaff.length === 0 && (
              <tr>
                <td className="jefa-screen__empty-row" colSpan={7}>
                  {isSearching ? (
                    <span>
                      No se encontró personal que coincida con "{searchTerm}".{' '}
                      <button
                        type="button"
                        className="jefa-screen__empty-clear-btn"
                        onClick={clearSearch}
                      >
                        Limpiar búsqueda
                      </button>
                    </span>
                  ) : (
                    'No hay personal registrado.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
