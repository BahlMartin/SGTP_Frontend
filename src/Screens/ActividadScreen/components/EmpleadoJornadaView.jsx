import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  const [selectedBar, setSelectedBar] = useState(null)
  const [filterCategory, setFilterCategory] = useState('todo') // 'todo', 'acceso', 'box', 'alertas', 'cancelaciones'
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Handlers sincronizados
  const handleEmpChange = (empId) => {
    setSelectedEmpId(empId)
    setSelectedBar(null)
    try {
      sessionStorage.setItem('sgtp_jornada_empleado_id', empId)
    } catch {}
    if (onParamsChange) {
      onParamsChange({ tab: 'jornada', usuario: empId, fecha: selectedFecha })
    }
  }

  const handleFechaChange = (fechaVal) => {
    setSelectedFecha(fechaVal)
    setSelectedBar(null)
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
              if (currentValid) return prev

              // Si vino initialEmpleadoId y corresponde a un empleado activo, seleccionarlo
              const initialValid =
                initialEmpleadoId &&
                filtered.some((emp) => String(emp.id) === String(initialEmpleadoId))
              if (initialValid) return String(initialEmpleadoId)

              // Por defecto, seleccionar el primer empleado activo disponible
              return String(filtered[0].id)
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

  // Filtrado de la línea de tiempo por barra seleccionada y por categoría
  const filteredTimeline = useMemo(() => {
    let list = timeline

    // 1. Filtrar por barra horaria seleccionada en el gráfico
    if (selectedBar && selectedBar.event_ids) {
      list = list.filter((item) => {
        if (item.tipo === 'gap' || item.tipoGap) {
          const gIni = item.inicio_hora ?? item.inicio ?? 0
          const gFin = item.fin_hora ?? item.fin ?? 24
          return gIni < selectedBar.fin && gFin > selectedBar.inicio
        }
        if (item.tipo === 'grupo') {
          return selectedBar.event_ids.some((id) => (item.event_ids || []).includes(id))
        }
        const evId = item.id || item.evento?.id || item.eventId
        return selectedBar.event_ids.includes(evId)
      })
    }

    // 2. Filtrar por categoría temática de la pestaña
    if (filterCategory !== 'todo') {
      list = list.filter((item) => {
        if (item.tipo === 'gap' || item.tipoGap) {
          return filterCategory === 'alertas'
        }
        const ev = item.evento || item
        const evCat = ev.categoria || item.categoria || ''
        const evAccion = ev.accion || item.accion || ''
        const evRes = ev.resultado || item.resultado || ''
        const colorTipo = item.color_tipo || ''

        if (filterCategory === 'acceso') {
          return (
            colorTipo === 'login' ||
            evCat === 'acceso' ||
            evAccion.includes('LOGIN') ||
            evAccion.includes('LOGOUT')
          )
        }
        if (filterCategory === 'box') {
          return (
            colorTipo === 'ticket' ||
            ['box', 'admision'].includes(evCat) ||
            evAccion.includes('TICKET') ||
            evAccion.includes('TURNO') ||
            evAccion.includes('LLAMADO') ||
            evAccion.includes('ATENCION')
          )
        }
        if (filterCategory === 'alertas') {
          return (
            colorTipo === 'alerta' ||
            (ev.alertas && ev.alertas.length > 0) ||
            evRes === 'FALLO' ||
            evRes === 'DENEGADO'
          )
        }
        if (filterCategory === 'cancelaciones') {
          return (
            colorTipo === 'cancelacion' ||
            evAccion === 'ATENCION_CANCELADA' ||
            evAccion.includes('CANCEL')
          )
        }
        return true
      })
    }

    return list
  }, [timeline, selectedBar, filterCategory])

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

          {/* 3. Visualización Gráfica: Turno vs. Actividad (Barras interactivas de 15m) */}
          <div className="empleado-jornada__chart-card">
            <ActivityStripSVG
              turnoProgramado={turno}
              barras={jornadaData?.barras_actividad || []}
              gaps={jornadaData?.gaps || []}
              selectedBar={selectedBar}
              onSelectBar={setSelectedBar}
            />
          </div>

          {/* 4. Línea de Tiempo Cronológica con Filtros */}
          <div className="empleado-jornada__timeline-card">
            <h4 className="empleado-jornada__section-title">
              <Clock size={16} /> Registro Cronológico de la Jornada
            </h4>

            {/* Selector de Filtros estilo Tablist */}
            <div
              role="tablist"
              aria-label="Filtrar eventos de la jornada"
              className="empleado-jornada__filter-tabs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={filterCategory === 'todo'}
                className={`empleado-jornada__filter-tab-btn ${
                  filterCategory === 'todo' ? 'empleado-jornada__filter-tab-btn--active' : ''
                }`}
                onClick={() => setFilterCategory('todo')}
              >
                Todo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterCategory === 'acceso'}
                className={`empleado-jornada__filter-tab-btn ${
                  filterCategory === 'acceso' ? 'empleado-jornada__filter-tab-btn--active' : ''
                }`}
                onClick={() => setFilterCategory('acceso')}
              >
                Solo acceso
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterCategory === 'box'}
                className={`empleado-jornada__filter-tab-btn ${
                  filterCategory === 'box' ? 'empleado-jornada__filter-tab-btn--active' : ''
                }`}
                onClick={() => setFilterCategory('box')}
              >
                Solo box
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterCategory === 'alertas'}
                className={`empleado-jornada__filter-tab-btn ${
                  filterCategory === 'alertas' ? 'empleado-jornada__filter-tab-btn--active' : ''
                }`}
                onClick={() => setFilterCategory('alertas')}
              >
                Solo alertas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterCategory === 'cancelaciones'}
                className={`empleado-jornada__filter-tab-btn ${
                  filterCategory === 'cancelaciones' ? 'empleado-jornada__filter-tab-btn--active' : ''
                }`}
                onClick={() => setFilterCategory('cancelaciones')}
              >
                Solo cancelaciones
              </button>
            </div>

            {/* Aviso de filtrado activo por intervalo de barra */}
            {selectedBar && (
              <div className="empleado-jornada__bar-filter-banner">
                <span>
                  Mostrando únicamente eventos del intervalo{' '}
                  <strong>{selectedBar.rango || selectedBar.hora_label}</strong> ({selectedBar.count}{' '}
                  evento(s))
                </span>
                <button
                  type="button"
                  className="empleado-jornada__bar-filter-clear-btn"
                  onClick={() => setSelectedBar(null)}
                >
                  Limpiar filtro ✕
                </button>
              </div>
            )}

            {filteredTimeline.length === 0 ? (
              <p className="empleado-jornada__empty-timeline">
                No se registraron eventos para los filtros seleccionados.
              </p>
            ) : (
              <ol className="empleado-jornada__timeline-ol">
                {filteredTimeline.map((item, idx) => {
                  const v = getEventVisualProps(item)
                  const ev = item.evento || item
                  const evId = ev.id || item.eventId || item.id
                  const evHora = ev.hora || item.hora || (ev.fecha ? formatHora(ev.fecha) : '—')

                  return (
                    <li
                      key={`tl-${evId || idx}`}
                      className="empleado-jornada__timeline-row"
                      onClick={() => evId && onSelectEvent(evId)}
                      title="Click para inspeccionar evento en el panel lateral"
                    >
                      <time className="empleado-jornada__timeline-time">{evHora}</time>
                      <div className="empleado-jornada__timeline-line-col">
                        <span
                          className="empleado-jornada__timeline-icon-badge"
                          style={{ color: v.fg, backgroundColor: v.bg }}
                        >
                          <TimelineSvgIcon iconName={v.icon} />
                        </span>
                        <span className="empleado-jornada__timeline-connector" />
                      </div>
                      <div className="empleado-jornada__timeline-content">
                        <span
                          className="empleado-jornada__timeline-title"
                          style={{ color: v.titleColor }}
                        >
                          {v.title}
                        </span>
                        {v.sub && (
                          <span className="empleado-jornada__timeline-sub">
                            · {v.sub}
                          </span>
                        )}
                        {v.tag && (
                          <span
                            className={`empleado-jornada__timeline-tag ${
                              v.tagType === 'cancel'
                                ? 'empleado-jornada__timeline-tag--cancel'
                                : 'empleado-jornada__timeline-tag--alerta'
                            }`}
                          >
                            {v.tag}
                          </span>
                        )}
                        {item.tipo === 'grupo' && (
                          <button
                            type="button"
                            className="empleado-jornada__timeline-group-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (item.evento_id || evId) onSelectEvent(item.evento_id || evId)
                            }}
                          >
                            Ver los {item.cantidad} ▸
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TimelineSvgIcon({ iconName }) {
  if (iconName === 'key') {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15.5 7.5a4 4 0 1 1-1 2.6L4 20v-3h3v-2h2l2.5-2.5" />
      </svg>
    )
  }
  if (iconName === 'box') {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2 M8.5 2h7 M14.5 16h-5" />
      </svg>
    )
  }
  if (iconName === 'ban') {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
      </svg>
    )
  }
  if (iconName === 'alert') {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01" />
      </svg>
    )
  }
  // gap / reloj
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function getEventVisualProps(item) {
  if (item.tipo === 'gap' || item.tipoGap) {
    return {
      icon: 'gap',
      fg: '#566d79',
      bg: '#f4f8fb',
      titleColor: '#566d79',
      title: `Pausa prolongada (${item.duracion_min ?? item.minutos ?? 30} min)`,
      sub: item.rango || `${item.desde} – ${item.hasta}`,
      tag: 'Sin actividad',
      tagType: 'alerta'
    }
  }

  if (item.tipo === 'grupo') {
    return {
      icon: 'box',
      fg: '#1687c9',
      bg: '#e0f2fe',
      titleColor: '#275369',
      title: `${item.cantidad} acciones consecutivas: ${ACCIONES_CATALOGO[item.accion] || item.accion}`,
      sub: `De ${item.inicio} a ${item.fin} (${item.duracion_min} min de trabajo continuo)`,
      tag: `${item.cantidad} acciones`,
      tagType: 'info'
    }
  }

  const ev = item.evento || item
  const evCat = ev.categoria || item.categoria || 'gestion'
  const evAccion = ev.accion || item.accion || 'ACCION'
  const evRes = ev.resultado || item.resultado || 'EXITO'
  const evDesc = ev.descripcion || item.descripcion || item.titulo || ACCIONES_CATALOGO[evAccion] || evAccion
  const isFallo = evRes === 'FALLO' || evRes === 'DENEGADO'
  const isCancel = evAccion === 'ATENCION_CANCELADA' || evAccion.includes('CANCEL')
  const isAlerta = (ev.alertas && ev.alertas.length > 0) || isFallo
  const isAcceso = evCat === 'acceso' || evAccion.includes('LOGIN') || evAccion.includes('LOGOUT')

  if (isCancel) {
    return {
      icon: 'ban',
      fg: '#dc2626',
      bg: '#fee2e2',
      titleColor: '#991b1b',
      title: ACCIONES_CATALOGO[evAccion] || evAccion,
      sub: evDesc,
      tag: 'Cancelación',
      tagType: 'cancel'
    }
  }

  if (isAlerta) {
    return {
      icon: 'alert',
      fg: '#92400e',
      bg: '#fdf3e7',
      titleColor: '#92400e',
      title: ACCIONES_CATALOGO[evAccion] || evAccion,
      sub: evDesc,
      tag: isFallo ? 'Fallo' : 'Alerta',
      tagType: 'alerta'
    }
  }

  if (isAcceso) {
    return {
      icon: 'key',
      fg: '#4338ca',
      bg: '#eef0fd',
      titleColor: '#275369',
      title: ACCIONES_CATALOGO[evAccion] || evAccion,
      sub: evDesc,
      tag: evAccion === 'LOGIN_EXITOSO' ? 'Inicio de sesión' : '',
      tagType: 'acceso'
    }
  }

  return {
    icon: 'box',
    fg: '#be185d',
    bg: '#fbe8f1',
    titleColor: '#275369',
    title: ACCIONES_CATALOGO[evAccion] || evAccion,
    sub: evDesc,
    tag: '',
    tagType: 'box'
  }
}

