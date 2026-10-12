import React, { useState, useMemo } from 'react'
import { ShieldCheck, ShieldAlert, Lock, Unlock, Search, AlertCircle, CheckCircle2 } from 'lucide-react'
import './StaffSecurityCard.css'

export default function StaffSecurityCard({
  staffList = [],
  _currentUserRole = '',
  currentUserId = null,
  onUnlockStaff,
  onLockStaff
}) {
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrar fuera cuentas Admin para la vista de Jefa
  const visibleStaff = useMemo(() => {
    return staffList.filter((staffMember) => staffMember.rol !== 'Admin')
  }, [staffList])

  // Filtrado reactivo por nombre, matrícula o rol
  const filteredStaff = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return visibleStaff
    return visibleStaff.filter((member) => {
      const matchName = String(member.nombre || '').toLowerCase().includes(term)
      const matchMatricula = String(member.matricula || '').toLowerCase().includes(term)
      const matchRol = String(member.rol || '').toLowerCase().includes(term)
      return matchName || matchMatricula || matchRol
    })
  }, [visibleStaff, searchTerm])

  const totalCuentas = visibleStaff.length
  const cuentasBloqueadas = visibleStaff.filter((s) => !s.activo || (s.cant_intentos || 0) >= 3).length
  const cuentasActivas = totalCuentas - cuentasBloqueadas

  const handleToggleLock = (staffMember) => {
    const isLocked = !staffMember.activo || (staffMember.cant_intentos || 0) >= 3

    if (isLocked) {
      if (onUnlockStaff) {
        onUnlockStaff(staffMember.id)
      }
    } else {
      const confirmacion = window.confirm(
        `¿Confirmas el bloqueo de seguridad para la cuenta de "${staffMember.nombre}"?\nEl colaborador no podrá iniciar sesión hasta que sea desbloqueado.`
      )
      if (confirmacion && onLockStaff) {
        onLockStaff(staffMember.id)
      }
    }
  }

  return (
    <div className="jefa-screen__security-card">
      <div className="jefa-screen__security-header">
        <div className="jefa-screen__security-title-wrap">
          <ShieldCheck className="jefa-screen__security-icon" />
          <div>
            <h3 className="jefa-screen__security-title">Control de Acceso y Seguridad de Cuentas</h3>
            <p className="jefa-screen__security-subtitle">
              Auditoría de credenciales, control de intentos fallidos y bloqueo asistencial
            </p>
          </div>
        </div>

        <div className="jefa-screen__security-stats">
          <span className="jefa-screen__stat-chip jefa-screen__stat-chip--active" title="Cuentas habilitadas">
            <CheckCircle2 className="jefa-screen__stat-icon" />
            {cuentasActivas} Activas
          </span>
          <span className="jefa-screen__stat-chip jefa-screen__stat-chip--locked" title="Cuentas bloqueadas">
            <ShieldAlert className="jefa-screen__stat-icon" />
            {cuentasBloqueadas} Bloqueadas
          </span>
        </div>
      </div>

      <div className="jefa-screen__security-search-wrap">
        <Search className="jefa-screen__security-search-icon" />
        <input
          type="text"
          className="jefa-screen__security-search-input"
          placeholder="Buscar personal por nombre, matrícula o rol..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            className="jefa-screen__security-search-clear"
            onClick={() => setSearchTerm('')}
            title="Limpiar búsqueda"
          >
            ×
          </button>
        )}
      </div>

      <div className="jefa-screen__security-table-wrap">
        <table className="jefa-screen__security-table">
          <thead>
            <tr>
              <th>Personal / Matrícula</th>
              <th>Rol</th>
              <th>Intentos hasta Bloqueo</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((staffMember) => {
              const intentosFallidos = Number(staffMember.cant_intentos || 0)
              const maxIntentos = 3
              const intentosRestantes = Math.max(0, maxIntentos - intentosFallidos)
              const isLocked = !staffMember.activo || intentosFallidos >= maxIntentos

              // Determinar etiquetas y estilos de estado
              let statusLabel = 'Habilitada'
              let statusClass = 'jefa-screen__security-status--active'
              let dotClass = 'jefa-screen__status-dot--active'

              if (isLocked) {
                statusLabel = intentosFallidos >= maxIntentos ? 'Bloqueada por intentos' : 'Bloqueada administrativamente'
                statusClass = 'jefa-screen__security-status--locked'
                dotClass = 'jefa-screen__status-dot--inactive'
              } else if (intentosRestantes === 1) {
                statusLabel = 'Riesgo de bloqueo'
                statusClass = 'jefa-screen__security-status--warning'
                dotClass = 'jefa-screen__status-dot--outside'
              }

              // Restricción jerárquica: no bloquear al Admin ni al usuario en sesión
              const isSelf = currentUserId && (staffMember.id === currentUserId || staffMember.id_personal === currentUserId)
              const isProtectedRole = staffMember.rol === 'Admin'
              const canToggle = !isSelf && !isProtectedRole

              return (
                <tr key={staffMember.id} className={isLocked ? 'jefa-screen__security-row--locked' : ''}>
                  {/* Columna 1: Personal / Matrícula */}
                  <td className="jefa-screen__security-person">
                    <span className="jefa-screen__security-name">{staffMember.nombre}</span>
                    <span className="jefa-screen__security-mat">
                      Matrícula: {staffMember.matricula || 'No informada'}
                    </span>
                  </td>

                  {/* Columna 2: Rol */}
                  <td>
                    <span className={`jefa-screen__security-role jefa-screen__security-role--${staffMember.rol?.toLowerCase()}`}>
                      {staffMember.rol}
                    </span>
                  </td>

                  {/* Columna 3: Intentos hasta Bloqueo */}
                  <td className="jefa-screen__security-attempts-col">
                    <div className="jefa-screen__security-attempts-wrap">
                      <div className="jefa-screen__attempts-bar" title={`${intentosFallidos} de ${maxIntentos} intentos utilizados`}>
                        {[...Array(maxIntentos)].map((_, idx) => {
                          const used = idx < intentosFallidos
                          return (
                            <span
                              key={idx}
                              className={`jefa-screen__attempt-slot ${
                                used
                                  ? isLocked
                                    ? 'jefa-screen__attempt-slot--danger'
                                    : 'jefa-screen__attempt-slot--used'
                                  : 'jefa-screen__attempt-slot--free'
                              }`}
                            />
                          )
                        })}
                      </div>
                      <span className={`jefa-screen__attempts-text ${
                        isLocked
                          ? 'jefa-screen__attempts-text--danger'
                          : intentosRestantes === 1
                            ? 'jefa-screen__attempts-text--warning'
                            : ''
                      }`}>
                        {isLocked ? (
                          '0 restantes (Límite alcanzado)'
                        ) : (
                          `${intentosRestantes} ${intentosRestantes === 1 ? 'restante' : 'restantes'} (${intentosFallidos}/${maxIntentos})`
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Columna 4: Flag de Estado */}
                  <td>
                    <div className="jefa-screen__security-status-badge-wrap">
                      <span
                        className={`jefa-screen__status-dot ${dotClass}`}
                        role="img"
                        aria-label={statusLabel}
                      />
                      <span className={`jefa-screen__security-status-badge ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </td>

                  {/* Columna 5: Botón Bloquear / Desbloquear */}
                  <td className="jefa-screen__security-actions">
                    {canToggle ? (
                      isLocked ? (
                        <button
                          className="jefa-screen__btn-sec-action jefa-screen__btn-sec-action--unlock"
                          title="Desbloquear acceso para este colaborador"
                          aria-label={`Desbloquear a ${staffMember.nombre}`}
                          onClick={() => handleToggleLock(staffMember)}
                        >
                          <Unlock className="jefa-screen__btn-sec-icon" />
                          <span>Desbloquear</span>
                        </button>
                      ) : (
                        <button
                          className="jefa-screen__btn-sec-action jefa-screen__btn-sec-action--lock"
                          title="Bloquear preventivamente la cuenta de este colaborador"
                          aria-label={`Bloquear a ${staffMember.nombre}`}
                          onClick={() => handleToggleLock(staffMember)}
                        >
                          <Lock className="jefa-screen__btn-sec-icon" />
                          <span>Bloquear</span>
                        </button>
                      )
                    ) : (
                      <span
                        className="jefa-screen__security-restricted"
                        title={isSelf ? 'No puedes bloquear tu propia cuenta' : 'Cuenta de nivel superior protegida'}
                      >
                        Protegida
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}

            {filteredStaff.length === 0 && (
              <tr>
                <td className="jefa-screen__empty-row" colSpan={5}>
                  <div className="jefa-screen__security-empty">
                    <AlertCircle className="jefa-screen__security-empty-icon" />
                    <span>No se encontró personal con los filtros indicados.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
