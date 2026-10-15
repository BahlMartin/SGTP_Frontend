import React from 'react'
import { Search } from 'lucide-react'
import './StaffSearchInput.css'

/**
 * Componente reutilizable de barra de búsqueda para tablas y listas de personal.
 */
export default function StaffSearchInput({
  value = '',
  onChange = () => {},
  onClear = () => {},
  placeholder = 'Buscar personal por nombre, matrícula o rol...',
  className = '',
  size = 'default', // 'default' | 'compact'
  id = undefined
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault()
      onClear()
    }
  }

  const isCompact = size === 'compact'

  return (
    <div
      className={`jefa-staff-search ${isCompact ? 'jefa-staff-search--compact' : ''} ${className}`.trim()}
    >
      <Search className="jefa-staff-search__icon" aria-hidden="true" />
      <input
        id={id}
        type="text"
        className="jefa-staff-search__input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          className="jefa-staff-search__clear"
          onClick={onClear}
          title="Limpiar búsqueda (Esc)"
          aria-label="Limpiar búsqueda"
        >
          ×
        </button>
      )}
    </div>
  )
}
