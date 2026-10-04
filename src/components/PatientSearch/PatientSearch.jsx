import React, { useState, useEffect, useRef } from 'react'
import { Search, UserCheck, X } from 'lucide-react'
import { searchPatientsApi } from '../../services/ticketService'
import { fetchPatientHistoryApi } from '../../services/patientService'
import PatientHistoryModal from '../PatientHistoryModal/PatientHistoryModal'
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

  const handleUsePatient = (patientData) => {
    onSelectPatient?.({
      ...patientData,
      id_paciente: patientData.id_paciente || selectedPatient?.id_paciente,
      dni: String(patientData.dni || selectedPatient?.dni || ''),
      apellido: patientData.apellidos || patientData.apellido || selectedPatient?.apellido || '',
      obraSocial: patientData.obra_social || patientData.obraSocial || selectedPatient?.obraSocial || '',
      numeroAfiliado: patientData.num_obra_social || patientData.numeroAfiliado || selectedPatient?.numeroAfiliado || ''
    })
    setQuery(`${patientData.nombre || selectedPatient?.nombre || ''} ${patientData.apellidos || patientData.apellido || selectedPatient?.apellido || ''} (DNI: ${patientData.dni || selectedPatient?.dni || ''})`)
    setSelectedPatient(null)
    setPatientHistory(null)
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

      {showDropdown && (
        <div className="patient-search__dropdown">
          {isSearching ? (
            <div className="patient-search__status">Buscando en base clínica...</div>
          ) : searchError ? (
            <div className="patient-search__status" role="alert">{searchError}</div>
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
                      DNI: <strong>{patient.dni}</strong> | N° afiliado: <strong>{patient.num_obra_social || patient.numeroAfiliado || 'No informado'}</strong>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <PatientHistoryModal
        patient={selectedPatient}
        history={patientHistory}
        isLoading={isLoadingHistory}
        error={historyError}
        onUsePatient={handleUsePatient}
        onClose={() => {
          setSelectedPatient(null)
          setPatientHistory(null)
          setHistoryError('')
        }}
      />
    </div>
  )
}
