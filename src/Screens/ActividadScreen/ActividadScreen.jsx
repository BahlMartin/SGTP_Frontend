import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Download,
  RefreshCw,
  ListFilter,
  UserCheck,
  AlertCircle,
  Bell
} from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import { useAuth } from '../../context/AuthContext'
import { useWebSocket } from '../../hooks/useWebSocket'
import {
  fetchEventosAuditoriaApi,
  fetchEventoAuditoriaDetalleApi,
  fetchAuditoriaResumenKpisApi,
  descargarAuditoriaExcelApi
} from '../../services/auditService'

import './actividadTokens.css'
import './ActividadScreen.css'

import ActividadKpis from './components/ActividadKpis'
import AlertasBanner from './components/AlertasBanner'
import FiltrosActividad from './components/FiltrosActividad'
import EventosTable from './components/EventosTable'
import EventDrawer from './components/EventDrawer'
import EmpleadoJornadaView from './components/EmpleadoJornadaView'
import DbUsageIndicator from './components/DbUsageIndicator'
import DbIpAttribution from './components/DbIpAttribution'

export default function ActividadScreen() {
  const { userData: currentUser } = useAuth()
  const isAdmin = currentUser?.rol === 'Admin'
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. Estado de Navegación y Pestañas
  const activeTab = searchParams.get('tab') === 'jornada' ? 'jornada' : 'general'

  // 2. Filtros de la Tabla
  const filtros = useMemo(() => {
    return {
      periodo: searchParams.get('periodo') || 'hoy',
      desde: searchParams.get('desde') || '',
      hasta: searchParams.get('hasta') || '',
      q: searchParams.get('q') || '',
      rol: searchParams.get('rol') || '',
      categoria: searchParams.get('categoria') || '',
      resultado: searchParams.get('resultado') || '',
      solo_alertas: searchParams.get('solo_alertas') === 'true',
      page: Number(searchParams.get('page')) || 1,
      page_size: Number(searchParams.get('page_size')) || 50
    }
  }, [searchParams])

  // 3. Estados de Datos
  const [eventosData, setEventosData] = useState({ count: 0, results: [] })
  const [kpisData, setKpisData] = useState({})
  const [selectedEventId, setSelectedEventId] = useState(
    searchParams.get('evento_id') ? Number(searchParams.get('evento_id')) : null
  )
  const [selectedEventDetail, setSelectedEventDetail] = useState(null)
  const [nuevosEventosPendientes, setNuevosEventosPendientes] = useState([])

  const [loadingTable, setLoadingTable] = useState(false)
  const [loadingExport, setLoadingExport] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Actualizar URL search params helper
  const updateParams = useCallback((newParams) => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev)
      Object.entries(newParams).forEach(([key, val]) => {
        if (val === undefined || val === null || val === '') {
          updated.delete(key)
        } else {
          updated.set(key, String(val))
        }
      })
      return updated
    }, { replace: true })
  }, [setSearchParams])

  // Cargar métricas / KPIs
  const loadKpis = useCallback(async () => {
    try {
      const data = await fetchAuditoriaResumenKpisApi({
        periodo: filtros.periodo,
        desde: filtros.desde,
        hasta: filtros.hasta,
        rol: filtros.rol
      })
      setKpisData(data || {})
    } catch (err) {
      console.warn('Error al cargar KPIs de auditoría:', err)
    }
  }, [filtros.periodo, filtros.desde, filtros.hasta, filtros.rol])

  // Cargar listado de eventos
  const loadEventos = useCallback(async () => {
    setLoadingTable(true)
    setErrorMsg(null)
    try {
      const data = await fetchEventosAuditoriaApi({
        periodo: filtros.periodo,
        desde: filtros.desde,
        hasta: filtros.hasta,
        q: filtros.q,
        rol: filtros.rol,
        categoria: filtros.categoria,
        resultado: filtros.resultado,
        solo_alertas: filtros.solo_alertas,
        page: filtros.page,
        page_size: filtros.page_size
      })
      setEventosData(data || { count: 0, results: [] })
      setNuevosEventosPendientes([])
    } catch (err) {
      console.error('Error al consultar eventos de auditoría:', err)
      setErrorMsg(err.message || 'No se pudieron recuperar los eventos de auditoría.')
    } finally {
      setLoadingTable(false)
    }
  }, [filtros])

  // Cargar detalle del evento seleccionado para el Drawer
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEventDetail(null)
      return
    }

    let isMounted = true
    async function loadDetail() {
      try {
        const detail = await fetchEventoAuditoriaDetalleApi(selectedEventId)
        if (isMounted) setSelectedEventDetail(detail)
      } catch (err) {
        console.error('Error cargando detalle de evento:', err)
      }
    }
    loadDetail()

    return () => {
      isMounted = false
    }
  }, [selectedEventId])

  // Carga inicial y ante cambios de filtros
  useEffect(() => {
    if (activeTab === 'general') {
      loadEventos()
      loadKpis()
    }
  }, [activeTab, loadEventos, loadKpis])

  // =========================================================================
  // 4. Conexión WebSocket en Tiempo Real para Auditoría Operacional
  // =========================================================================
  const handleWsMessage = useCallback((msg) => {
    if (!msg || typeof msg !== 'object') return
    const eventType = msg.event || msg.action

    if (eventType === 'AUDIT_EVENT_CREATED') {
      const nuevoEvento = msg.data
      if (!nuevoEvento || !nuevoEvento.id) return

      // 1. Refrescar contadores KPI en segundo plano
      loadKpis()

      // 2. Determinar si la vista actual puede recibir el evento directamente arriba
      const estaEnVistaHoyLimpia =
        activeTab === 'general' &&
        filtros.periodo === 'hoy' &&
        filtros.page === 1 &&
        !filtros.q &&
        !filtros.rol &&
        !filtros.categoria &&
        !filtros.resultado &&
        !filtros.solo_alertas

      if (estaEnVistaHoyLimpia) {
        setEventosData((prev) => {
          const yaExiste = prev.results.some((e) => e.id === nuevoEvento.id)
          if (yaExiste) return prev
          return {
            count: prev.count + 1,
            results: [nuevoEvento, ...prev.results]
          }
        })
      } else {
        // Si el usuario está en fecha pasada o página > 1 o con filtros, acumular en aviso flotante
        setNuevosEventosPendientes((prev) => {
          if (prev.some((e) => e.id === nuevoEvento.id)) return prev
          return [nuevoEvento, ...prev]
        })
      }
    } else if (eventType === 'AUDIT_EVENT_GEO_UPDATED') {
      const geoData = msg.data
      if (!geoData || !geoData.id) return

      // Actualizar información GPS en la tabla
      setEventosData((prev) => ({
        ...prev,
        results: prev.results.map((ev) =>
          ev.id === geoData.id ? { ...ev, ...geoData } : ev
        )
      }))

      // Si está abierto en el Drawer lateral, actualizarlo en vivo
      setSelectedEventDetail((prev) => {
        if (prev && prev.id === geoData.id) {
          return { ...prev, ...geoData }
        }
        return prev
      })
    }
  }, [activeTab, filtros, loadKpis])

  const { isConnected, isAuthenticated } = useWebSocket('auditoria', {
    onMessage: handleWsMessage,
    autoReconnect: true
  })

  // Handlers de Filtros
  const handleFiltroChange = (partial) => {
    updateParams({
      ...partial,
      page: 1
    })
  }

  const handleResetFiltros = () => {
    updateParams({
      periodo: 'hoy',
      desde: '',
      hasta: '',
      q: '',
      rol: '',
      categoria: '',
      resultado: '',
      solo_alertas: '',
      page: 1
    })
  }

  const handleKpiClick = (filterKey, filterVal) => {
    if (!filterKey) {
      handleResetFiltros()
      return
    }
    const isAlreadyActive = filtros[filterKey] === filterVal
    handleFiltroChange({
      [filterKey]: isAlreadyActive ? '' : filterVal
    })
  }

  const handleVerNuevosEventos = () => {
    handleResetFiltros()
    setNuevosEventosPendientes([])
  }

  // Handlers de Selección en Drawer
  const handleSelectEvent = (id) => {
    setSelectedEventId(id)
    updateParams({ evento_id: id })
  }

  const handleCloseDrawer = () => {
    setSelectedEventId(null)
    setSelectedEventDetail(null)
    updateParams({ evento_id: '' })
  }

  // Navegación Anterior / Siguiente en Drawer
  const currentIndex = eventosData.results.findIndex((e) => e.id === selectedEventId)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < eventosData.results.length - 1

  const handlePrevEvent = () => {
    if (hasPrev) {
      handleSelectEvent(eventosData.results[currentIndex - 1].id)
    }
  }

  const handleNextEvent = () => {
    if (hasNext) {
      handleSelectEvent(eventosData.results[currentIndex + 1].id)
    }
  }

  // Descarga de Excel
  const handleExportarExcel = async () => {
    setLoadingExport(true)
    try {
      await descargarAuditoriaExcelApi({
        periodo: filtros.periodo,
        desde: filtros.desde,
        hasta: filtros.hasta,
        q: filtros.q,
        rol: filtros.rol,
        categoria: filtros.categoria,
        resultado: filtros.resultado,
        solo_alertas: filtros.solo_alertas
      })
    } catch (err) {
      console.error('Error al exportar libro Excel:', err)
      alert('Ocurrió un error al generar la exportación a Excel.')
    } finally {
      setLoadingExport(false)
    }
  }

  return (
    <div className="actividad-screen">
      <Navbar />

      <main className="actividad-screen__main">
        {/* Cabecera Principal */}
        <header className="actividad-screen__header">
          <div className="actividad-screen__header-left">
            <h1 className="actividad-screen__title">
              Actividad del Personal
            </h1>
            <p className="actividad-screen__subtitle">
              Supervisión de accesos, trazabilidad operativa y auditoría de seguridad clínica.
            </p>
          </div>

          <div className="actividad-screen__header-right">
            {isAdmin && <DbUsageIndicator />}

            {/* Indicador de Estado WebSocket En Vivo */}
            <div
              className={`actividad-screen__ws-badge ${
                isConnected && isAuthenticated
                  ? 'actividad-screen__ws-badge--connected'
                  : isConnected
                  ? 'actividad-screen__ws-badge--connecting'
                  : 'actividad-screen__ws-badge--disconnected'
              }`}
              title={
                isConnected && isAuthenticated
                  ? 'Conexión WebSocket activa en tiempo real.'
                  : isConnected
                  ? 'Autenticando canal WebSocket...'
                  : 'WebSocket desconectado. Intentando reconectar...'
              }
            >
              <span className="actividad-screen__ws-dot" />
              <span>
                {isConnected && isAuthenticated
                  ? 'En vivo'
                  : isConnected
                  ? 'Conectando...'
                  : 'Reconectando...'}
              </span>
            </div>

            <button
              type="button"
              className="actividad-screen__btn-tool"
              onClick={() => {
                loadEventos()
                loadKpis()
              }}
              title="Refrescar datos manualmente"
              disabled={loadingTable}
            >
              <RefreshCw size={14} className={loadingTable ? 'actividad-screen__spin-icon' : ''} />
              <span>Refrescar</span>
            </button>

            <button
              type="button"
              className="actividad-screen__btn-export"
              onClick={handleExportarExcel}
              disabled={loadingExport}
              title="Descargar libro Excel con filtros aplicados"
            >
              <Download size={14} />
              <span>{loadingExport ? 'Generando...' : 'Exportar Excel'}</span>
            </button>
          </div>
        </header>

        {/* Selector de Pestañas */}
        <nav className="actividad-screen__tabs-nav" aria-label="Secciones de actividad">
          <button
            type="button"
            className={`actividad-screen__tab-btn ${activeTab === 'general' ? 'actividad-screen__tab-btn--active' : ''}`}
            onClick={() => updateParams({ tab: 'general' })}
          >
            <ListFilter size={16} />
            <span>1. Auditoría General</span>
          </button>

          <button
            type="button"
            className={`actividad-screen__tab-btn ${activeTab === 'jornada' ? 'actividad-screen__tab-btn--active' : ''}`}
            onClick={() => updateParams({ tab: 'jornada' })}
          >
            <UserCheck size={16} />
            <span>2. Jornada por Empleado</span>
          </button>
        </nav>

        {/* Mensaje de Error Global */}
        {errorMsg && (
          <div className="actividad-screen__error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Pestaña 1: Auditoría General */}
        {activeTab === 'general' && (
          <div className="actividad-screen__content-layout">
            <div className="actividad-screen__primary-column">
              {/* KPIs de Cabecera */}
              <ActividadKpis
                kpis={kpisData}
                activeFilter={filtros}
                onKpiClick={handleKpiClick}
              />

              {/* Banner de Alertas */}
              <AlertasBanner
                alertas={kpisData.alertas_recientes || []}
                onSelectEvent={handleSelectEvent}
                onFilterAlerts={() => handleFiltroChange({ solo_alertas: true })}
              />

              {/* Filtros */}
              <FiltrosActividad
                filtros={filtros}
                onFiltroChange={handleFiltroChange}
                onResetFiltros={handleResetFiltros}
                isAdmin={isAdmin}
              />

              {/* Píldora de Nuevos Eventos en Vivo (si el usuario está en página > 1 o filtrando) */}
              {nuevosEventosPendientes.length > 0 && (
                <div className="actividad-screen__new-events-banner">
                  <div className="actividad-screen__new-events-info">
                    <Bell size={16} className="actividad-screen__new-events-icon" />
                    <span>
                      Hay <strong>{nuevosEventosPendientes.length}</strong> evento(s) nuevo(s) registrado(s) en vivo.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="actividad-screen__new-events-btn"
                    onClick={handleVerNuevosEventos}
                  >
                    Ver en tabla ahora
                  </button>
                </div>
              )}

              {/* Tabla de Eventos */}
              <EventosTable
                eventos={eventosData.results || []}
                totalCount={eventosData.count || 0}
                page={filtros.page}
                pageSize={filtros.page_size}
                onPageChange={(newPage) => updateParams({ page: newPage })}
                onPageSizeChange={(newSize) => updateParams({ page_size: newSize, page: 1 })}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
                loading={loadingTable}
              />

              <DbIpAttribution />
            </div>

            {/* Panel Lateral Drawer (Sticky 440px) */}
            {selectedEventId && (
              <EventDrawer
                evento={selectedEventDetail}
                onClose={handleCloseDrawer}
                onPrev={handlePrevEvent}
                onNext={handleNextEvent}
                hasPrev={hasPrev}
                hasNext={hasNext}
              />
            )}
          </div>
        )}

        {/* Pestaña 2: Jornada por Empleado */}
        {activeTab === 'jornada' && (
          <div className="actividad-screen__content-layout">
            <div className="actividad-screen__primary-column">
              <EmpleadoJornadaView
                currentUser={currentUser}
                onSelectEvent={handleSelectEvent}
              />
              <DbIpAttribution />
            </div>

            {/* Panel Lateral Drawer si se selecciona un evento en la jornada */}
            {selectedEventId && (
              <EventDrawer
                evento={selectedEventDetail}
                onClose={handleCloseDrawer}
                onPrev={handlePrevEvent}
                onNext={handleNextEvent}
                hasPrev={hasPrev}
                hasNext={hasNext}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
