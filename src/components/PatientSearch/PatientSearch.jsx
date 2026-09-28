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
    <div className="patient-search">
      <h3 className="patient-search__title">Busqueda de paciente</h3>
      <div className="patient-search__input-wrapper">
        <input
          type="text"
          className="patient-search__input"
          placeholder="N° DNI u Obra social"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
        />
        {query ? (
          <button className="patient-search__clear-btn" onClick={clearSearch}>
            <X size={16} />
          </button>
        ) : (
          <Search size={16} className="patient-search__icon" />
        )}
      </div>

      {showDropdown && (
        <div className="patient-search__dropdown">
          {isSearching ? (
            <div className="patient-search__status">Buscando en base clínica...</div>
          ) : results.length === 0 ? (
            <div className="patient-search__status">No se encontraron registros previos.</div>
          ) : (
            <ul className="patient-search__list">
              {results.map((p) => (
                <li key={p.dni} className="patient-search__item" onClick={() => handleSelect(p)}>
                  <div className="patient-search__avatar">
                    <UserCheck size={16} />
                  </div>
                  <div className="patient-search__info">
                    <span className="patient-search__name">
                      {p.nombre} {p.apellido}
                    </span>
                    <span className="patient-search__details">
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
