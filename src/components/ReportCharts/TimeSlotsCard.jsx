import { useId, useMemo } from 'react'
import { Moon, Sun, Sunset, Clock, Users } from 'lucide-react'
import { ChartState, formatCount, formatPercent, toCount } from './reportChartUtils'
import { TRIAGE_CATEGORIES } from './TriageDistributionCard'
import './TimeSlotsCard.css'

const SLOT_META = {
  noche: {
    Icon: Moon,
    defaultTitle: 'Noche / Guardia Madrugada',
    defaultRange: '00:00 - 07:59',
    accent: '#4338ca',
    tint: '#e0e7ff'
  },
  manana: {
    Icon: Sun,
    defaultTitle: 'Mañana / Turno Central',
    defaultRange: '08:00 - 15:59',
    accent: '#0f766e',
    tint: '#ccfbf1'
  },
  tarde: {
    Icon: Sunset,
    defaultTitle: 'Tarde / Guardia Vespertina',
    defaultRange: '16:00 - 23:59',
    accent: '#b45309',
    tint: '#fef3c7'
  }
}

const DEFAULT_SLOTS = [
  { id: 'noche', nombre: 'Noche / Guardia Madrugada', rango_display: '00:00:00 - 07:59:59' },
  { id: 'manana', nombre: 'Mañana / Turno Central', rango_display: '08:00:00 - 15:59:59' },
  { id: 'tarde', nombre: 'Tarde / Guardia Vespertina', rango_display: '16:00:00 - 23:59:59' }
]

const decFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

const formatMinutes = (val) => {
  const num = Number(val) || 0
  return num > 0 ? `${decFormat.format(num)} min` : '—'
}

const normalizeCategoryKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, '_')

const TRIAGE_MAP = Object.fromEntries(TRIAGE_CATEGORIES.map((c) => [c.key, c]))

/**
 * Tarjeta de 3 columnas que visualiza el flujo asistencial por Franja Horaria
 * (Noche, Mañana y Tarde) con barras de emitidos/atendidos/cancelados y tiempos promedio.
 */
export default function TimeSlotsCard({ franjasHorarias = [], error = false }) {
  const titleId = useId()

  const { slots, totalDayEmitidos } = useMemo(() => {
    const rawList =
      Array.isArray(franjasHorarias) && franjasHorarias.length > 0
        ? franjasHorarias
        : DEFAULT_SLOTS

    const normalized = rawList.map((slot) => {
      const slotId = String(slot.id || '').toLowerCase()
      const meta = SLOT_META[slotId] || SLOT_META.manana
      const emitidos = toCount(slot.total_emitidos)
      const atendidos = toCount(slot.total_atendidos)
      const cancelados = toCount(slot.total_cancelados)
      const enCurso = Math.max(0, emitidos - atendidos - cancelados)

      const atendidosPct = emitidos > 0 ? Math.min(100, (atendidos / emitidos) * 100) : 0
      const canceladosPct = emitidos > 0 ? Math.min(100, (cancelados / emitidos) * 100) : 0
      const enCursoPct = emitidos > 0 ? Math.max(0, 100 - atendidosPct - canceladosPct) : 0

      const cleanRange = String(slot.rango_display || meta.defaultRange)
        .replace(':00:00', ':00')
        .replace(':59:59', ':59')

      const triageItems = (Array.isArray(slot.distribucion_triage) ? slot.distribucion_triage : [])
        .map((item) => {
          const key = item.triage_key || normalizeCategoryKey(item.clasificacion_triage)
          const metaTriage = TRIAGE_MAP[key] || {
            label: item.clasificacion_triage || 'Otro',
            shortLabel: item.clasificacion_triage || 'Otro',
            color: '#64748b'
          }
          return {
            key,
            label: metaTriage.shortLabel || metaTriage.label,
            color: metaTriage.color,
            cantidad: toCount(item.cantidad)
          }
        })
        .filter((t) => t.cantidad > 0)

      return {
        id: slot.id || meta.defaultTitle,
        nombre: slot.nombre || meta.defaultTitle,
        rango: cleanRange,
        Icon: meta.Icon,
        accent: meta.accent,
        tint: meta.tint,
        emitidos,
        atendidos,
        cancelados,
        enCurso,
        atendidosPct,
        canceladosPct,
        enCursoPct,
        esperaMinutos: Number(slot.promedio_espera_minutos) || 0,
        atencionMinutos: Number(slot.promedio_atencion_minutos) || 0,
        triageItems
      }
    })

    const sumEmitidos = normalized.reduce((acc, s) => acc + s.emitidos, 0)
    return { slots: normalized, totalDayEmitidos: sumEmitidos }
  }, [franjasHorarias])

  return (
    <section className="time-slots-card" aria-labelledby={titleId}>
      <header className="time-slots-card__header">
        <div>
          <h2 id={titleId} className="time-slots-card__title">
            Actividad por franja horaria
          </h2>
          <p className="time-slots-card__subtitle">
            Flujo de ingresos, completitud y tiempos promedio segmentados por turno hospitalario
          </p>
        </div>
        {!error && (
          <span className="time-slots-card__total">
            <strong>{formatCount(totalDayEmitidos)}</strong>
            {totalDayEmitidos === 1 ? 'ingreso en el día' : 'ingresos en el día'}
          </span>
        )}
      </header>

      {error ? (
        <ChartState
          kind="error"
          message="El desglose por franjas horarias no está disponible para esta jornada."
        />
      ) : (
        <div className="time-slots-card__grid">
          {slots.map((slot) => {
            const SlotIcon = slot.Icon
            return (
              <article
                key={slot.id}
                className="time-slots-card__column"
                style={{ '--slot-accent': slot.accent, '--slot-tint': slot.tint }}
              >
                <div className="time-slots-card__col-top">
                  <div className="time-slots-card__col-identity">
                    <span className="time-slots-card__col-icon" aria-hidden="true">
                      <SlotIcon size={18} />
                    </span>
                    <div>
                      <h3 className="time-slots-card__col-title">{slot.nombre}</h3>
                      <span className="time-slots-card__col-range">{slot.rango}</span>
                    </div>
                  </div>
                  <div className="time-slots-card__col-volume">
                    <span className="time-slots-card__col-emitidos">
                      {formatCount(slot.emitidos)}
                    </span>
                    <span className="time-slots-card__col-share">
                      {formatPercent(slot.emitidos, totalDayEmitidos)} del día
                    </span>
                  </div>
                </div>

                {/* Barra de estado del turno (Atendidos / En curso / Cancelados) */}
                <div className="time-slots-card__flow">
                  <div
                    className="time-slots-card__bar"
                    role="img"
                    aria-label={`${slot.nombre}: ${slot.atendidos} atendidos, ${slot.cancelados} cancelados`}
                  >
                    {slot.emitidos > 0 && (
                      <>
                        <span
                          className="time-slots-card__bar-seg time-slots-card__bar-seg--attended"
                          style={{ width: `${slot.atendidosPct}%` }}
                        />
                        <span
                          className="time-slots-card__bar-seg time-slots-card__bar-seg--active"
                          style={{ width: `${slot.enCursoPct}%` }}
                        />
                        <span
                          className="time-slots-card__bar-seg time-slots-card__bar-seg--cancelled"
                          style={{ width: `${slot.canceladosPct}%` }}
                        />
                      </>
                    )}
                  </div>

                  <div className="time-slots-card__counts">
                    <span className="time-slots-card__count-pill time-slots-card__count-pill--attended">
                      <strong>{formatCount(slot.atendidos)}</strong> atendidos
                    </span>
                    <span className="time-slots-card__count-pill time-slots-card__count-pill--cancelled">
                      <strong>{formatCount(slot.cancelados)}</strong> ausentes
                    </span>
                    {slot.enCurso > 0 && (
                      <span className="time-slots-card__count-pill time-slots-card__count-pill--active">
                        <strong>{formatCount(slot.enCurso)}</strong> en curso
                      </span>
                    )}
                  </div>
                </div>

                {/* Tiempos promedio del turno */}
                <div className="time-slots-card__times">
                  <div className="time-slots-card__time-box">
                    <span className="time-slots-card__time-label">
                      <Clock size={12} aria-hidden="true" />
                      Espera prom.
                    </span>
                    <strong className="time-slots-card__time-val">
                      {formatMinutes(slot.esperaMinutos)}
                    </strong>
                  </div>
                  <div className="time-slots-card__time-box">
                    <span className="time-slots-card__time-label">
                      <Users size={12} aria-hidden="true" />
                      Atención prom.
                    </span>
                    <strong className="time-slots-card__time-val">
                      {formatMinutes(slot.atencionMinutos)}
                    </strong>
                  </div>
                </div>

                {/* Desglose rápido de prioridades en la franja */}
                {slot.triageItems.length > 0 && (
                  <div className="time-slots-card__triage-tags" aria-label="Prioridades en la franja">
                    {slot.triageItems.slice(0, 4).map((t) => (
                      <span key={t.key} className="time-slots-card__triage-tag">
                        <span
                          className="time-slots-card__triage-dot"
                          style={{ background: t.color }}
                          aria-hidden="true"
                        />
                        {t.label}: <strong>{formatCount(t.cantidad)}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

