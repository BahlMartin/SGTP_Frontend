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
  const rolEmpleado = empleado?.rol || 'Box'

  // Lista de pausas / periodos sin actividad (> 30 min) para la linea de tiempo y fallback
  const gapsList = useMemo(() => {
    if (jornadaData?.gaps && Array.isArray(jornadaData.gaps) && jornadaData.gaps.length > 0) {
      return jornadaData.gaps
    }
    return (jornadaData?.timeline || [])
      .filter((item) => item.tipo === 'gap' || item.tipoGap)
      .map((g) => {
        let inicio = g.inicio_hora ?? g.inicio
        let fin = g.fin_hora ?? g.fin
        if (inicio === undefined && g.desde) {
          const [dh, dm] = g.desde.split(':').map(Number)
          inicio = Math.round(((dh || 0) + (dm || 0) / 60) * 100) / 100
        }
        if (fin === undefined && g.hasta) {
          const [hh, hm] = g.hasta.split(':').map(Number)
          fin = Math.round(((hh || 0) + (hm || 0) / 60) * 100) / 100
        }
        return {
          ...g,
          inicio,
          fin,
          inicio_hora: inicio,
          fin_hora: fin
        }
      })
  }, [jornadaData])

  // Determinar pestañas temáticas permitidas según el rol del empleado auditado
  const filterTabs = useMemo(() => {
    // 1. Admin y Jefa: no tienen box ni cancelaciones operacionales
    if (['Admin', 'Jefa'].includes(rolEmpleado)) {
      return [
        { key: 'todo', label: 'Todo' },
        { key: 'acceso', label: 'Solo acceso' },
        { key: 'alertas', label: 'Solo alertas' },
        { key: 'gestion', label: 'Solo gestión' }
      ]
    }

    // 2. Secretaria: reportes y correos, sin box ni cancelaciones
    if (rolEmpleado === 'Secretaria') {
      return [
        { key: 'todo', label: 'Todo' },
        { key: 'acceso', label: 'Solo acceso' },
        { key: 'reportes', label: 'Solo exportación / correos' },
        { key: 'alertas', label: 'Solo alertas' }
      ]
    }

    // 3. Admisión: 'Solo admisión' en vez de 'Solo box', cancelaciones y alertas
    if (rolEmpleado === 'Admision') {
      return [
        { key: 'todo', label: 'Todo' },
        { key: 'acceso', label: 'Solo acceso' },
        { key: 'admision', label: 'Solo admisión' },
        { key: 'cancelaciones', label: 'Solo cancelaciones' },
        { key: 'alertas', label: 'Solo alertas' }
      ]
    }

    // 4. Box / Técnico: Solo box, cancelaciones y alertas
    return [
      { key: 'todo', label: 'Todo' },
      { key: 'acceso', label: 'Solo acceso' },
      { key: 'box', label: 'Solo box' },
      { key: 'cancelaciones', label: 'Solo cancelaciones' },
      { key: 'alertas', label: 'Solo alertas' }
    ]
  }, [rolEmpleado])

  // Resetear a 'todo' si la categoría actual no pertenece al rol
  useEffect(() => {
    if (!filterTabs.some((t) => t.key === filterCategory)) {
      setFilterCategory('todo')
    }
  }, [filterTabs, filterCategory])

  // Filtrado de la línea de tiempo por barra seleccionada y por categoría
  const filteredTimeline = useMemo(() => {
    let list = Array.isArray(timeline) ? [...timeline] : []

    // 1. Filtrar por barra horaria seleccionada en el gráfico
    if (selectedBar && selectedBar.event_ids) {
      const selectedEventIds = new Set(
        (selectedBar.event_ids || []).map((id) => Number(id))
      )
      list = list.filter((item) => {
        // Al hacer click en un bloque de actividad, solo mostramos los registros de ese bloque (no las pausas prolongadas)
        if (item.tipo === 'gap' || item.tipoGap) {
          return false
        }
        if (item.tipo === 'grupo') {
          return (item.event_ids || []).some((id) => selectedEventIds.has(Number(id)))
        }
        const rawId =
          item.eventId ??
          item.evento?.id ??
          (typeof item.id === 'string' && item.id.startsWith('ev-')
            ? item.id.replace('ev-', '')
            : item.id)
        const evId = rawId != null ? Number(rawId) : null
        return evId != null && selectedEventIds.has(evId)
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
        if (filterCategory === 'admision') {
          return (
            colorTipo === 'admision' ||
            colorTipo === 'cancelacion' ||
            evCat === 'admision' ||
            evAccion.includes('TICKET') ||
            evAccion.includes('OCR') ||
            evAccion.includes('RECETA') ||
            evAccion.includes('PACIENTE') ||
            evAccion.includes('CANCEL')
          )
        }
        if (filterCategory === 'box') {
          return (
            colorTipo === 'ticket' ||
            colorTipo === 'box' ||
            evCat === 'box' ||
            evAccion.includes('BOX') ||
            evAccion.includes('LLAMADO') ||
            evAccion.includes('ATENCION')
          )
        }
        if (filterCategory === 'reportes') {
          return (
            evCat === 'reportes' ||
            evAccion.includes('REPORTE') ||
            evAccion.includes('EXPORT') ||
            evAccion.includes('ENVIO')
          )
        }
        if (filterCategory === 'gestion') {
          return (
            evCat === 'gestion' ||
            evCat === 'sla' ||
            evAccion.includes('USUARIO') ||
            evAccion.includes('HABILITACION') ||
            evAccion.includes('SLA')
          )
        }
        if (filterCategory === 'cancelaciones') {
          return (
            colorTipo === 'cancelacion' ||
            evAccion === 'ATENCION_CANCELADA' ||
            evAccion.includes('CANCEL')
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
        return true
      })
    }

    // 3. Ordenar los registros desde el más nuevo al más viejo
    return [...list].sort((a, b) => {
      const getTimestamp = (item) => {
        const ev = item.evento || item
        if (ev.fecha) {
          const t = new Date(ev.fecha).getTime()
          if (!isNaN(t)) return t
        }
        // Para pausas (gaps) u operaciones sin fecha completa, ordenar por hora (hasta o desde)
        const horaStr = item.hasta || item.hora || ev.hora || item.desde || ''
        if (horaStr && typeof horaStr === 'string' && horaStr.includes(':')) {
          const [h, m, s] = horaStr.split(':').map(Number)
          return (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
        }
        return 0
      }
      return getTimestamp(b) - getTimestamp(a)
    })
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
              gaps={gapsList}
              selectedBar={selectedBar}
              onSelectBar={setSelectedBar}
            />
          </div>

          {/* 4. Línea de Tiempo Cronológica con Filtros */}
          <div className="empleado-jornada__timeline-card">
            <h4 className="empleado-jornada__section-title">
              <Clock size={16} /> Registro Cronológico de la Jornada
            </h4>

            {/* Selector de Filtros estilo Tablist dinámico según el rol */}
            <div
              role="tablist"
              aria-label="Filtrar eventos de la jornada"
              className="empleado-jornada__filter-tabs"
            >
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={filterCategory === tab.key}
                  className={`empleado-jornada__filter-tab-btn ${
                    filterCategory === tab.key ? 'empleado-jornada__filter-tab-btn--active' : ''
                  }`}
                  onClick={() => setFilterCategory(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
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
                  const isGap = item.tipo === 'gap' || item.tipoGap
                  const ev = item.evento || item
                  const rawId = item.eventId ?? ev.id ?? item.id
                  const evId = typeof rawId === 'string' && rawId.startsWith('ev-')
                    ? Number(rawId.replace('ev-', ''))
                    : (rawId != null && !isNaN(Number(rawId)) ? Number(rawId) : rawId)
                  const evHora = isGap
                    ? (item.desde || item.hora || '—')
                    : (ev.hora || item.hora || (ev.fecha ? formatHora(ev.fecha) : '—'))

                  return (
                    <li
                      key={`tl-${item.id || evId || idx}`}
                      className={`empleado-jornada__timeline-row ${isGap ? 'empleado-jornada__timeline-row--gap' : ''}`}
                      onClick={() => !isGap && evId && onSelectEvent(evId)}
                      title={isGap ? `${v.title} (${v.sub})` : 'Click para inspeccionar evento en el panel lateral'}
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
  if (iconName === 'admision') {
    // Clipboard checklist de admisión / ticket creado
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
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M9 14h6" />
        <path d="M12 11v6" />
      </svg>
    )
  }
  if (iconName === 'scan') {
    // Documento / Escaneo OCR
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    )
  }
  if (iconName === 'reportes' || iconName === 'mail') {
    // Exportación de reporte / despacho de correo institucional
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
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
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
  const isAdmision =
    evCat === 'admision' ||
    evAccion.includes('TICKET') ||
    evAccion.includes('OCR') ||
    evAccion.includes('RECETA') ||
    evAccion.includes('PACIENTE')
  const isReporte =
    evCat === 'reportes' ||
    evAccion.includes('REPORTE') ||
    evAccion.includes('EXPORT') ||
    evAccion.includes('ENVIO')

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

  if (isAdmision) {
    const isOcr = evAccion.includes('OCR') || evAccion === 'RECETA_ESCANEADA'
    return {
      icon: isOcr ? 'scan' : 'admision',
      fg: '#0f766e',
      bg: '#e6f4f2',
      titleColor: '#0f766e',
      title: ACCIONES_CATALOGO[evAccion] || evAccion,
      sub: evDesc,
      tag: isOcr ? 'Escaneo OCR' : 'Admisión',
      tagType: 'admision'
    }
  }

  if (isReporte) {
    return {
      icon: 'reportes',
      fg: '#334155',
      bg: '#e8ecf1',
      titleColor: '#334155',
      title: ACCIONES_CATALOGO[evAccion] || evAccion,
      sub: evDesc,
      tag: 'Reporte / Correo',
      tagType: 'reportes'
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

