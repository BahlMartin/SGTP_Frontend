import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchAllStaffApi,
  createStaffUserApi,
  updateStaffUserApi,
  toggleShiftExceptionApi,
  deleteStaffUserApi,
  reactivateStaffUserApi
} from '../services/userService'
import { unlockUserApi } from '../services/authService'
import { isWithinShiftGrace } from '../utils/shiftTime.utils'

export function useStaffManagement() {
  const [staffList, setStaffList] = useState([])
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [staffError, setStaffError] = useState(null)

  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timerId)
  }, [])

  const staffWithScheduleStatus = useMemo(
    () => staffList.map((staffMember) => {
      const horarioRestringido = ['Admision', 'Box', 'Secretaria'].includes(staffMember.rol)
      const dentroHorario = !horarioRestringido || isWithinShiftGrace(
        staffMember.inicio_turno,
        staffMember.fin_turno,
        currentTime
      )
      return {
        ...staffMember,
        dentro_horario: dentroHorario,
        disponible: staffMember.activo && dentroHorario
      }
    }),
    [currentTime, staffList]
  )

  const loadStaff = useCallback(async () => {
    setLoadingStaff(true)
    setStaffError(null)
    try {
      const dataStaff = await fetchAllStaffApi()
      setStaffList(dataStaff)
    } catch (error) {
      console.error('Error al cargar la lista de personal:', error)
      setStaffError(error.message || 'Error al cargar el personal.')
    } finally {
      setLoadingStaff(false)
    }
  }, [])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const toggleShift = async (staffMemberId, currentStatus, onSuccess) => {
    try {
      const nextStatus = currentStatus !== 'En turno'
      await toggleShiftExceptionApi(staffMemberId, nextStatus)
      await loadStaff()
      if (onSuccess) {
        onSuccess('Habilitación de turno actualizada para el personal.')
      }
    } catch (error) {
      alert(error.message || 'Error al actualizar el turno.')
    }
  }

  const deleteStaff = async (staffMemberId, staffMemberName, staffMemberRole, currentUserRole, onSuccess) => {
    const canDelete =
      currentUserRole === 'Admin' ||
      (currentUserRole === 'Jefa' && staffMemberRole !== 'Admin' && staffMemberRole !== 'Jefa')

    if (!canDelete) {
      alert('No tienes permisos para eliminar este perfil de personal.')
      return
    }

    const confirmed = window.confirm(
      `¿Deseas borrar al personal ${staffMemberName}? Esta acción no se puede deshacer.`
    )
    if (!confirmed) return

    try {
      await deleteStaffUserApi(currentUserRole, staffMemberId)
      await loadStaff()
      if (onSuccess) {
        onSuccess('Miembro del personal eliminado correctamente.')
      }
    } catch (error) {
      alert(error.message || 'Error al eliminar al miembro del personal.')
    }
  }

  const createStaff = async (newStaffPayload, currentUserRole, onSuccess) => {
    // Restricción RBAC de jerarquía
    if (
      currentUserRole === 'Jefa' &&
      (newStaffPayload.rol === 'Admin' || newStaffPayload.rol === 'Jefa')
    ) {
      throw new Error(
        'Restricción RBAC: La Jefa solo puede dar de alta personal de Admisión o Box.'
      )
    }

    await createStaffUserApi(currentUserRole, newStaffPayload)
    await loadStaff()
    if (onSuccess) {
      onSuccess('Personal incorporado exitosamente.')
    }
  }

  const updateStaff = async (staffMemberId, updatePayload, onSuccess) => {
    await updateStaffUserApi(staffMemberId, updatePayload)
    await loadStaff()
    if (onSuccess) {
      onSuccess('Datos y horario del personal actualizados correctamente.')
    }
  }

  const unlockStaff = async (staffMemberId, onSuccess) => {
    try {
      await unlockUserApi(staffMemberId)
      await loadStaff()
      if (onSuccess) {
        onSuccess('Cuenta de personal desbloqueada exitosamente.')
      }
    } catch (error) {
      alert(error.message || 'Error al desbloquear al miembro del personal.')
    }
  }

  const reactivateStaff = async (staffMemberId, onSuccess) => {
    try {
      await reactivateStaffUserApi(staffMemberId)
      await loadStaff()
      if (onSuccess) {
        onSuccess('Cuenta de personal reactivada exitosamente.')
      }
    } catch (error) {
      alert(error.message || 'Error al reactivar al miembro del personal.')
    }
  }

  return {
    staffList: staffWithScheduleStatus,
    loadingStaff,
    staffError,
    loadStaff,
    toggleShift,
    deleteStaff,
    createStaff,
    updateStaff,
    unlockStaff,
    reactivateStaff
  }
}
