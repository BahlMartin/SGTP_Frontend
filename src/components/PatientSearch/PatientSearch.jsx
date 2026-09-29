import React, { useState, useEffect, useRef } from 'react'
import { Search, UserCheck, X } from 'lucide-react'
import { searchPatientsApi } from '../../services/ticketService'
import './PatientSearch.css'

export default function PatientSearch({ onSelectPatient }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchContainerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (mouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(mouseEvent.target)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSearch = async (searchValue) => {
    setQuery(searchValue)
    if (!searchValue.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setIsSearching(true)
    try {
      const data = await searchPatientsApi(searchValue)
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
    <div className="patient-search" ref={searchContainerRef}>
      <h3 className="patient-search__title">Busqueda de paciente</h3>
      <div className="patient-search__input-wrapper">
        <input
          type="text"
          className="patient-search__input"
          placeholder="N° DNI u Obra social"
          value={query}
          onChange={(event) => handleSearch(event.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
        />
        {query.length > 0 ? (
          <button
            type="button"
            className="patient-search__clear-btn"
            onClick={clearSearch}
            aria-label="Limpiar búsqueda"
          >
            <X className="patient-search__clear-icon" />
          </button>
        ) : (
          <Search className="patient-search__icon" />
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
              {results.map((patient) => (
                <li key={patient.dni} className="patient-search__item" onClick={() => handleSelect(patient)}>
                  <div className="patient-search__avatar">
                    <UserCheck className="patient-search__avatar-icon" />
                  </div>
                  <div className="patient-search__info">
                    <span className="patient-search__name">
                      {patient.nombre} {patient.apellido}
                    </span>
                    <span className="patient-search__details">
                      DNI: <strong>{patient.dni}</strong> | OS: <strong>{patient.obraSocial || 'Sin cobertura'}</strong>
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
