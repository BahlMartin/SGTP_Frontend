import React, { useState, useEffect, useCallback } from 'react'
import {
  User,
  Calendar,
  Clock,
  AlertTriangle,
  Activity,
  Layers,
  ChevronRight,
  Coffee
} from 'lucide-react'
import { fetchEmpleadoJornadaApi } from '../../../services/auditService'
import { fetchAllStaffApi } from '../../../services/userService'
import ActivityStripSVG from './ActivityStripSVG'
import {
  CATEGORIAS_CONFIG,
  ACCIONES_CATALOGO,
  formatHora
} from '../constants/auditoriaConstants'
import './EmpleadoJornadaView.css'

export default function EmpleadoJornadaView({
  currentUser,
  onSelectEvent,
  initialEmpleadoId = null,
  initialFecha = null,
  onParamsChange
}) {
  const [personalList, setPersonalList] = useState([])
  const [selectedEmpId, setSelectedEmpId] = useState(() => {
    if (initialEmpleadoId) return String(initialEmpleadoId)
    try {
      const saved = sessionStorage.getItem('sgtp_jornada_empleado_id')
      if (saved) return String(saved)
    } catch {}
    return ''
  })
  const [selectedFecha, setSelectedFecha] = useState(() => {
    if (initialFecha) return String(initialFecha)
    try {
      const saved = sessionStorage.getItem('sgtp_jornada_fecha')
      if (saved) return String(saved)
    } catch {}
    return new Date().toISOString().slice(0, 10)
  })
  const [jornadaData, setJornadaData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Handlers sincronizados
  const handleEmpChange = (empId) => {
    setSelectedEmpId(empId)
    try {
      sessionStorage.setItem('sgtp_jornada_empleado_id', empId)
    } catch {}
    if (onParamsChange) {
      onParamsChange({ tab: 'jornada', usuario: empId, fecha: selectedFecha })
    }
  }

  const handleFechaChange = (fechaVal) => {
    setSelectedFecha(fechaVal)
    try {
      sessionStorage.setItem('sgtp_jornada_fecha', fechaVal)
    } catch {}
    if (onParamsChange) {
      onParamsChange({ tab: 'jornada', usuario: selectedEmpId, fecha: fechaVal })
    }
  }

  // Cargar lista de empleados permitidos (Jefa no ve Admins, solo personal activo y no eliminado)
  useEffect(() => {
    let isMounted = true
    async function loadStaff() {
      try {
        // Obtenemos solo personal activo (incluirInactivos = false)
        const staff = await fetchAllStaffApi(false)
        const filtered = staff.filter((u) => {
          // Filtrado estricto: excluir inactivos o eliminados
          if (u.activo === false || u.is_active === false) return false
          // Restricción RBAC: Jefa no puede auditar ni ver Administradores
          if (currentUser?.rol === 'Jefa' && u.rol === 'Admin') return false
          return true
        })
        if (isMounted) {
          setPersonalList(filtered)
          if (filtered.length > 0) {
            setSelectedEmpId((prev) => {
              // Si el ID actualmente seleccionado sigue activo en la lista, conservarlo
              const currentValid = prev && filtered.some((emp) => String(emp.id) === String(prev))
              if (currentValid) {
                if (onParamsChange) {
                  onParamsChange({ tab: 'jornada', usuario: prev, fecha: selectedFecha })
                }
                return prev
              }

              // Si vino initialEmpleadoId y corresponde a un empleado activo, seleccionarlo
              const initialValid =
                initialEmpleadoId &&
                filtered.some((emp) => String(emp.id) === String(initialEmpleadoId))
              if (initialValid) {
                if (onParamsChange) {
                  onParamsChange({ tab: 'jornada', usuario: String(initialEmpleadoId), fecha: selectedFecha })
                }
                return String(initialEmpleadoId)
              }

              // Por defecto, seleccionar el primer empleado activo disponible
              const firstId = String(filtered[0].id)
              if (onParamsChange) {
                onParamsChange({ tab: 'jornada', usuario: firstId, fecha: selectedFecha })
              }
              return firstId
            })
          } else {
            setSelectedEmpId('')
            setJornadaData(null)
          }
        }
      } catch (err) {
        console.error('Error cargando personal para jornada:', err)
      }
    }
    loadStaff()
    return () => {
      isMounted = false
    }
  }, [currentUser?.rol, initialEmpleadoId])

  // Cargar jornada del empleado seleccionado
  const fetchJornada = useCallback(async () => {
    if (!selectedEmpId) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const data = await fetchEmpleadoJornadaApi(selectedEmpId, selectedFecha)
      setJornadaData(data)
    } catch (err) {
      console.error('Error cargando jornada de empleado:', err)
      setErrorMsg(err.message || 'No se pudo cargar la jornada del empleado.')
      setJornadaData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedEmpId, selectedFecha])

  useEffect(() => {
    fetchJornada()
  }, [fetchJornada])

  const empleado = jornadaData?.empleado
  const resumen = jornadaData?.resumen

  const esIlimitado = Boolean(
    jornadaData?.es_ilimitado ||
    resumen?.es_ilimitado ||
    empleado?.es_ilimitado ||
    ['Admin', 'Jefa'].includes(empleado?.rol)
  )

  const turno = jornadaData?.turno_programado || {
    inicio: esIlimitado ? 0 : (empleado?.turnoInicio ?? 7),
    fin: esIlimitado ? 24 : (empleado?.turnoFin ?? 15),
    label: esIlimitado ? 'Acceso ilimitado (00:00 a 23:59:59)' : (empleado?.turnoLabel || empleado?.turno_label || '07:00–15:00'),
    es_ilimitado: esIlimitado,
    esIlimitado
  }
  const bloques = jornadaData?.bloques_actividad || jornadaData?.bloquesActividad || []
  const timeline = jornadaData?.timeline || []

  const totalEventos = resumen?.total_eventos ?? resumen?.totalEventos ?? 0
  const primeraAct = resumen?.primera_act ?? resumen?.primeraAct ?? '—'
  const ultimaAct = resumen?.ultima_act ?? resumen?.ultimaAct ?? '—'
  const cancelaciones = resumen?.cancelaciones ?? 0
  const alertas = resumen?.alertas ?? 0
  const turnoLabel = esIlimitado
    ? 'Acceso ilimitado (24 hs)'
    : (
        resumen?.turno_label ??
        resumen?.turnoLabel ??
        empleado?.turnoLabel ??
        empleado?.turno_label ??
        turno?.label ??
        '—'
      )

  return (
    <div className="empleado-jornada-view" role="region" aria-label="Jornada por empleado">
      {/* 1. Barra de Controles: Selector de Empleado y Fecha */}
      <div className="empleado-jornada__controls-card">
        <div className="empleado-jornada__field">
          <label htmlFor="jornada-emp-select">
            <User size={15} /> Empleado:
          </label>
          <select
            id="jornada-emp-select"
            value={selectedEmpId}
            onChange={(e) => handleEmpChange(e.target.value)}
            className="empleado-jornada__select"
            disabled={personalList.length === 0}
          >
            {personalList.length === 0 ? (
              <option value="">No hay empleados activos disponibles</option>
            ) : (
              personalList.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nombre} ({p.rol}{p.matricula ? ` · Mat: ${p.matricula}` : ''})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="empleado-jornada__field">
          <label htmlFor="jornada-fecha-input">
            <Calendar size={15} /> Fecha:
          </label>
          <input
            id="jornada-fecha-input"
            type="date"
            value={selectedFecha}
            onChange={(e) => handleFechaChange(e.target.value)}
            className="empleado-jornada__date-input"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="empleado-jornada__error-alert" role="alert">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && (
        <div className="empleado-jornada__loading">
          <div className="eventos-table__spinner" aria-hidden="true" />
          <p>Consultando eventos de la jornada...</p>
        </div>
      )}

      {!loading && personalList.length === 0 && !errorMsg && (
        <div className="empleado-jornada__empty-state">
          <p>No se encontraron empleados activos disponibles para consultar su jornada.</p>
        </div>
      )}

      {!loading && personalList.length > 0 && !jornadaData && !errorMsg && (
        <div className="empleado-jornada__empty-state">
          <p>Seleccione un empleado activo para ver el desglose de su jornada laboral.</p>
        </div>
      )}

      {!loading && jornadaData && (
        <>
          {/* 2. Tarjetas de Resumen Diario */}
          <div className="empleado-jornada__kpis-grid">
            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Turno Asignado</span>
              <div className="empleado-jornada__kpi-val">{turnoLabel}</div>
              <span className="empleado-jornada__kpi-sub">Horario contractual</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Primera Actividad</span>
              <div className="empleado-jornada__kpi-val">{primeraAct}</div>
              <span className="empleado-jornada__kpi-sub">Primer registro</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Última Actividad</span>
              <div className="empleado-jornada__kpi-val">{ultimaAct}</div>
              <span className="empleado-jornada__kpi-sub">Cierre de operaciones</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Total Acciones</span>
              <div className="empleado-jornada__kpi-val">{totalEventos}</div>
              <span className="empleado-jornada__kpi-sub">Operaciones auditadas</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Cancelaciones</span>
              <div
                className="empleado-jornada__kpi-val"
                style={{ color: cancelaciones > 0 ? '#b91c1c' : 'inherit' }}
              >
                {cancelaciones}
              </div>
              <span className="empleado-jornada__kpi-sub">Pacientes cancelados</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Alertas</span>
              <div
                className="empleado-jornada__kpi-val"
                style={{ color: alertas > 0 ? '#d97706' : 'inherit' }}
              >
                {alertas}
              </div>
              <span className="empleado-jornada__kpi-sub">Anomalías detectadas</span>
            </div>
          </div>

          {/* 3. Visualización Gráfica SVG */}
          <div className="empleado-jornada__chart-card">
            <h4 className="empleado-jornada__section-title">
              <Activity size={16} /> Mapa Temporal de Actividad
            </h4>
            <ActivityStripSVG
              turnoProgramado={turno}
              bloques={bloques}
              ancho={850}
              alto={95}
              onSelectEvent={onSelectEvent}
            />
          </div>

          {/* 4. Línea de Tiempo Cronológica */}
          <div className="empleado-jornada__timeline-card">
            <h4 className="empleado-jornada__section-title">
              <Clock size={16} /> Registro Cronológico de la Jornada
            </h4>

            {timeline.length === 0 ? (
              <p className="empleado-jornada__empty-timeline">
                No se registraron acciones ni conexiones para este personal en la fecha seleccionada.
              </p>
            ) : (
              <div className="empleado-jornada__timeline-list">
                {timeline.map((item, idx) => {
                  // Caso 1: Pausa / Gap de Inactividad > 30 minutos
                  if (item.tipo === 'gap' || item.tipoGap) {
                    const duracion = item.duracion_min ?? item.minutos ?? 30
                    const rango = item.rango || `${item.desde} – ${item.hasta}`
                    return (
                      <div key={`gap-${item.id || idx}`} className="empleado-jornada__gap-item">
                        <div className="empleado-jornada__gap-icon">
                          <Coffee size={15} />
                        </div>
                        <div className="empleado-jornada__gap-content">
                          <span className="empleado-jornada__gap-title">
                            Pausa de actividad prolongada ({duracion} minutos)
                          </span>
                          <span className="empleado-jornada__gap-time">
                            {rango}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  // Caso 2: Grupo de acciones consecutivas
                  if (item.tipo === 'grupo') {
                    return (
                      <div key={`group-${item.id || idx}`} className="empleado-jornada__group-item">
                        <div className="empleado-jornada__group-badge">
                          <Layers size={14} />
                          <span>{item.cantidad}</span>
                        </div>
                        <div className="empleado-jornada__group-content">
                          <span className="empleado-jornada__group-title">
                            {item.cantidad} acciones consecutivas de &ldquo;{ACCIONES_CATALOGO[item.accion] || item.accion}&rdquo;
                          </span>
                          <span className="empleado-jornada__group-meta">
                            De {item.inicio} a {item.fin} ({item.duracion_min} min de trabajo continuo)
                          </span>
                        </div>
                      </div>
                    )
                  }

                  // Caso 3: Evento Individual
                  const ev = item.evento || item
                  const evId = ev.id || item.eventId || item.id
                  const evCat = ev.categoria || item.categoria || 'gestion'
                  const evAccion = ev.accion || item.accion || 'ACCION'
                  const evRes = ev.resultado || item.resultado || 'EXITO'
                  const evHora = ev.hora || item.hora || (ev.fecha ? formatHora(ev.fecha) : '—')
                  const evDesc = ev.descripcion || item.descripcion || item.titulo || ACCIONES_CATALOGO[evAccion] || evAccion

                  const cat = CATEGORIAS_CONFIG[evCat] || CATEGORIAS_CONFIG.gestion
                  const CatIcon = cat.Icon
                  const isFallo = evRes === 'FALLO'

                  const colorTipo = item.color_tipo || (
                    evAccion.includes('LOGIN') || evAccion === 'LOGOUT' || evCat === 'acceso' ? 'login' :
                    evAccion === 'ATENCION_CANCELADA' ? 'cancelacion' :
                    (ev.alertas?.length > 0 || isFallo) ? 'alerta' :
                    ['admision', 'box'].includes(evCat) || evAccion.includes('TICKET') ? 'ticket' : 'gestion'
                  )

                  return (
                    <div
                      key={`ev-${evId}-${idx}`}
                      className={`empleado-jornada__event-item empleado-jornada__event-item--${colorTipo} ${
                        isFallo ? 'empleado-jornada__event-item--fallo' : ''
                      }`}
                      onClick={() => onSelectEvent(evId)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSelectEvent(evId)
                      }}
                    >
                      <span className="empleado-jornada__event-time">
                        {evHora}
                      </span>

                      <div
                        className="empleado-jornada__event-cat-icon"
                        style={{ color: cat.color, backgroundColor: cat.bg }}
                      >
                        <CatIcon size={14} />
                      </div>

                      <div className="empleado-jornada__event-body">
                        <div className="empleado-jornada__event-title-row">
                          <span className="empleado-jornada__event-title">
                            {ACCIONES_CATALOGO[evAccion] || evAccion}
                          </span>
                          {evRes !== 'EXITO' && (
                            <span className="empleado-jornada__event-res-pill">
                              {evRes}
                            </span>
                          )}
                        </div>
                        <span className="empleado-jornada__event-desc">
                          {evDesc}
                        </span>
                      </div>

                      <ChevronRight size={16} className="empleado-jornada__event-arrow" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
