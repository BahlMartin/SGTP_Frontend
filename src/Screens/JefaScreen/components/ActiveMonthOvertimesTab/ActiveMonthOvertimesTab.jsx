import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  RotateCcw,
  AlertCircle,
  CalendarDays,
  Info
} from 'lucide-react'
import {
  fetchHabilitacionesHorariasApi,
  reactivateHabilitacionHorariaApi
} from '../../../../services/userService'
import { MESES_NOMBRES } from '../../hooks/useMonthlyOvertimePlanning'
import { DIAS_SEMANA_LETRAS } from '../../../../utils/shiftValidation.utils'
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
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)

  const staffId = staffMember?.id
  const diasLaborales = useMemo(
    () => staffMember?.dias_laborales_detalle || [0, 1, 2, 3, 4],
    [staffMember?.dias_laborales_detalle]
  )

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
    setFechaSeleccionada(null)
  }

  // Mapa de habilitaciones agrupadas por fecha ('YYYY-MM-DD')
  const habilitacionesPorFecha = useMemo(() => {
    const mapa = {}
    items.forEach((item) => {
      const f = String(item.fecha).slice(0, 10)
      if (!mapa[f]) mapa[f] = []
      mapa[f].push(item)
    })
    return mapa
  }, [items])

  // Cómputo de totales del mes
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

  // Generar matriz de celdas para el mes
  const celdasCalendario = useMemo(() => {
    const primerDia = new Date(anio, mes - 1, 1)
    const totalDias = new Date(anio, mes, 0).getDate()
    const diaInicioSemana = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1 // 0=Lun ... 6=Dom

    const celdas = []
    for (let i = 0; i < diaInicioSemana; i++) {
      celdas.push({ dia: null, fechaStr: null })
    }

    for (let d = 1; d <= totalDias; d++) {
      const mesStr = String(mes).padStart(2, '0')
      const diaStr = String(d).padStart(2, '0')
      const fechaStr = `${anio}-${mesStr}-${diaStr}`

      const fechaObj = new Date(anio, mes - 1, d)
      const diaSemanaNum = fechaObj.getDay() === 0 ? 6 : fechaObj.getDay() - 1
      const esLaboral = diasLaborales.includes(diaSemanaNum)
      const esFinDeSemana = diaSemanaNum >= 5

      const habsDelDia = habilitacionesPorFecha[fechaStr] || []
      const tieneActiva = habsDelDia.some((h) => h.activa)
      const tieneRevocada = habsDelDia.length > 0 && !tieneActiva

      let duracionDia = 0
      if (tieneActiva) {
        habsDelDia.forEach((h) => {
          if (h.activa) {
            const [h1, m1] = String(h.hora_inicio).split(':').map(Number)
            const [h2, m2] = String(h.hora_fin).split(':').map(Number)
            duracionDia += Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60)
          }
        })
      }

      celdas.push({
        dia: d,
        fechaStr,
        esLaboral,
        esFinDeSemana,
        habs: habsDelDia,
        tieneActiva,
        tieneRevocada,
        duracionDia: Number(duracionDia.toFixed(1))
      })
    }
    return celdas
  }, [anio, mes, diasLaborales, habilitacionesPorFecha])

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

  // Habilitaciones del día seleccionado actualmente
  const habilitacionesDiaSeleccionado = fechaSeleccionada
    ? habilitacionesPorFecha[fechaSeleccionada] || []
    : []

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
          <span>Días autorizados:</span>
          <strong>{totalDiasActivos}</strong>
        </div>
        <div className="active-overtimes-tab__summary-item">
          <span>Horas extras computadas:</span>
          <strong>{totalHorasMes} hs</strong>
        </div>
        {loading && (
          <span style={{ fontSize: '0.72rem', color: '#1687c9', fontWeight: 600 }}>
            Actualizando...
          </span>
        )}
      </div>

      {/* Calendario Mensual Interactivo para Inspección */}
      <div className="active-overtimes-calendar">
        <div className="active-overtimes-calendar__weekdays">
          {DIAS_SEMANA_LETRAS.map((letra, idx) => (
            <span
              key={idx}
              className={`active-overtimes-calendar__weekday-head ${
                idx >= 5 ? 'active-overtimes-calendar__weekday-head--weekend' : ''
              }`}
            >
              {letra}
            </span>
          ))}
        </div>

        <div className="active-overtimes-calendar__grid">
          {celdasCalendario.map((celda, idx) => {
            if (!celda.dia) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="active-overtimes-calendar__cell active-overtimes-calendar__cell--empty"
                />
              )
            }

            const isSelected = fechaSeleccionada === celda.fechaStr
            let cellModifier = ''
            if (celda.tieneActiva) {
              cellModifier = 'active-overtimes-calendar__cell--active'
            } else if (celda.tieneRevocada) {
              cellModifier = 'active-overtimes-calendar__cell--revoked'
            } else if (celda.esFinDeSemana) {
              cellModifier = 'active-overtimes-calendar__cell--weekend'
            }

            return (
              <button
                key={celda.fechaStr}
                type="button"
                className={`active-overtimes-calendar__cell ${cellModifier} ${
                  isSelected ? 'active-overtimes-calendar__cell--selected' : ''
                }`}
                onClick={() => setFechaSeleccionada(celda.fechaStr)}
                title={
                  celda.tieneActiva
                    ? `Día ${celda.dia}: Horas extras activas (+${celda.duracionDia}h). Clic para inspeccionar o revocar.`
                    : celda.tieneRevocada
                    ? `Día ${celda.dia}: Horas extras revocadas. Clic para inspeccionar o reactivar.`
                    : `Día ${celda.dia} (${celda.esLaboral ? 'Turno regular' : 'Franco'}). Clic para inspeccionar.`
                }
              >
                <span className="active-overtimes-calendar__day-number">{celda.dia}</span>
                {celda.tieneActiva ? (
                  <span className="active-overtimes-calendar__day-pill">
                    +{celda.duracionDia}h
                  </span>
                ) : celda.tieneRevocada ? (
                  <span className="active-overtimes-calendar__day-revoked-pill">
                    Revoc.
                  </span>
                ) : (
                  <span className="active-overtimes-calendar__day-indicator">
                    {celda.esLaboral ? 'R' : 'F'}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Leyenda del Calendario */}
        <div className="active-overtimes-calendar__legend">
          <div className="active-overtimes-calendar__legend-item">
            <span className="active-overtimes-calendar__legend-badge active-overtimes-calendar__legend-badge--active">+h</span>
            <span>Habilitado</span>
          </div>
          <div className="active-overtimes-calendar__legend-item">
            <span className="active-overtimes-calendar__legend-badge active-overtimes-calendar__legend-badge--revoked">✕</span>
            <span>Revocado</span>
          </div>
          <div className="active-overtimes-calendar__legend-item">
            <span className="active-overtimes-calendar__legend-badge active-overtimes-calendar__legend-badge--regular">R</span>
            <span>Turno Regular</span>
          </div>
          <div className="active-overtimes-calendar__legend-item">
            <span className="active-overtimes-calendar__legend-badge active-overtimes-calendar__legend-badge--off">F</span>
            <span>Franco</span>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* PANEL DE DETALLE / INSPECCIÓN DEL DÍA SELECCIONADO (overtime-modal__previas) */}
      {/* ============================================================================== */}
      <div className="active-overtimes-detail-panel">
        {!fechaSeleccionada ? (
          <div className="active-overtimes-detail-panel__prompt">
            <Info className="active-overtimes-detail-panel__prompt-icon" />
            <span>
              Hacé clic en cualquier día del calendario para ver el detalle de la autorización, revocarla o reactivarla.
            </span>
          </div>
        ) : habilitacionesDiaSeleccionado.length === 0 ? (
          <div className="active-overtimes-detail-panel__empty">
            <Clock className="active-overtimes-detail-panel__empty-icon" />
            <div>
              <strong>Fecha: {fechaSeleccionada}</strong>
              <p>No se registran autorizaciones de horas extras para este día.</p>
            </div>
            {onGoToPlanning && (
              <button
                type="button"
                className="active-overtimes-tab__btn-go-planning"
                onClick={onGoToPlanning}
              >
                <CalendarDays style={{ width: '13px', height: '13px', display: 'inline', marginRight: '4px' }} />
                Planificar horas extras para esta fecha
              </button>
            )}
          </div>
        ) : (
          <div className="overtime-modal__previas active-overtimes-detail-panel__card">
            <div className="active-overtimes-detail-panel__card-header">
              <span className="overtime-modal__previas-title">
                Autorizaciones registradas para el {fechaSeleccionada}:
              </span>
              <span style={{ fontSize: '0.74rem', color: '#557283' }}>
                {habilitacionesDiaSeleccionado.length} registro(s)
              </span>
            </div>

            <ul className="overtime-modal__previas-list">
              {habilitacionesDiaSeleccionado.map((hab) => {
                const hIni = String(hab.hora_inicio).slice(0, 5)
                const hFin = String(hab.hora_fin).slice(0, 5)
                const [h1, m1] = hIni.split(':').map(Number)
                const [h2, m2] = hFin.split(':').map(Number)
                const duracion = (((h2 * 60 + m2) - (h1 * 60 + m1)) / 60).toFixed(1)

                return (
                  <li key={hab.id} className="overtime-modal__previas-item active-overtimes-detail-panel__item">
                    <div className="active-overtimes-detail-panel__item-info">
                      <div className="active-overtimes-detail-panel__item-header">
                        <span className="active-overtimes-detail-panel__item-time">
                          {hIni} a {hFin} ({duracion} hs)
                        </span>
                        <span
                          className={`active-overtimes-tab__badge ${
                            hab.activa
                              ? 'active-overtimes-tab__badge--active'
                              : 'active-overtimes-tab__badge--inactive'
                          }`}
                        >
                          {hab.activa ? 'Activa' : 'Revocada'}
                        </span>
                      </div>
                      <span className="active-overtimes-detail-panel__item-reason">
                        Motivo: {hab.motivo}
                      </span>
                      {hab.aprobado_por_email && (
                        <span className="active-overtimes-detail-panel__item-approver">
                          Autorizado por: {hab.aprobado_por_email}
                        </span>
                      )}
                    </div>

                    <div className="active-overtimes-detail-panel__item-actions">
                      {hab.activa ? (
                        <button
                          type="button"
                          className="overtime-modal__btn-revoke active-overtimes-tab__btn-revoke"
                          onClick={() => handleRevocar(hab.id, hab.fecha)}
                          title="Revocar esta autorización"
                        >
                          <Trash2 className="active-overtimes-tab__action-icon" />
                          <span>Revocar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="active-overtimes-tab__btn-reactivate"
                          onClick={() => handleReactivar(hab.id)}
                          title="Reactivar esta autorización"
                        >
                          <RotateCcw className="active-overtimes-tab__action-icon" />
                          <span>Reactivar</span>
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Acciones al pie: Botón Cerrar en rojo suave a la izquierda */}
      <div className="jefa-screen__modal-actions">
        <button
          type="button"
          className="jefa-screen__btn-modal-cancel"
          onClick={onClose}
        >
          Cerrar
        </button>
        <span style={{ fontSize: '0.74rem', color: '#647a85' }}>
          {totalDiasActivos} días activos • {totalHorasMes} hs en {MESES_NOMBRES[mes - 1]}
        </span>
      </div>
    </div>
  )
}
