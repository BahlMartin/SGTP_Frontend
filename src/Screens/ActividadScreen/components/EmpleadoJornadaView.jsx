import React, { useState, useEffect, useCallback } from 'react'
import {
  User,
  Calendar,
  Clock,
    AlertTriangle,
  Activity,
  Layers,
  ChevronRight,
  Coffee,
      } from 'lucide-react'
import { fetchEmpleadoJornadaApi } from '../../../services/auditService'
import { fetchAllStaffApi } from '../../../services/userService'
import ActivityStripSVG from './ActivityStripSVG'
import {
  CATEGORIAS_CONFIG,
    ACCIONES_CATALOGO,
  } from '../constants/auditoriaConstants'
import './EmpleadoJornadaView.css'

export default function EmpleadoJornadaView({
  currentUser,
  onSelectEvent,
  initialEmpleadoId = null
}) {
  const [personalList, setPersonalList] = useState([])
  const [selectedEmpId, setSelectedEmpId] = useState(initialEmpleadoId || '')
  const [selectedFecha, setSelectedFecha] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [jornadaData, setJornadaData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Cargar lista de empleados permitidos (Jefa no ve Admins)
  useEffect(() => {
    async function loadStaff() {
      try {
        const staff = await fetchAllStaffApi(false)
        const filtered = staff.filter((u) => {
          if (currentUser?.rol === 'Jefa' && u.rol === 'Admin') return false
          return true
        })
        setPersonalList(filtered)
        if (!selectedEmpId && filtered.length > 0) {
          setSelectedEmpId(filtered[0].id)
        }
      } catch (err) {
        console.error('Error cargando personal para jornada:', err)
      }
    }
    loadStaff()
  }, [currentUser?.rol, selectedEmpId])

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

    const resumen = jornadaData?.resumen
  const turno = jornadaData?.turno_programado
  const bloques = jornadaData?.bloques_actividad || []
  const timeline = jornadaData?.timeline || []

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
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="empleado-jornada__select"
          >
            {personalList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.rol}{p.matricula ? ` · Mat: ${p.matricula}` : ''})
              </option>
            ))}
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
            onChange={(e) => setSelectedFecha(e.target.value)}
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

      {!loading && jornadaData && (
        <>
          {/* 2. Tarjetas de Resumen Diario */}
          <div className="empleado-jornada__kpis-grid">
            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Turno Asignado</span>
              <div className="empleado-jornada__kpi-val">{resumen?.turno_label || '—'}</div>
              <span className="empleado-jornada__kpi-sub">Horario contractual</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Primera Actividad</span>
              <div className="empleado-jornada__kpi-val">{resumen?.primera_act || '—'}</div>
              <span className="empleado-jornada__kpi-sub">Primer registro</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Última Actividad</span>
              <div className="empleado-jornada__kpi-val">{resumen?.ultima_act || '—'}</div>
              <span className="empleado-jornada__kpi-sub">Cierre de operaciones</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Total Acciones</span>
              <div className="empleado-jornada__kpi-val">{resumen?.total_eventos ?? 0}</div>
              <span className="empleado-jornada__kpi-sub">Operaciones auditadas</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Cancelaciones</span>
              <div className="empleado-jornada__kpi-val" style={{ color: (resumen?.cancelaciones ?? 0) > 0 ? '#b91c1c' : 'inherit' }}>
                {resumen?.cancelaciones ?? 0}
              </div>
              <span className="empleado-jornada__kpi-sub">Pacientes cancelados</span>
            </div>

            <div className="empleado-jornada__kpi-card">
              <span className="empleado-jornada__kpi-title">Alertas</span>
              <div className="empleado-jornada__kpi-val" style={{ color: (resumen?.alertas ?? 0) > 0 ? '#d97706' : 'inherit' }}>
                {resumen?.alertas ?? 0}
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
                  if (item.tipo === 'gap') {
                    return (
                      <div key={`gap-${idx}`} className="empleado-jornada__gap-item">
                        <div className="empleado-jornada__gap-icon">
                          <Coffee size={15} />
                        </div>
                        <div className="empleado-jornada__gap-content">
                          <span className="empleado-jornada__gap-title">
                            Pausa de actividad prolongada ({item.duracion_min} minutos)
                          </span>
                          <span className="empleado-jornada__gap-time">
                            Desde {item.desde} hasta {item.hasta}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  // Caso 2: Grupo de acciones consecutivas
                  if (item.tipo === 'grupo') {
                    return (
                      <div key={`group-${idx}`} className="empleado-jornada__group-item">
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
                  const ev = item.evento
                  if (!ev) return null

                  const cat = CATEGORIAS_CONFIG[ev.categoria] || CATEGORIAS_CONFIG.gestion
                  const CatIcon = cat.Icon
                  const isFallo = ev.resultado === 'FALLO'

                  return (
                    <div
                      key={`ev-${ev.id}`}
                      className={`empleado-jornada__event-item ${
                        isFallo ? 'empleado-jornada__event-item--fallo' : ''
                      }`}
                      onClick={() => onSelectEvent(ev.id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSelectEvent(ev.id)
                      }}
                    >
                      <span className="empleado-jornada__event-time">
                        {ev.hora || ev.fecha?.slice(11, 16)}
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
                            {ACCIONES_CATALOGO[ev.accion] || ev.accion}
                          </span>
                          {ev.resultado !== 'EXITO' && (
                            <span className="empleado-jornada__event-res-pill">
                              {ev.resultado}
                            </span>
                          )}
                        </div>
                        <span className="empleado-jornada__event-desc">
                          {ev.descripcion}
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
