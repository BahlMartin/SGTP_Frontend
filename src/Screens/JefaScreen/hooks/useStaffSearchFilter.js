import { useState, useMemo, useCallback } from 'react'

/**
 * Hook reutilizable para gestionar el estado y filtrado reactivo de personal
 * en componentes de la pantalla de Jefa (Turnos, Cargas y Seguridad).
 *
 * @param {Array} staffList - Lista de colaboradores.
 * @param {Object} options - Configuración de filtrado.
 * @param {boolean} options.filterAdmin - Si debe excluir el rol 'Admin' (default: true).
 * @returns {Object} Estado de búsqueda y lista de personal filtrada.
 */
export function useStaffSearchFilter(staffList = [], options = {}) {
  const { filterAdmin = true } = options
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrar Admin por defecto para la vista de Jefa
  const baseList = useMemo(() => {
    if (!Array.isArray(staffList)) return []
    return filterAdmin
      ? staffList.filter((staffMember) => staffMember?.rol !== 'Admin')
      : staffList
  }, [staffList, filterAdmin])

  // Filtrado reactivo en memoria (latencia 0)
  const filteredStaff = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return baseList

    return baseList.filter((member) => {
      const matchName = String(member?.nombre || '').toLowerCase().includes(term)
      const matchPrimerNombre = String(member?.primerNombre || '').toLowerCase().includes(term)
      const matchApellidos = String(member?.apellidos || '').toLowerCase().includes(term)
      const matchMatricula = String(member?.matricula || '').toLowerCase().includes(term)
      const matchRol = String(member?.rol || '').toLowerCase().includes(term)
      const matchTurno = String(member?.turno || '').toLowerCase().includes(term)

      return (
        matchName ||
        matchPrimerNombre ||
        matchApellidos ||
        matchMatricula ||
        matchRol ||
        matchTurno
      )
    })
  }, [baseList, searchTerm])

  const clearSearch = useCallback(() => {
    setSearchTerm('')
  }, [])

  return {
    searchTerm,
    setSearchTerm,
    clearSearch,
    filteredStaff,
    isSearching: Boolean(searchTerm.trim()),
    hasResults: filteredStaff.length > 0,
    totalCount: baseList.length,
    matchCount: filteredStaff.length
  }
}
