import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  ArrowUpRight,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
  Mail,
  Search,
  User,
  UserPlus
} from 'lucide-react'
import { MESES_NOMBRES } from '../../../JefaScreen/hooks/useMonthlyOvertimePlanning'
import { DIAS_SEMANA_LETRAS } from '../../../../utils/shiftValidation.utils'
import './SecretariaJornadaBar.css'

function formatIsoToDisplay(isoStr) {
  if (!isoStr) return ''
  const clean = String(isoStr).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length !== 3) return clean
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function calcularLimitesSemana(fechaStr) {
  if (!fechaStr) return null
  const [y, m, d] = String(fechaStr).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const fechaObj = new Date(y, m - 1, d)
  const diaSemanaNum = fechaObj.getDay() === 0 ? 6 : fechaObj.getDay() - 1 // 0=Lun, 6=Dom
  const lunesObj = new Date(fechaObj)
  lunesObj.setDate(fechaObj.getDate() - diaSemanaNum)
  const domingoObj = new Date(lunesObj)
  domingoObj.setDate(lunesObj.getDate() + 6)

  const formatStr = (dt) => {
    const dy = dt.getFullYear()
    const dm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return `${dy}-${dm}-${dd}`
  }

  const formatCorto = (dt) => {
    const dd = String(dt.getDate()).padStart(2, '0')
    const dm = String(dt.getMonth() + 1).padStart(2, '0')
    return `${dd}/${dm}`
  }

  return {
    fechaReferencia: String(fechaStr).slice(0, 10),
    lunesStr: formatStr(lunesObj),
    domingoStr: formatStr(domingoObj),
    lunesCorto: formatCorto(lunesObj),
    domingoCorto: formatCorto(domingoObj)
  }
}

export default function SecretariaJornadaBar({
  jornadaDate,
  jornadaEndDate,
  periodMode = 'dia',
  onDateChange,
  onApplyPeriod,
  onExportPdf,
  onExportExcel,
  onSendEmail,
  onOpenThirdPartyEmailModal,
  userEmail = '',
  isSendingEmail = false
}) {
  const effectiveEndDate = jornadaEndDate || jornadaDate
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isEmailMenuOpen, setIsEmailMenuOpen] = useState(false)

  const calendarContainerRef = useRef(null)
  const menuContainerRef = useRef(null)

  // Inicializar mes/año del calendario según la fecha activa
  const initialDateParts = useMemo(() => {
    const base = String(jornadaDate || '').slice(0, 10).split('-').map(Number)
    const now = new Date()
    return {
      year: base[0] || now.getFullYear(),
      month: base[1] || now.getMonth() + 1
    }
  }, [jornadaDate])

  const [anio, setAnio] = useState(initialDateParts.year)
  const [mes, setMes] = useState(initialDateParts.month)

  // modoSeleccion dentro del calendario: 'dia' | 'semana' | 'mes' | 'rango'
  const [modoSeleccion, setModoSeleccion] = useState(periodMode || 'dia')
  const [fechaSeleccionada, setFechaSeleccionada] = useState(jornadaDate)
  const [fechaSemanaBase, setFechaSemanaBase] = useState(jornadaDate)
  const [pasoRango, setPasoRango] = useState('desde') // 'desde' | 'hasta'
  const [rangoDesde, setRangoDesde] = useState(jornadaDate)
  const [rangoHasta, setRangoHasta] = useState(effectiveEndDate)

  // Sincronizar estado interno al abrir el calendario
  const handleToggleCalendar = () => {
    if (!isCalendarOpen) {
      const [y, m] = String(jornadaDate || '').slice(0, 10).split('-').map(Number)
      if (y && m) {
        setAnio(y)
        setMes(m)
      }
      setModoSeleccion(periodMode || 'dia')
      setFechaSeleccionada(jornadaDate)
      setFechaSemanaBase(jornadaDate)
      setRangoDesde(jornadaDate)
      setRangoHasta(effectiveEndDate)
      setPasoRango('desde')
    }
    setIsCalendarOpen((prev) => !prev)
  }

  // Cerrar desplegables al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!isCalendarOpen && !isEmailMenuOpen) return

    function handleClickOutside(event) {
      if (
        isCalendarOpen &&
        calendarContainerRef.current &&
        !calendarContainerRef.current.contains(event.target)
      ) {
        setIsCalendarOpen(false)
      }
      if (
        isEmailMenuOpen &&
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target)
      ) {
        setIsEmailMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsCalendarOpen(false)
        setIsEmailMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCalendarOpen, isEmailMenuOpen])

  // Límites del mes en vista
  const limitesMesActual = useMemo(() => {
    const mesStr = String(mes).padStart(2, '0')
    const ultimoDia = new Date(anio, mes, 0).getDate()
    const desdeMes = `${anio}-${mesStr}-01`
    const hastaMes = `${anio}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`
    return { desdeMes, hastaMes, ultimoDia }
  }, [anio, mes])

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
    const mesStr = String(nuevoMes).padStart(2, '0')
    const primerDiaMes = `${nuevoAnio}-${mesStr}-01`
    const ultimoDia = new Date(nuevoAnio, nuevoMes, 0).getDate()
    const ultimoDiaMes = `${nuevoAnio}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`

    if (modoSeleccion === 'semana') {
      setFechaSemanaBase(primerDiaMes)
    } else if (modoSeleccion === 'mes') {
      setRangoDesde(primerDiaMes)
      setRangoHasta(ultimoDiaMes)
    }
  }

  // Generar grilla limpia del mes (sin lógica de turnos ni revocados)
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
      const esFinDeSemana = diaSemanaNum >= 5

      celdas.push({
        dia: d,
        fechaStr,
        esFinDeSemana
      })
    }
    return celdas
  }, [anio, mes])

  // Semanas del mes (Lunes a Domingo)
  const semanasDelMes = useMemo(() => {
    const mapaSemanas = new Map()
    celdasCalendario.forEach((celda) => {
      if (!celda.fechaStr) return
      const infoSem = calcularLimitesSemana(celda.fechaStr)
      if (!infoSem) return
      const key = infoSem.lunesStr
      if (!mapaSemanas.has(key)) {
        mapaSemanas.set(key, {
          ...infoSem,
          diasEnMes: []
        })
      }
      mapaSemanas.get(key).diasEnMes.push(celda.fechaStr)
    })
    return Array.from(mapaSemanas.values()).map((sem, idx) => ({
      ...sem,
      numeroSemana: idx + 1,
      fechaReferencia: sem.diasEnMes[0]
    }))
  }, [celdasCalendario])

  const semanaActivaInfo = useMemo(() => {
    const base =
      fechaSemanaBase ||
      fechaSeleccionada ||
      `${anio}-${String(mes).padStart(2, '0')}-01`
    return calcularLimitesSemana(base)
  }, [fechaSemanaBase, fechaSeleccionada, anio, mes])

  const emitPeriodUpdate = (desdeStr, hastaStr, mode) => {
    if (onApplyPeriod) {
      onApplyPeriod(desdeStr, hastaStr, mode)
    } else if (onDateChange) {
      onDateChange(desdeStr)
    }
    setIsCalendarOpen(false)
  }

  // Botones de cambio de modo
  const activarModoDia = () => {
    setModoSeleccion('dia')
  }

  const activarModoMes = () => {
    setModoSeleccion('mes')
    setRangoDesde(limitesMesActual.desdeMes)
    setRangoHasta(limitesMesActual.hastaMes)
  }

  const activarModoSemana = () => {
    const inicial =
      fechaSeleccionada ||
      `${anio}-${String(mes).padStart(2, '0')}-01`
    setFechaSemanaBase(inicial)
    setModoSeleccion('semana')
  }

  const activarModoRango = () => {
    setModoSeleccion('rango')
    setPasoRango('desde')
  }

  // Click sobre una celda del calendario según el modo
  const handleCellClick = (celda) => {
    if (!celda?.fechaStr) return
    setFechaSeleccionada(celda.fechaStr)

    if (modoSeleccion === 'dia') {
      emitPeriodUpdate(celda.fechaStr, celda.fechaStr, 'dia')
    } else if (modoSeleccion === 'semana') {
      setFechaSemanaBase(celda.fechaStr)
    } else if (modoSeleccion === 'mes') {
      setModoSeleccion('dia')
      emitPeriodUpdate(celda.fechaStr, celda.fechaStr, 'dia')
    } else if (modoSeleccion === 'rango') {
      if (pasoRango === 'desde') {
        setRangoDesde(celda.fechaStr)
        setRangoHasta(celda.fechaStr)
        setPasoRango('hasta')
      } else {
        if (celda.fechaStr < rangoDesde) {
          setRangoHasta(rangoDesde)
          setRangoDesde(celda.fechaStr)
        } else {
          setRangoHasta(celda.fechaStr)
        }
        setPasoRango('desde')
      }
    }
  }

  const handleAplicarMes = () => {
    emitPeriodUpdate(limitesMesActual.desdeMes, limitesMesActual.hastaMes, 'mes')
  }

  const handleAplicarSemana = () => {
    if (!semanaActivaInfo) return
    emitPeriodUpdate(semanaActivaInfo.lunesStr, semanaActivaInfo.domingoStr, 'semana')
  }

  const handleAplicarRango = () => {
    if (!rangoDesde || !rangoHasta) return
    const start = rangoDesde <= rangoHasta ? rangoDesde : rangoHasta
    const end = rangoDesde <= rangoHasta ? rangoHasta : rangoDesde
    emitPeriodUpdate(start, end, 'rango')
  }

  // Texto en formato píldora (ej. 29/10/2026 o 29/10/2026-30/10/2026)
  const pillLabel = useMemo(() => {
    const startTxt = formatIsoToDisplay(jornadaDate)
    const endTxt = formatIsoToDisplay(effectiveEndDate)
    if (!endTxt || jornadaDate === effectiveEndDate) {
      return startTxt
    }
    return `${startTxt}-${endTxt}`
  }, [jornadaDate, effectiveEndDate])

  const handleSendToSelf = () => {
    setIsEmailMenuOpen(false)
    if (onSendEmail) {
      onSendEmail()
    }
  }

  const handleSendToThirdParty = () => {
    setIsEmailMenuOpen(false)
    if (onOpenThirdPartyEmailModal) {
      onOpenThirdPartyEmailModal()
    }
  }

  return (
    <div className="secretaria-jornada-bar">
      <div className="secretaria-jornada-bar__picker" ref={calendarContainerRef}>
        <span className="secretaria-jornada-bar__label">Jornada:</span>
        <div className="secretaria-jornada-bar__date-wrap">
          <button
            type="button"
            className={`secretaria-jornada-bar__date-pill ${
              isCalendarOpen ? 'secretaria-jornada-bar__date-pill--open' : ''
            }`}
            onClick={handleToggleCalendar}
            aria-expanded={isCalendarOpen}
            aria-haspopup="dialog"
            title="Seleccionar día, semana, mes o rango de fechas"
          >
            <Calendar className="secretaria-jornada-bar__pill-icon" size={14} />
            <span className="secretaria-jornada-bar__pill-text">{pillLabel}</span>
            <ChevronDown className="secretaria-jornada-bar__pill-chevron" size={14} />
          </button>

          {isCalendarOpen && (
            <div
              className="secretaria-jornada-bar__calendar-popover"
              role="dialog"
              aria-label="Selector de período de reporte"
            >
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

              {/* Barra de Botones de Selección de Período (Día, Mes, Semana, Rango) */}
              <div className="active-overtimes-bulk-bar">
                <div className="active-overtimes-bulk-bar__header">
                  <span className="active-overtimes-bulk-bar__title">Modo de consulta:</span>
                </div>

                <div className="active-overtimes-bulk-bar__actions">
                  {/* 1. Por Día */}
                  <button
                    type="button"
                    className={`active-overtimes-bulk-bar__btn ${
                      modoSeleccion === 'dia' ? 'active-overtimes-bulk-bar__btn--active' : ''
                    }`}
                    onClick={activarModoDia}
                  >
                    <Calendar size={13} />
                    <span>Por Día</span>
                  </button>

                  {/* 2. Por Semana (Lunes a Domingo) */}
                  <button
                    type="button"
                    className={`active-overtimes-bulk-bar__btn active-overtimes-bulk-bar__btn--warning ${
                      modoSeleccion === 'semana' ? 'active-overtimes-bulk-bar__btn--active-warning' : ''
                    }`}
                    onClick={activarModoSemana}
                  >
                    <Calendar size={13} />
                    <span>Por Semana</span>
                  </button>

                  {/* 3. Todo el Mes */}
                  <button
                    type="button"
                    className={`active-overtimes-bulk-bar__btn ${
                      modoSeleccion === 'mes' ? 'active-overtimes-bulk-bar__btn--active' : ''
                    }`}
                    onClick={activarModoMes}
                  >
                    <CalendarDays size={13} />
                    <span>Por Mes ({MESES_NOMBRES[mes - 1]})</span>
                  </button>

                  {/* 4. Por Rango */}
                  <button
                    type="button"
                    className={`active-overtimes-bulk-bar__btn ${
                      modoSeleccion === 'rango' ? 'active-overtimes-bulk-bar__btn--active' : ''
                    }`}
                    onClick={activarModoRango}
                  >
                    <CalendarDays size={13} />
                    <span>Por Rango</span>
                  </button>
                </div>

                {/* Panel de Día */}
                {modoSeleccion === 'dia' && (
                  <div className="active-overtimes-range-panel">
                    <div className="active-overtimes-range-panel__hint">
                      <Info size={13} className="active-overtimes-week-panel__hint-icon" />
                      <span>Hacé clic en cualquier día del calendario para consultar esa jornada.</span>
                    </div>
                  </div>
                )}

                {/* Panel de Mes Completo */}
                {modoSeleccion === 'mes' && (
                  <div className="active-overtimes-range-panel">
                    <div className="active-overtimes-week-panel__footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                      <span className="active-overtimes-week-panel__summary">
                        Mes completo:{' '}
                        <strong>
                          {formatIsoToDisplay(limitesMesActual.desdeMes)} -{' '}
                          {formatIsoToDisplay(limitesMesActual.hastaMes)}
                        </strong>
                      </span>
                      <button
                        type="button"
                        className="secretaria-jornada-bar__btn-apply"
                        onClick={handleAplicarMes}
                      >
                        <Check size={13} />
                        <span>Aplicar Mes</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Panel Interactivo de Selección de Semana (Lunes a Domingo) */}
                {modoSeleccion === 'semana' && semanaActivaInfo && (
                  <div className="active-overtimes-week-panel">
                    <div className="active-overtimes-week-panel__hint">
                      <Info size={13} className="active-overtimes-week-panel__hint-icon" />
                      <span>
                        Hacé clic en cualquier día del calendario o elegí una semana (Lunes a Domingo):
                      </span>
                    </div>

                    <div className="active-overtimes-week-panel__chips">
                      {semanasDelMes.map((sem) => {
                        const isSelectedWeek = sem.lunesStr === semanaActivaInfo.lunesStr
                        return (
                          <button
                            key={sem.lunesStr}
                            type="button"
                            className={`active-overtimes-week-panel__chip ${
                              isSelectedWeek ? 'active-overtimes-week-panel__chip--selected' : ''
                            }`}
                            onClick={() => {
                              setFechaSemanaBase(sem.fechaReferencia)
                              setFechaSeleccionada(sem.fechaReferencia)
                            }}
                          >
                            <span>
                              Sem {sem.numeroSemana} ({sem.lunesCorto} - {sem.domingoCorto})
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="active-overtimes-week-panel__footer">
                      <span className="active-overtimes-week-panel__summary">
                        Semana (Lun-Dom):{' '}
                        <strong>
                          {formatIsoToDisplay(semanaActivaInfo.lunesStr)}-
                          {formatIsoToDisplay(semanaActivaInfo.domingoStr)}
                        </strong>
                      </span>
                      <button
                        type="button"
                        className="secretaria-jornada-bar__btn-apply"
                        onClick={handleAplicarSemana}
                      >
                        <Search size={13} />
                        <span>Aplicar Semana</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Panel Interactivo de Selección de Rango de Fechas */}
                {modoSeleccion === 'rango' && (
                  <div className="active-overtimes-range-panel">
                    <div className="active-overtimes-range-panel__hint">
                      <Info size={13} className="active-overtimes-week-panel__hint-icon" />
                      <span>
                        {pasoRango === 'desde'
                          ? 'Hacé clic en el calendario para marcar la fecha Desde (o usá los campos):'
                          : 'Ahora hacé clic en otro día del calendario para marcar la fecha Hasta:'}
                      </span>
                    </div>

                    <div className="active-overtimes-range-panel__controls">
                      <div className="active-overtimes-range-panel__field">
                        <label htmlFor="report-range-desde">Desde:</label>
                        <input
                          id="report-range-desde"
                          type="date"
                          value={rangoDesde}
                          onChange={(e) => {
                            setRangoDesde(e.target.value)
                            if (rangoHasta && e.target.value > rangoHasta) {
                              setRangoHasta(e.target.value)
                            }
                          }}
                        />
                      </div>
                      <div className="active-overtimes-range-panel__field">
                        <label htmlFor="report-range-hasta">Hasta:</label>
                        <input
                          id="report-range-hasta"
                          type="date"
                          value={rangoHasta}
                          onChange={(e) => {
                            setRangoHasta(e.target.value)
                            if (rangoDesde && e.target.value < rangoDesde) {
                              setRangoDesde(e.target.value)
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="secretaria-jornada-bar__btn-apply"
                        onClick={handleAplicarRango}
                        disabled={!rangoDesde || !rangoHasta}
                      >
                        <Search size={13} />
                        <span>Aplicar Consulta</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Grilla Limpia del Calendario Mensual */}
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

                    const isSelectedDay =
                      modoSeleccion === 'dia' && fechaSeleccionada === celda.fechaStr
                    const isInSelectedWeek =
                      modoSeleccion === 'semana' &&
                      semanaActivaInfo &&
                      celda.fechaStr >= semanaActivaInfo.lunesStr &&
                      celda.fechaStr <= semanaActivaInfo.domingoStr

                    const isInSelectedMonth = modoSeleccion === 'mes'

                    const isInSelectedRange =
                      modoSeleccion === 'rango' &&
                      rangoDesde &&
                      rangoHasta &&
                      celda.fechaStr >= rangoDesde &&
                      celda.fechaStr <= rangoHasta
                    const isRangeStart = modoSeleccion === 'rango' && celda.fechaStr === rangoDesde
                    const isRangeEnd = modoSeleccion === 'rango' && celda.fechaStr === rangoHasta

                    const cellModifier = celda.esFinDeSemana
                      ? 'active-overtimes-calendar__cell--weekend'
                      : ''

                    const selectionClasses = [
                      isSelectedDay ? 'active-overtimes-calendar__cell--selected' : '',
                      isInSelectedWeek ? 'active-overtimes-calendar__cell--in-week' : '',
                      isInSelectedRange || isInSelectedMonth
                        ? 'active-overtimes-calendar__cell--in-range'
                        : '',
                      isRangeStart ? 'active-overtimes-calendar__cell--range-start' : '',
                      isRangeEnd ? 'active-overtimes-calendar__cell--range-end' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <button
                        key={celda.fechaStr}
                        type="button"
                        className={`active-overtimes-calendar__cell ${cellModifier} ${selectionClasses}`}
                        onClick={() => handleCellClick(celda)}
                        title={
                          modoSeleccion === 'rango'
                            ? `Clic para definir ${
                                pasoRango === 'desde' ? 'inicio (Desde)' : 'fin (Hasta)'
                              } del rango en ${celda.fechaStr}`
                            : modoSeleccion === 'semana'
                              ? `Clic para seleccionar la semana del ${celda.fechaStr}`
                              : `Consultar jornada ${celda.fechaStr}`
                        }
                      >
                        {(isRangeStart || isRangeEnd) && (
                          <span className="active-overtimes-calendar__range-tag">
                            {isRangeStart && isRangeEnd
                              ? 'Desde/Hasta'
                              : isRangeStart
                                ? 'Desde'
                                : 'Hasta'}
                          </span>
                        )}
                        <span className="active-overtimes-calendar__day-number">{celda.dia}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="secretaria-jornada-bar__actions">
        <button
          type="button"
          className="secretaria-jornada-bar__btn-export"
          onClick={onExportPdf}
          disabled={isSendingEmail}
          aria-label="Descargar reporte como PDF"
          title="Descargar reporte como PDF"
        >
          <Download className="secretaria-jornada-bar__btn-icon" />
          <span className="secretaria-jornada-bar__btn-label">PDF</span>
        </button>
        {onExportExcel && (
          <button
            type="button"
            className="secretaria-jornada-bar__btn-excel"
            onClick={onExportExcel}
            disabled={isSendingEmail}
            aria-label="Descargar reporte como Excel"
            title="Descargar reporte como Excel (.xlsx)"
          >
            <FileSpreadsheet className="secretaria-jornada-bar__btn-icon" />
            <span className="secretaria-jornada-bar__btn-label">Excel</span>
          </button>
        )}

        <div className="secretaria-jornada-bar__email-dropdown" ref={menuContainerRef}>
          <button
            type="button"
            className="secretaria-jornada-bar__btn-email"
            onClick={() => setIsEmailMenuOpen((prev) => !prev)}
            disabled={isSendingEmail}
            aria-haspopup="menu"
            aria-expanded={isEmailMenuOpen}
            aria-label={isSendingEmail ? 'Enviando reporte por mail' : 'Opciones de envío por mail'}
            title={isSendingEmail ? 'Enviando reporte por mail' : 'Enviar reporte por mail'}
          >
            <span className="secretaria-jornada-bar__email-icon" aria-hidden="true">
              <Mail className="secretaria-jornada-bar__btn-icon" />
              <ArrowUpRight className="secretaria-jornada-bar__email-arrow" />
            </span>
            <ChevronDown className="secretaria-jornada-bar__email-chevron" aria-hidden="true" />
          </button>

          {isEmailMenuOpen && (
            <div className="secretaria-jornada-bar__email-menu" role="menu">
              <button
                type="button"
                className="secretaria-jornada-bar__email-menu-item"
                role="menuitem"
                onClick={handleSendToSelf}
              >
                <User className="secretaria-jornada-bar__email-menu-icon" size={16} />
                <div className="secretaria-jornada-bar__email-menu-text">
                  <span className="secretaria-jornada-bar__email-menu-title">Enviar a mi correo</span>
                  {userEmail && (
                    <span className="secretaria-jornada-bar__email-menu-sub">{userEmail}</span>
                  )}
                </div>
              </button>

              <button
                type="button"
                className="secretaria-jornada-bar__email-menu-item"
                role="menuitem"
                onClick={handleSendToThirdParty}
              >
                <UserPlus className="secretaria-jornada-bar__email-menu-icon" size={16} />
                <div className="secretaria-jornada-bar__email-menu-text">
                  <span className="secretaria-jornada-bar__email-menu-title">
                    Enviar a otro destinatario...
                  </span>
                  <span className="secretaria-jornada-bar__email-menu-sub">
                    Ingresar correo manualmente
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
