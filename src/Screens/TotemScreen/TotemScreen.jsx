import React, { useState, useEffect, useRef } from 'react'
import {
  Activity,
  CreditCard,
  AlertCircle,
  Stethoscope,
  FileText,
  Delete,
  CheckCircle2,
  Clock,
  RotateCcw,
  Volume2
} from 'lucide-react'
import receptionService from '../../services/receptionService'
import Logo from '../../components/Logo/Logo'
import './TotemScreen.css'

const CATEGORIAS = [
  {
    prefijo: 'Ext',
    titulo: 'Extracción',
    descripcion: 'Análisis clínicos y laboratorio de sangre/orina',
    icono: Activity,
    colorClass: 'totem-card--extraccion'
  },
  {
    prefijo: 'G',
    titulo: 'Guardia / Urgencia',
    descripcion: 'Urgencias médicas y derivaciones inmediatas',
    icono: AlertCircle,
    colorClass: 'totem-card--guardia'
  },
  {
    prefijo: 'Med',
    titulo: 'Médicos y Personal',
    descripcion: 'Atención a profesionales de la salud y personal',
    icono: Stethoscope,
    colorClass: 'totem-card--medicos'
  },
  {
    prefijo: 'Csl',
    titulo: 'Consulta / Otros',
    descripcion: 'Consultas de mostrador y trámites administrativos',
    icono: FileText,
    colorClass: 'totem-card--consulta'
  }
]

const COUNTDOWN_INITIAL = 7

export default function TotemScreen() {
  const [dni, setDni] = useState('')
  const [paso, setPaso] = useState('dni') // 'dni', 'categoria', 'ticket'
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)
  const [ticketEmitido, setTicketEmitido] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [countdown, setCountdown] = useState(COUNTDOWN_INITIAL)
  const [horaActual, setHoraActual] = useState(new Date())

  const countdownIntervalRef = useRef(null)

  // Reloj de cabecera
  useEffect(() => {
    const clockTimer = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(clockTimer)
  }, [])

  // Captura de teclado físico
  useEffect(() => {
    if (paso === 'ticket') return

    const handleKeyDown = (event) => {
      if (/^[0-9]$/.test(event.key)) {
        if (dni.length < 9) {
          setDni((prev) => prev + event.key)
        }
      } else if (event.key === 'Backspace') {
        setDni((prev) => prev.slice(0, -1))
      } else if (event.key === 'Enter' && dni.length >= 7) {
        setPaso('categoria')
      } else if (event.key === 'Escape') {
        handleReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dni, paso])

  // Temporizador de reseteo automático en pantalla de confirmación
  useEffect(() => {
    if (paso === 'ticket') {
      setCountdown(COUNTDOWN_INITIAL)
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current)
            handleReset()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [paso])

  const handleKeyPress = (num) => {
    if (dni.length < 9) {
      setDni((prev) => prev + num)
      setErrorMessage('')
    }
  }

  const handleDelete = () => {
    setDni((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    setDni('')
    setErrorMessage('')
  }

  const handleContinuarACategorias = () => {
    if (dni.length < 7) {
      setErrorMessage('Por favor ingrese un número de DNI válido (mínimo 7 dígitos).')
      return
    }
    setErrorMessage('')
    setPaso('categoria')
  }

  const handleSeleccionarCategoria = async (cat) => {
    setCategoriaSeleccionada(cat)
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await receptionService.emitirTurnoTotem({
        dni,
        prefijo: cat.prefijo
      })
      setTicketEmitido(response)
      setPaso('ticket')
    } catch (error) {
      setErrorMessage(
        error.message || 'No se pudo emitir el turno en este momento. Por favor acérquese a mostrador.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
    setDni('')
    setPaso('dni')
    setCategoriaSeleccionada(null)
    setTicketEmitido(null)
    setErrorMessage('')
    setIsSubmitting(false)
  }

  const formatearDniVisual = (valor) => {
    if (!valor) return ''
    return valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  return (
    <div className="totem-container">
      {/* Cabecera del Tótem */}
      <header className="totem-header">
        <div className="totem-header__brand">
          <Logo size="medium" />
          <div className="totem-header__titles">
            <h1 className="totem-header__title">Tótem de Autoservicio</h1>
            <p className="totem-header__subtitle">Llegada de Pacientes &middot; Turno de Recepción</p>
          </div>
        </div>

        <div className="totem-header__clock">
          <Clock size={20} className="totem-header__clock-icon" />
          <span>
            {horaActual.toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </span>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="totem-main">
        {/* PASO 1: Ingreso de DNI */}
        {paso === 'dni' && (
          <div className="totem-step totem-step--dni">
            <div className="totem-step__instructions">
              <h2 className="totem-step__title">Bienvenido/a al Laboratorio</h2>
              <p className="totem-step__description">
                Por favor, ingrese su <strong>DNI</strong> en el teclado para registrar su llegada
              </p>
            </div>

            {/* Display del DNI */}
            <div className="totem-dni-display">
              <CreditCard size={32} className="totem-dni-display__icon" />
              <div className="totem-dni-display__number">
                {dni ? (
                  formatearDniVisual(dni)
                ) : (
                  <span className="totem-dni-display__placeholder">Ingrese su DNI...</span>
                )}
              </div>
              {dni && (
                <button
                  type="button"
                  className="totem-dni-display__clear-btn"
                  onClick={handleClear}
                  title="Borrar DNI"
                >
                  <RotateCcw size={20} />
                </button>
              )}
            </div>

            {errorMessage && <div className="totem-error-banner">{errorMessage}</div>}

            {/* Teclado numérico táctil */}
            <div className="totem-keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="totem-keypad__btn"
                  onClick={() => handleKeyPress(String(num))}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="totem-keypad__btn totem-keypad__btn--action totem-keypad__btn--clear"
                onClick={handleClear}
                disabled={!dni}
              >
                Borrar
              </button>
              <button
                type="button"
                className="totem-keypad__btn"
                onClick={() => handleKeyPress('0')}
              >
                0
              </button>
              <button
                type="button"
                className="totem-keypad__btn totem-keypad__btn--action totem-keypad__btn--delete"
                onClick={handleDelete}
                disabled={!dni}
                title="Retroceso"
              >
                <Delete size={28} />
              </button>
            </div>

            {/* Botón de confirmación de DNI */}
            <div className="totem-step__actions">
              <button
                type="button"
                className="totem-btn-continue"
                onClick={handleContinuarACategorias}
                disabled={dni.length < 7}
              >
                Continuar a Selección de Motivo &rarr;
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: Selección de Categoría (Las 4 opciones) */}
        {paso === 'categoria' && (
          <div className="totem-step totem-step--categories">
            <div className="totem-step__instructions">
              <div className="totem-patient-chip">
                DNI: <strong>{formatearDniVisual(dni)}</strong>
                <button
                  type="button"
                  className="totem-patient-chip__change-btn"
                  onClick={() => setPaso('dni')}
                >
                  Cambiar DNI
                </button>
              </div>
              <h2 className="totem-step__title">Seleccione el motivo de su visita</h2>
              <p className="totem-step__description">
                Toque una opción para generar su número secuencial de atención:
              </p>
            </div>

            {errorMessage && <div className="totem-error-banner">{errorMessage}</div>}

            <div className="totem-categories-grid">
              {CATEGORIAS.map((cat) => {
                const IconComponent = cat.icono
                return (
                  <button
                    key={cat.prefijo}
                    type="button"
                    className={`totem-category-card ${cat.colorClass}`}
                    onClick={() => handleSeleccionarCategoria(cat)}
                    disabled={isSubmitting}
                  >
                    <div className="totem-category-card__icon-wrap">
                      <IconComponent size={44} />
                    </div>
                    <div className="totem-category-card__badge-prefix">Prefijo: {cat.prefijo}</div>
                    <h3 className="totem-category-card__title">{cat.titulo}</h3>
                    <p className="totem-category-card__desc">{cat.descripcion}</p>
                  </button>
                )
              })}
            </div>

            <div className="totem-step__actions">
              <button
                type="button"
                className="totem-btn-secondary"
                onClick={() => setPaso('dni')}
                disabled={isSubmitting}
              >
                &larr; Volver a ingresar DNI
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Ticket Emitido con éxito */}
        {paso === 'ticket' && ticketEmitido && (
          <div className="totem-step totem-step--success">
            <div className="totem-ticket-card">
              <div className="totem-ticket-card__header">
                <CheckCircle2 size={48} className="totem-ticket-card__check-icon" />
                <h2 className="totem-ticket-card__title">¡Turno asignado con éxito!</h2>
                <p className="totem-ticket-card__subtitle">
                  Tome asiento en la sala de espera
                </p>
              </div>

              <div className="totem-ticket-card__body">
                <div className="totem-ticket-card__category-badge">
                  {ticketEmitido.categoria_label || categoriaSeleccionada?.titulo || 'Atención'}
                </div>

                <div className="totem-ticket-card__number-wrap">
                  <span className="totem-ticket-card__number-label">SU NÚMERO ES</span>
                  <div className="totem-ticket-card__big-number">
                    {ticketEmitido.numero_llamado}
                  </div>
                </div>

                <div className="totem-ticket-card__details">
                  <div className="totem-ticket-card__detail-item">
                    <span>DNI ingresado:</span>
                    <strong>{formatearDniVisual(ticketEmitido.dni)}</strong>
                  </div>
                  <div className="totem-ticket-card__detail-item">
                    <span>Hora de llegada:</span>
                    <strong>
                      {new Date(ticketEmitido.created_at).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </strong>
                  </div>
                </div>

                <div className="totem-ticket-card__instruction">
                  <Volume2 size={24} className="totem-ticket-card__instruction-icon" />
                  <span>
                    Aguarde a que su número <strong>{ticketEmitido.numero_llamado}</strong> sea convocado por los parlantes y pantallas hacia el mostrador de Recepción.
                  </span>
                </div>
              </div>

              <div className="totem-ticket-card__footer">
                <div className="totem-countdown-bar">
                  Esta pantalla volverá al inicio en <strong>{countdown}</strong> segundos...
                </div>
                <button
                  type="button"
                  className="totem-btn-finish"
                  onClick={handleReset}
                >
                  Finalizar y dejar disponible
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="totem-footer">
        <span>Sistema de Gestión de Triage y Flujo de Pacientes &middot; Hospital SGTP</span>
      </footer>
    </div>
  )
}

