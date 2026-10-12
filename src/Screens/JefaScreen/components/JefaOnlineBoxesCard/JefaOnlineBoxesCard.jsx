import React, { useEffect, useState, useMemo } from 'react'
import {
  Tv,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Accessibility,
  User,
  UserX,
  Power,
  Activity
} from 'lucide-react'
import { useBox } from '../../../../context/BoxContext'
import './JefaOnlineBoxesCard.css'

export default function JefaOnlineBoxesCard({ onNotice = () => {} }) {
  const {
    boxes = [],
    boxesLoading = false,
    boxesError = '',
    changeBoxStatus,
    refreshBoxes
  } = useBox()

  const [isUpdatingBox, setIsUpdatingBox] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())

  // Auto-refresco periódico cada 12 segundos (sondeo en tiempo real)
  useEffect(() => {
    const timer = setInterval(() => {
      refreshBoxes().then(() => setLastUpdated(new Date()))
    }, 12000)

    return () => clearInterval(timer)
  }, [refreshBoxes])

  const handleManualRefresh = async () => {
    await refreshBoxes()
    setLastUpdated(new Date())
  }

  // Ordenar boxes de forma ascendente por número
  const orderedBoxes = useMemo(() => {
    return [...boxes].sort(
      (a, b) => Number(a.numero) - Number(b.numero)
    )
  }, [boxes])

  // Contadores para el encabezado
  const counts = useMemo(() => {
    let disponibles = 0
    let atencion = 0
    let fuera = 0

    for (const b of orderedBoxes) {
      const statusNorm = String(b.estado || '').toLowerCase()
      if (statusNorm === 'disponible') disponibles++
      else if (statusNorm === 'en atencion') atencion++
      else fuera++
    }

    return { disponibles, atencion, fuera }
  }, [orderedBoxes])

  // Conmutar estado de box entre 'Disponible' y 'Fuera de servicio'
  const handleToggleBoxStatus = async (box) => {
    const boxNumero = Number(box.numero)
    const currentStatus = box.estado || 'Disponible'
    const newStatus = currentStatus === 'Fuera de servicio' ? 'Disponible' : 'Fuera de servicio'

    setIsUpdatingBox(boxNumero)
    try {
      await changeBoxStatus(boxNumero, newStatus)
      onNotice(`Box ${boxNumero} ahora se encuentra: ${newStatus}`)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error al cambiar estado de box:', err)
      onNotice(err.message || 'Error al actualizar el estado del box.')
    } finally {
      setIsUpdatingBox(null)
    }
  }

  const getPillModifier = (estadoValue) => {
    const normalized = String(estadoValue || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    if (normalized === 'disponible') return 'jefa-boxes-card__pill--disponible'
    if (normalized === 'en atencion') return 'jefa-boxes-card__pill--atencion'
    return 'jefa-boxes-card__pill--fuera'
  }

  const getInitials = (nombre, apellidos) => {
    const first = (nombre || '').trim().charAt(0).toUpperCase()
    const last = (apellidos || '').trim().charAt(0).toUpperCase()
    return `${first}${last}` || 'TX'
  }

  const formattedTime = lastUpdated.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  return (
    <div className="jefa-boxes-card">
      {/* Cabecera y Contadores */}
      <div className="jefa-boxes-card__header">
        <div className="jefa-boxes-card__header-left">
          <div className="jefa-boxes-card__title-row">
            <Tv size={18} className="jefa-boxes-card__title-icon" aria-hidden="true" />
            <h3 className="jefa-boxes-card__title">Boxes de atención</h3>
          </div>
          <p className="jefa-boxes-card__subtitle">
            Monitoreo en línea y control operativo de boxes
          </p>
        </div>

        <div className="jefa-boxes-card__header-actions">
          <button
            type="button"
            className="jefa-boxes-card__refresh-btn"
            onClick={handleManualRefresh}
            disabled={boxesLoading}
            title={`Última actualización: ${formattedTime}`}
          >
            <RefreshCw
              size={12}
              className={boxesLoading ? 'jefa-boxes-card__refresh-icon--spinning' : ''}
              aria-hidden="true"
            />
            <span>{formattedTime}</span>
          </button>
        </div>
      </div>

      {/* Píldoras resumen KPI */}
      <div className="jefa-boxes-card__kpis">
        <span className="jefa-boxes-card__kpi-badge jefa-boxes-card__kpi-badge--disponible">
          <span className="jefa-boxes-card__kpi-dot" />
          {counts.disponibles} disponibles
        </span>
        <span className="jefa-boxes-card__kpi-badge jefa-boxes-card__kpi-badge--atencion">
          <span className="jefa-boxes-card__kpi-dot" />
          {counts.atencion} en atención
        </span>
        <span className="jefa-boxes-card__kpi-badge jefa-boxes-card__kpi-badge--fuera">
          <span className="jefa-boxes-card__kpi-dot" />
          {counts.fuera} fuera de servicio
        </span>
      </div>

      {/* Error Banner */}
      {boxesError && (
        <div className="jefa-boxes-card__error-banner" role="alert">
          <span>{boxesError}</span>
          <button
            type="button"
            className="jefa-boxes-card__action-btn"
            onClick={handleManualRefresh}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Lista de Boxes */}
      {boxesLoading && orderedBoxes.length === 0 ? (
        <div className="jefa-boxes-card__loading">
          <div className="jefa-boxes-card__spinner" />
          <span>Sincronizando boxes en tiempo real...</span>
        </div>
      ) : orderedBoxes.length === 0 ? (
        <div className="jefa-boxes-card__empty">
          <p>No se encontraron boxes registrados en el sistema.</p>
        </div>
      ) : (
        <ul className="jefa-boxes-card__list">
          {orderedBoxes.map((box) => {
            const boxNumero = Number(box.numero)
            const estadoActual = box.estado || (box.activo === false ? 'Fuera de servicio' : 'Disponible')
            const isDisponible = estadoActual === 'Disponible'
            const isEnAtencion = estadoActual === 'En atencion'
            const isFuera = estadoActual === 'Fuera de servicio'
            const isBusy = isUpdatingBox === boxNumero

            const staff = box.personal_actual
            const paciente = box.paciente_actual

            const itemModifierClass = isDisponible
              ? 'jefa-boxes-card__item--disponible'
              : isEnAtencion
                ? 'jefa-boxes-card__item--atencion'
                : 'jefa-boxes-card__item--fuera'

            return (
              <li key={box.id ?? boxNumero} className={`jefa-boxes-card__item ${itemModifierClass}`}>
                {/* Cabecera del Box: Nombre + Píldora de estado */}
                <div className="jefa-boxes-card__box-header">
                  <div className="jefa-boxes-card__box-title-wrap">
                    <span className="jefa-boxes-card__box-name">
                      {box.nombre || `Box ${boxNumero}`}
                    </span>
                    {box.discapacidad && (
                      <span className="jefa-boxes-card__tag-accesible" title="Box adaptado con acceso prioritario para movilidad reducida">
                        <Accessibility size={11} aria-hidden="true" />
                        Accesible
                      </span>
                    )}
                  </div>

                  <span className={`jefa-boxes-card__pill ${getPillModifier(estadoActual)}`}>
                    {isDisponible && <CheckCircle2 size={11} aria-hidden="true" />}
                    {isEnAtencion && <Activity size={11} aria-hidden="true" />}
                    {isFuera && <AlertTriangle size={11} aria-hidden="true" />}
                    {estadoActual}
                  </span>
                </div>

                {/* Personal asignado en el Box */}
                <div className="jefa-boxes-card__staff-row">
                  <div className="jefa-boxes-card__staff-info">
                    {staff ? (
                      <>
                        <div className="jefa-boxes-card__staff-avatar" title={staff.rol || 'Técnico'}>
                          {getInitials(staff.nombre, staff.apellidos)}
                        </div>
                        <div className="jefa-boxes-card__staff-details">
                          <span className="jefa-boxes-card__staff-name">
                            {staff.nombre_completo || `${staff.nombre} ${staff.apellidos}`}
                          </span>
                          <span className="jefa-boxes-card__staff-sub">
                            {staff.rol || 'Personal'}{staff.matricula ? ` · Mat. ${staff.matricula}` : ''}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="jefa-boxes-card__staff-avatar jefa-boxes-card__staff-avatar--vacant">
                          <UserX size={13} aria-hidden="true" />
                        </div>
                        <div className="jefa-boxes-card__staff-details">
                          <span className="jefa-boxes-card__staff-vacant">
                            Sin personal en box
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Botón de control operativo de la Jefa */}
                  <div className="jefa-boxes-card__actions">
                    {isFuera ? (
                      <button
                        type="button"
                        className="jefa-boxes-card__action-btn jefa-boxes-card__action-btn--toggle-disponible"
                        onClick={() => handleToggleBoxStatus(box)}
                        disabled={isBusy}
                        title="Habilitar box y dejarlo en estado Disponible"
                      >
                        <Power size={11} aria-hidden="true" />
                        {isBusy ? 'Habilitando...' : 'Habilitar'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="jefa-boxes-card__action-btn jefa-boxes-card__action-btn--toggle-fuera"
                        onClick={() => handleToggleBoxStatus(box)}
                        disabled={isBusy || isEnAtencion}
                        title={
                          isEnAtencion
                            ? 'No se puede inhabilitar mientras hay una consulta asistencial en curso'
                            : 'Poner fuera de servicio por mantenimiento o receso'
                        }
                      >
                        <AlertTriangle size={11} aria-hidden="true" />
                        {isBusy ? 'Cerrando...' : 'Fuera de serv.'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Paciente en Atención (si aplica) */}
                {isEnAtencion && paciente && (
                  <div className="jefa-boxes-card__patient-row">
                    <Clock size={12} className="jefa-boxes-card__patient-icon" aria-hidden="true" />
                    <span>
                      En atención: <strong className="jefa-boxes-card__patient-totem">Turno {paciente.num_totem}</strong>
                      {paciente.paciente_nombre ? ` (${paciente.paciente_nombre})` : ''}
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
