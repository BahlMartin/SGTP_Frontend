import { useState, useEffect, useCallback } from 'react'
import {
  fetchAllStaffApi,
  createStaffUserApi,
  toggleShiftExceptionApi,
  deleteStaffUserApi
} from '../services/userService'

export function useStaffManagement() {
  const [staffList, setStaffList] = useState([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [staffError, setStaffError] = useState(null)

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

  return {
    staffList,
    loadingStaff,
    staffError,
    loadStaff,
    toggleShift,
    deleteStaff,
    createStaff
  }
}
