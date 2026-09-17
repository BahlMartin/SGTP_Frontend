import React, { useState } from 'react'
import { Search, UserCheck, X } from 'lucide-react'
import { searchPatientsApi } from '../../services/ticketService'
import './PatientSearch.css'

export default function PatientSearch({ onSelectPatient }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const handleSearch = async (val) => {
    setQuery(val)
    if (!val.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setIsSearching(true)
    try {
      const data = await searchPatientsApi(val)
      setResults(data)
      setShowDropdown(true)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelect = (patient) => {
    if (onSelectPatient) {
      onSelectPatient(patient)
    }
    setShowDropdown(false)
    setQuery(`${patient.nombre} ${patient.apellido} (DNI: ${patient.dni})`)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }

  return (
    <div className="patient-search-card">
      <h3 className="patient-search-title">Busqueda de paciente</h3>
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="N° DNI u Obra social"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
        />
        {query ? (
          <button className="btn-clear-search" onClick={clearSearch}>
            <X size={16} />
          </button>
        ) : (
          <Search size={16} className="search-icon-adornment" />
        )}
      </div>

      {showDropdown && (
        <div className="patient-search-dropdown">
          {isSearching ? (
            <div className="dropdown-status">Buscando en base clínica...</div>
          ) : results.length === 0 ? (
            <div className="dropdown-status">No se encontraron registros previos.</div>
          ) : (
            <ul className="patient-results-list">
              {results.map((p) => (
                <li key={p.dni} className="patient-result-item" onClick={() => handleSelect(p)}>
                  <div className="result-avatar">
                    <UserCheck size={16} />
                  </div>
                  <div className="result-info">
                    <span className="result-name">
                      {p.nombre} {p.apellido}
                    </span>
                    <span className="result-sub">
                      DNI: <strong>{p.dni}</strong> | OS: <strong>{p.obraSocial || 'Sin cobertura'}</strong>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
