import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  RotateCcw,
  AlertCircle,
  CalendarDays
} from 'lucide-react'
import {
  fetchHabilitacionesHorariasApi,
  reactivateHabilitacionHorariaApi
} from '../../../../services/userService'
import { MESES_NOMBRES } from '../../hooks/useMonthlyOvertimePlanning'
import './ActiveMonthOvertimesTab.css'

export default function ActiveMonthOvertimesTab({
  staffMember,
  onClose,
  onRevoke,
  onGoToPlanning
}) {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [verInactivas, setVerInactivas] = useState(true)

  const staffId = staffMember?.id

  // Carga reactiva de habilitaciones del mes para este personal
  const cargarHabilitacionesMes = useCallback(async () => {
    if (!staffId) return
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await fetchHabilitacionesHorariasApi(
        true,
        staffId,
        null,
        anio,
        mes
      )
      setItems(data)
    } catch (err) {
      console.error('Error al cargar habilitaciones del mes:', err)
      setErrorMsg(err.message || 'No se pudieron consultar las horas extras del mes.')
    } finally {
      setLoading(false)
    }
  }, [staffId, anio, mes])

  useEffect(() => {
    cargarHabilitacionesMes()
  }, [cargarHabilitacionesMes])

  // Navegar entre meses
  const cambiarMes = (delta) => {
    let nuevoMes = mes + delta
    let nuevoAnio = anio
    if (nuevoMes > 12) {
      nuevoMes = 1
      nuevoAnio += 1
    } else if (nuevoMes < 1) {
      nuevoMes = 12
      nuevoAnio -= 1
    }
    setMes(nuevoMes)
    setAnio(nuevoAnio)
  }

  // Revocar una habilitación puntual
  const handleRevocar = async (habId, fechaStr) => {
    if (!window.confirm(`¿Confirmás la revocación de las horas extras del día ${fechaStr}?`)) {
      return
    }
    try {
      if (onRevoke) {
        await onRevoke(habId)
      }
      await cargarHabilitacionesMes()
    } catch (err) {
      setErrorMsg(err.message || 'Error al revocar la habilitación.')
    }
  }

  // Reactivar una habilitación previamente revocada
  const handleReactivar = async (habId) => {
    try {
      await reactivateHabilitacionHorariaApi(habId)
      await cargarHabilitacionesMes()
    } catch (err) {
      setErrorMsg(err.message || 'Error al reactivar la habilitación.')
    }
  }

  // Cómputo de horas totales del mes
  const itemsFiltrados = useMemo(() => {
    if (verInactivas) return items
    return items.filter((it) => it.activa)
  }, [items, verInactivas])

  const { totalDiasActivos, totalHorasMes } = useMemo(() => {
    let dias = 0
    let horas = 0
    items.forEach((it) => {
      if (it.activa) {
        dias += 1
        const [h1, m1] = String(it.hora_inicio).split(':').map(Number)
        const [h2, m2] = String(it.hora_fin).split(':').map(Number)
        const duracion = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
        horas += Math.max(0, duracion)
      }
    })
    return {
      totalDiasActivos: dias,
      totalHorasMes: Number(horas.toFixed(1))
    }
  }, [items])

  return (
    <div className="active-overtimes-tab">
      {errorMsg && (
        <div className="jefa-screen__modal-error" role="alert">
          <AlertCircle className="jefa-screen__modal-error-icon" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Navegación de Mes */}
      <div className="active-overtimes-tab__month-nav">
        <button
          type="button"
          className="active-overtimes-tab__month-nav-btn"
          onClick={() => cambiarMes(-1)}
          title="Mes anterior"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="active-overtimes-tab__nav-icon" />
        </button>
        <div className="active-overtimes-tab__month-nav-title">
          <Calendar className="active-overtimes-tab__month-icon" />
          <span>
            {MESES_NOMBRES[mes - 1]} {anio}
          </span>
        </div>
        <button
          type="button"
          className="active-overtimes-tab__month-nav-btn"
          onClick={() => cambiarMes(1)}
          title="Mes siguiente"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="active-overtimes-tab__nav-icon" />
        </button>
      </div>

      {/* Resumen del Mes */}
      <div className="active-overtimes-tab__summary">
        <div className="active-overtimes-tab__summary-item">
          <span>Días habilitados:</span>
          <strong>{totalDiasActivos}</strong>
        </div>
        <div className="active-overtimes-tab__summary-item">
          <span>Horas extras acumuladas:</span>
          <strong>{totalHorasMes} hs</strong>
        </div>
        <label style={{ fontSize: '0.74rem', color: '#647a85', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={verInactivas}
            onChange={(e) => setVerInactivas(e.target.checked)}
          />
          Mostrar revocadas
        </label>
      </div>

      {/* Listado de Habilitaciones */}
      {loading ? (
        <div className="active-overtimes-tab__loading">Consultando registros del mes...</div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="active-overtimes-tab__empty">
          <Clock className="active-overtimes-tab__empty-icon" />
          <span>No hay horas extras autorizadas para {MESES_NOMBRES[mes - 1]} {anio}.</span>
          {onGoToPlanning && (
            <button
              type="button"
              className="active-overtimes-tab__btn-go-planning"
              onClick={onGoToPlanning}
            >
              <CalendarDays style={{ width: '14px', height: '14px', display: 'inline', marginRight: '4px' }} />
              Ir a Planificación Mensual
            </button>
          )}
        </div>
      ) : (
        <div className="active-overtimes-tab__list">
          {itemsFiltrados.map((item) => {
            const hIni = String(item.hora_inicio).slice(0, 5)
            const hFin = String(item.hora_fin).slice(0, 5)
            const [h1, m1] = hIni.split(':').map(Number)
            const [h2, m2] = hFin.split(':').map(Number)
            const duracion = (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60).toFixed(1)

            return (
              <div
                key={item.id}
                className={`active-overtimes-tab__card ${
                  !item.activa ? 'active-overtimes-tab__card--inactive' : ''
                }`}
              >
                <div className="active-overtimes-tab__card-info">
                  <div className="active-overtimes-tab__card-date-row">
                    <span className="active-overtimes-tab__card-date">
                      {item.fecha}
                    </span>
                    <span
                      className={`active-overtimes-tab__badge ${
                        item.activa
                          ? 'active-overtimes-tab__badge--active'
                          : 'active-overtimes-tab__badge--inactive'
                      }`}
                    >
                      {item.activa ? 'Habilitada' : 'Revocada'}
                    </span>
                  </div>
                  <div className="active-overtimes-tab__card-hours">
                    <span>Horario:</span>
                    <strong>{hIni} - {hFin}</strong>
                    <span>({duracion} hs)</span>
                  </div>
                  {item.motivo && (
                    <span className="active-overtimes-tab__card-reason">
                      Motivo: {item.motivo}
                    </span>
                  )}
                </div>

                <div className="active-overtimes-tab__card-actions">
                  {item.activa ? (
                    <button
                      type="button"
                      className="active-overtimes-tab__btn-revoke"
                      onClick={() => handleRevocar(item.id, item.fecha)}
                      title="Revocar habilitación de esta fecha"
                    >
                      <Trash2 className="active-overtimes-tab__action-icon" />
                      Revocar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="active-overtimes-tab__btn-reactivate"
                      onClick={() => handleReactivar(item.id)}
                      title="Reactivar habilitación"
                    >
                      <RotateCcw className="active-overtimes-tab__action-icon" />
                      Reactivar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Acciones del pie: Cancelar a la izquierda */}
      <div className="jefa-screen__modal-actions">
        <button
          type="button"
          className="jefa-screen__btn-modal-cancel"
          onClick={onClose}
        >
          Cerrar
        </button>
        <span style={{ fontSize: '0.74rem', color: '#647a85' }}>
          {itemsFiltrados.length} registro(s) consultado(s)
        </span>
      </div>
    </div>
  )
}
