import React, { useState, useEffect, useRef } from 'react'
import { X, Users, Loader2, AlertCircle, FileText, Calendar, Filter } from 'lucide-react'
import { fetchTicketsByStaffApi, fetchTicketByIdApi } from '../../../../services/ticketService'
import TicketModal from '../../../../components/TicketModal/TicketModal'
import StaffTicketCard from './StaffTicketCard'
import './StaffTicketsModal.css'

export default function StaffTicketsModal({
  staffMember,
  selectedDate = '',
  onClose
}) {
  const [filterMode, setFilterMode] = useState(selectedDate ? 'date' : 'all')
  const [tickets, setTickets] = useState([])
  const [tipo, setTipo] = useState('admision')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedTicketDetail, setSelectedTicketDetail] = useState(null)
  const [isFetchingTicketId, setIsFetchingTicketId] = useState(null)
  const [ticketFetchError, setTicketFetchError] = useState('')
  const ticketCacheRef = useRef({})

  const staffId = staffMember?.id_personal ?? staffMember?.id

  // Manejo de tecla Escape
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (selectedTicketDetail) {
          setSelectedTicketDetail(null)
        } else {
          onClose?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTicketDetail, onClose])

  // Carga de tickets reactiva
  useEffect(() => {
    if (!staffId) return

    let isMounted = true
    setIsLoading(true)
    setError('')

    const dateParam = filterMode === 'date' ? selectedDate : null

    fetchTicketsByStaffApi(staffId, dateParam)
      .then((data) => {
        if (!isMounted) return
        setTickets(data.tickets || [])
        setTipo(data.tipo || (staffMember?.rol === 'Admision' ? 'admision' : 'box'))
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('Error al cargar tickets del personal:', err)
        setError(err.message || 'No se pudieron consultar los tickets del profesional.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [staffId, filterMode, selectedDate, staffMember?.rol])

  // Ver comprobante asistencial con caché en memoria
  const handleViewTicket = async (ticketId) => {
    if (!ticketId) return
    setTicketFetchError('')

    if (ticketCacheRef.current[ticketId]) {
      setSelectedTicketDetail(ticketCacheRef.current[ticketId])
      return
    }

    setIsFetchingTicketId(ticketId)
    try {
      const ticketData = await fetchTicketByIdApi(ticketId)
      ticketCacheRef.current[ticketId] = ticketData
      setSelectedTicketDetail(ticketData)
    } catch (err) {
      console.error('Error al obtener el comprobante del ticket:', err)
      setTicketFetchError(
        err.message || 'No se pudo obtener el comprobante del ticket desde el servidor.'
      )
    } finally {
      setIsFetchingTicketId(null)
    }
  }

  if (!staffMember) return null

  const isAdmission = tipo === 'admision'
  const titleText = isAdmission
    ? 'Tickets Emitidos por Operador de Admisión'
    : 'Tickets Atendidos y Extraídos por Técnico'

  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return (parts[0]?.[0] || 'ST').toUpperCase()
  }

  const staffName = staffMember.nombre_completo || staffMember.nombre || 'Personal'
  const staffRole = staffMember.rol || (isAdmission ? 'Admisión' : 'Técnico de Box')
  const staffMatricula = staffMember.matricula ? `Mat. ${staffMember.matricula}` : 'Sin matrícula'

  return (
    <>
      <div
        className="staff-tickets-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-tickets-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.()
        }}
      >
        <section className="staff-tickets-modal__card">
          <button
            type="button"
            className="staff-tickets-modal__close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>

          <div className="staff-tickets-modal__title-row">
            <Users size={22} className="staff-tickets-modal__title-icon" aria-hidden="true" />
            <h2 id="staff-tickets-title" className="staff-tickets-modal__title">
              {titleText}
            </h2>
          </div>

          {/* Ficha demográfica del profesional */}
          <div className="staff-tickets-modal__profile">
            <div className="staff-tickets-modal__profile-left">
              <div className="staff-tickets-modal__avatar">
                {getInitials(staffName)}
              </div>
              <div className="staff-tickets-modal__details">
                <div className="staff-tickets-modal__name-wrap">
                  <span className="staff-tickets-modal__name">{staffName}</span>
                  <span
                    className={`staff-tickets-modal__role-badge ${
                      isAdmission
                        ? 'staff-tickets-modal__role-badge--admision'
                        : 'staff-tickets-modal__role-badge--box'
                    }`}
                  >
                    {staffRole}
                  </span>
                </div>
                <div className="staff-tickets-modal__meta">
                  <span>{staffMatricula}</span>
                  {staffMember.email && <span>· {staffMember.email}</span>}
                </div>
              </div>
            </div>

            <div className="staff-tickets-modal__profile-kpi">
              <span className="staff-tickets-modal__kpi-number">{tickets.length}</span>
              <span className="staff-tickets-modal__kpi-label">
                {isAdmission ? 'Tickets Emitidos' : 'Pacientes Atendidos'}
              </span>
            </div>
          </div>

          {/* Barra de Filtro de Fecha */}
          <div className="staff-tickets-modal__filter-bar">
            <div className="staff-tickets-modal__filter-title">
              <Filter size={15} />
              <span>
                {filterMode === 'date' && selectedDate
                  ? `Jornada seleccionada (${selectedDate})`
                  : 'Todo el historial'}
              </span>
            </div>

            {selectedDate && (
              <div className="staff-tickets-modal__filter-buttons">
                <button
                  type="button"
                  className={`staff-tickets-modal__filter-btn ${
                    filterMode === 'date' ? 'staff-tickets-modal__filter-btn--active' : ''
                  }`}
                  onClick={() => setFilterMode('date')}
                >
                  Día seleccionado
                </button>
                <button
                  type="button"
                  className={`staff-tickets-modal__filter-btn ${
                    filterMode === 'all' ? 'staff-tickets-modal__filter-btn--active' : ''
                  }`}
                  onClick={() => setFilterMode('all')}
                >
                  Historial completo
                </button>
              </div>
            )}
          </div>

          {/* Mensaje de error al abrir comprobante */}
          {ticketFetchError && (
            <div className="staff-tickets-modal__status staff-tickets-modal__status--error" role="alert">
              <AlertCircle size={16} />
              <span>{ticketFetchError}</span>
            </div>
          )}

          {/* Lista de tickets */}
          <div className="staff-tickets-modal__content">
            {isLoading ? (
              <p className="staff-tickets-modal__status" role="status">
                <Loader2 size={18} className="staff-tickets-modal__spinner" />
                <span>Cargando tickets del profesional...</span>
              </p>
            ) : error ? (
              <p className="staff-tickets-modal__status staff-tickets-modal__status--error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </p>
            ) : tickets.length === 0 ? (
              <div className="staff-tickets-modal__empty">
                <FileText size={36} className="staff-tickets-modal__empty-icon" />
                <p>
                  No se registran tickets {isAdmission ? 'emitidos' : 'atendidos'} por este profesional{' '}
                  {filterMode === 'date' && selectedDate ? `en la jornada del ${selectedDate}.` : '.'}
                </p>
              </div>
            ) : (
              <ul className="staff-tickets-modal__list">
                {tickets.map((t) => {
                  const tid = t.id_ticket || t.id
                  return (
                    <StaffTicketCard
                      key={tid}
                      ticket={t}
                      tipo={tipo}
                      isFetching={isFetchingTicketId === tid}
                      onViewTicket={handleViewTicket}
                    />
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer del Modal */}
          <div className="staff-tickets-modal__actions">
            <button
              type="button"
              className="staff-tickets-modal__cancel"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </section>
      </div>

      {/* Comprobante modal reutilizable */}
      {selectedTicketDetail && (
        <TicketModal
          ticket={selectedTicketDetail}
          title={`Comprobante Asistencial - ${staffName}`}
          onClose={() => setSelectedTicketDetail(null)}
        />
      )}
    </>
  )
}
