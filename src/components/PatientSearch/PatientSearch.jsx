import React, { useState, useEffect, useRef } from 'react'
import { Search, UserCheck, X } from 'lucide-react'
import { searchPatientsApi } from '../../services/ticketService'
import { fetchPatientHistoryApi } from '../../services/patientService'
import PatientHistoryModal from '../PatientHistoryModal/PatientHistoryModal'
import PatientDropdown from '../PatientDropdown/PatientDropdown'
import './PatientSearch.css'

export default function PatientSearch({ onSelectPatient }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientHistory, setPatientHistory] = useState(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')
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
    setSearchError('')
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
      setSearchError(err.message || 'No se pudo buscar el paciente.')
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelect = async (patient) => {
    setSelectedPatient(patient)
    setPatientHistory(null)
    setHistoryError('')
    setShowDropdown(false)
    setIsLoadingHistory(true)

    try {
      const history = await fetchPatientHistoryApi(patient.id_paciente)
      setPatientHistory(history)
    } catch (error) {
      console.error('Error al cargar historial del paciente:', error)
      setHistoryError(error.message || 'No se pudo cargar el historial del paciente.')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
    setSearchError('')
  }

  return (
    <div className="patient-search" ref={searchContainerRef}>
      <h3 className="patient-search__title">Busqueda de paciente</h3>
      <div className="patient-search__input-wrapper">
        <input
          type="text"
          className="patient-search__input"
          placeholder="DNI o número de afiliado"
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

      <PatientDropdown
        isOpen={showDropdown}
        isSearching={isSearching}
        error={searchError}
        results={results}
        emptyMessage="No se encontraron registros previos."
        onSelectPatient={handleSelect}
      />

      <PatientHistoryModal
        patient={selectedPatient}
        history={patientHistory}
        isLoading={isLoadingHistory}
        error={historyError}
        onSelectPatient={onSelectPatient ? () => {
          onSelectPatient(selectedPatient)
          setSelectedPatient(null)
          setPatientHistory(null)
          setHistoryError('')
        } : undefined}
        onClose={() => {
          setSelectedPatient(null)
          setPatientHistory(null)
          setHistoryError('')
        }}
      />
    </div>
  )
}
