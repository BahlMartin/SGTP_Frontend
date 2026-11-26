import React, { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
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
  const debounceTimerRef = useRef(null)
  const abortControllerRef = useRef(null)
  const requestIdRef = useRef(0)

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
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleSearch = (searchValue) => {
    const sanitizedValue = String(searchValue || '').replace(/[^0-9-]/g, '')
    setQuery(sanitizedValue)
    setSearchError('')

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    const hasSearchableChars = sanitizedValue.replace(/-/g, '').trim().length >= 1
    if (!hasSearchableChars) {
      requestIdRef.current += 1
      setIsSearching(false)
      setResults([])
      setShowDropdown(false)
      return
    }

    setIsSearching(true)
    setShowDropdown(true)
    const currentRequestId = ++requestIdRef.current

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const data = await searchPatientsApi(sanitizedValue, {
          scope: 'all',
          signal: controller.signal
        })
        if (requestIdRef.current === currentRequestId) {
          setResults(data)
          setShowDropdown(true)
        }
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error(err)
        if (requestIdRef.current === currentRequestId) {
          setSearchError(err.message || 'No se pudo buscar el paciente.')
          setResults([])
          setShowDropdown(true)
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsSearching(false)
        }
      }
    }, 250)
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
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    requestIdRef.current += 1
    setIsSearching(false)
    setQuery('')
    setResults([])
    setShowDropdown(false)
    setSearchError('')
  }

  return (
    <div className="patient-search" ref={searchContainerRef}>
      <h3 className="patient-search__title">Búsqueda de paciente</h3>
      <div className="patient-search__input-wrapper">
        <input
          type="text"
          inputMode="text"
          className="patient-search__input"
          placeholder="Buscar por DNI o N° de afiliado (ej: 34567-00)"
          aria-label="Buscar paciente por DNI o número de afiliado"
          value={query}
          onChange={(event) => handleSearch(event.target.value)}
          onFocus={() => query.replace(/-/g, '').trim() && setShowDropdown(true)}
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
        onPatientUpdated={(updated) => {
          setSelectedPatient((prev) => ({ ...(prev || {}), ...updated }))
          if (patientHistory) {
            setPatientHistory((prev) => ({
              ...prev,
              paciente: {
                ...(prev?.paciente || {}),
                ...updated
              }
            }))
          }
          setResults((prev) =>
            prev.map((item) =>
              (item.id_paciente === updated.id_paciente || item.id === updated.id_paciente)
                ? { ...item, ...updated }
                : item
            )
          )
        }}
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
