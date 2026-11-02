import { useId, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, Clock, Sparkles, X } from 'lucide-react'
import { ChartState, formatCount, formatPercent, toCount } from './reportChartUtils'
import './TriageDistributionCard.css'

/** Orden fijo = prioridad. Incluye el objetivo SLA en minutos (alineado con PDF/Excel). */
export const TRIAGE_CATEGORIES = [
  { key: 'guardia', label: 'Guardia', shortLabel: 'Guardia', hint: 'Máxima urgencia', color: '#ef4444', slaTarget: 5 },
  { key: 'medicos', label: 'Médicos', shortLabel: 'Médicos', hint: 'Urgente', color: '#f97316', slaTarget: 10 },
  { key: 'discapacidad', label: 'Discapacidad', shortLabel: 'Discapacidad', hint: 'Prioritario', color: '#eab308', slaTarget: 10 },
  { key: 'oncologia', label: 'Oncología', shortLabel: 'Oncología', hint: 'Programado / Demanda espontánea', color: '#0284c7', slaTarget: 15 },
  { key: 'extraccion_con_turno', label: 'Extracción con turno', shortLabel: 'Con turno', hint: 'Programado', color: '#22c55e', slaTarget: 15 },
  { key: 'extraccion_sin_turno', label: 'Extracción sin turno', shortLabel: 'Sin turno', hint: 'Demanda espontánea', color: '#a855f7', slaTarget: 30 },
  { key: 'otro', label: 'Otro', shortLabel: 'Otro', hint: 'Requiere justificación', color: '#64748b', slaTarget: null }
]

const decFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

const formatMinutes = (val) => `${decFormat.format(Number(val) || 0)} min`

const normalizeCategoryKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, '_')

function resolveSlaStatus(count, waitMinutes, slaTarget) {
  if (!count || waitMinutes <= 0) {
    return { code: 'nodata', label: 'Sin espera', tone: 'neutral' }
  }
  if (slaTarget === null || slaTarget === undefined) {
    return { code: 'info', label: 'Sin tope SLA', tone: 'info' }
  }
  if (waitMinutes <= slaTarget) {
    return { code: 'ok', label: 'Cumple SLA', tone: 'success' }
  }
  return { code: 'exceeded', label: 'SLA Excedido', tone: 'danger' }
}

/**
 * Tarjeta interactiva de Distribución y Cumplimiento SLA por Triage.
 * Permite seleccionar cualquier categoría (ej. Guardia) para inspeccionar
 * gráficos detallados de tiempo de espera vs. objetivo SLA y demanda por franja horaria.
 */
export default function TriageDistributionCard({
  triageDistribution,
  slaTriage = [],
  franjasHorarias = [],
  error = false
}) {
  const titleId = useId()
  const [selectedKey, setSelectedKey] = useState('guardia')

  const slaMap = useMemo(() => {
    const map = {}
    if (Array.isArray(slaTriage)) {
      slaTriage.forEach((item) => {
        const k = item.triage_key || normalizeCategoryKey(item.clasificacion_triage)
        map[k] = {
          totalPacientes: toCount(item.total_pacientes),
          esperaMinutos: Number(item.promedio_espera_minutos) || 0,
          slaTarget:
            item.tiempo_objetivo_minutos !== undefined && item.tiempo_objetivo_minutos !== null
              ? Number(item.tiempo_objetivo_minutos)
              : undefined
        }
      })
    }
    return map
  }, [slaTriage])

  const rows = useMemo(() => {
    return TRIAGE_CATEGORIES.map((category) => {
      const slaEntry = slaMap[category.key]
      const count = toCount(triageDistribution?.[category.key] ?? slaEntry?.totalPacientes)
      const waitMinutes = slaEntry?.esperaMinutos ?? 0
      const effectiveSlaTarget =
        slaEntry?.slaTarget !== undefined && slaEntry?.slaTarget !== null
          ? slaEntry.slaTarget
          : category.slaTarget
      const slaStatus = resolveSlaStatus(count, waitMinutes, effectiveSlaTarget)

      return {
        ...category,
        slaTarget: effectiveSlaTarget,
        count,
        waitMinutes,
        slaStatus
      }
    })
  }, [triageDistribution, slaMap])

  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const max = Math.max(1, ...rows.map((row) => row.count))

  const selectedRow = useMemo(
    () => rows.find((r) => r.key === selectedKey) || null,
    [rows, selectedKey]
  )

  // Desglose por franja horaria de la categoría seleccionada
  const selectedSlotBreakdown = useMemo(() => {
    if (!selectedRow) return []
    const defaultSlots = [
      { id: 'noche', label: 'Noche', range: '00:00 - 07:59', count: 0 },
      { id: 'manana', label: 'Mañana', range: '08:00 - 15:59', count: 0 },
      { id: 'tarde', label: 'Tarde', range: '16:00 - 23:59', count: 0 }
    ]

    if (!Array.isArray(franjasHorarias) || franjasHorarias.length === 0) {
      return defaultSlots
    }

    return franjasHorarias.map((slot) => {
      const dist = Array.isArray(slot.distribucion_triage) ? slot.distribucion_triage : []
      const match = dist.find(
        (d) => (d.triage_key || normalizeCategoryKey(d.clasificacion_triage)) === selectedRow.key
      )
      const shortName = String(slot.nombre || '').split('/')[0].trim() || slot.id
      const shortRange = String(slot.rango_display || '')
        .replace(':00:00', ':00')
        .replace(':59:59', ':59')

      return {
        id: slot.id || shortName,
        label: shortName,
        range: shortRange,
        count: toCount(match?.cantidad)
      }
    })
  }, [selectedRow, franjasHorarias])

  const maxSlotCount = Math.max(1, ...selectedSlotBreakdown.map((s) => s.count))

  const handleSelectCategory = (key) => {
    setSelectedKey((prev) => (prev === key ? null : key))
  }

  return (
    <section className="triage-distribution-card" aria-labelledby={titleId}>
      <header className="triage-distribution-card__header">
        <div>
          <h2 id={titleId} className="triage-distribution-card__title">
            Distribución y SLA por triage
          </h2>
          <p className="triage-distribution-card__subtitle">
            Seleccioná una prioridad para inspeccionar su gráfico de cumplimiento SLA y demanda por turno
          </p>
        </div>
        {!error && (
          <span className="triage-distribution-card__total">
            <strong>{formatCount(total)}</strong>
            {total === 1 ? 'paciente' : 'pacientes'}
          </span>
        )}
      </header>

      {error ? (
        <ChartState
          kind="error"
          message="La distribución por triage no está disponible para esta jornada."
        />
      ) : (
        <>
          {/* Selector interactivo por píldoras de prioridad */}
          <div
            className="triage-distribution-card__pills"
            role="tablist"
            aria-label="Seleccionar categoría de triage para ver detalle"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedKey === null}
              className={`triage-distribution-card__pill${selectedKey === null ? ' triage-distribution-card__pill--active' : ''}`}
              onClick={() => setSelectedKey(null)}
            >
              Todas ({formatCount(total)})
            </button>
            {rows.map((row) => {
              const isSelected = selectedKey === row.key
              return (
                <button
                  key={row.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`triage-distribution-card__pill${isSelected ? ' triage-distribution-card__pill--active' : ''}`}
                  style={{ '--pill-color': row.color }}
                  onClick={() => handleSelectCategory(row.key)}
                >
                  <span
                    className="triage-distribution-card__pill-dot"
                    style={{ background: row.color }}
                    aria-hidden="true"
                  />
                  <span>{row.shortLabel}</span>
                  <span className="triage-distribution-card__pill-count">{formatCount(row.count)}</span>
                </button>
              )
            })}
          </div>

          {/* Panel interactivo de gráficos para la categoría seleccionada */}
          {selectedRow && (
            <div
              className="triage-distribution-card__spotlight"
              style={{ '--accent-color': selectedRow.color }}
              role="region"
              aria-label={`Detalle interactivo de ${selectedRow.label}`}
            >
              <div className="triage-distribution-card__spotlight-header">
                <div className="triage-distribution-card__spotlight-title-group">
                  <span
                    className="triage-distribution-card__spotlight-badge"
                    style={{ background: selectedRow.color }}
                  >
                    {selectedRow.label}
                  </span>
                  <span className="triage-distribution-card__spotlight-hint">
                    {selectedRow.hint}
                  </span>
                  <span
                    className={`triage-distribution-card__sla-chip triage-distribution-card__sla-chip--${selectedRow.slaStatus.tone}`}
                  >
                    {selectedRow.slaStatus.code === 'ok' && <CheckCircle2 size={13} />}
                    {selectedRow.slaStatus.code === 'exceeded' && <AlertTriangle size={13} />}
                    {selectedRow.slaStatus.code !== 'ok' && selectedRow.slaStatus.code !== 'exceeded' && (
                      <Clock size={13} />
                    )}
                    {selectedRow.slaStatus.label}
                  </span>
                </div>

                <button
                  type="button"
                  className="triage-distribution-card__spotlight-close"
                  onClick={() => setSelectedKey(null)}
                  title="Cerrar detalle de categoría"
                  aria-label="Cerrar detalle de categoría"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="triage-distribution-card__spotlight-grid">
                {/* Gráfico 1: Comparativa visual Espera Promedio vs Objetivo SLA */}
                <div className="triage-distribution-card__chart-box">
                  <div className="triage-distribution-card__chart-box-header">
                    <span className="triage-distribution-card__chart-box-title">
                      Espera promedio vs. Objetivo SLA
                    </span>
                    <span className="triage-distribution-card__chart-box-meta">
                      {selectedRow.slaTarget ? `Meta ≤ ${selectedRow.slaTarget} min` : 'Sin tope fijo'}
                    </span>
                  </div>

                  {(() => {
                    const scaleMax = Math.max(
                      selectedRow.slaTarget ? selectedRow.slaTarget * 1.5 : 30,
                      selectedRow.waitMinutes * 1.15,
                      10
                    )
                    const realPct = Math.min(100, (selectedRow.waitMinutes / scaleMax) * 100)
                    const targetPct = selectedRow.slaTarget
                      ? Math.min(100, (selectedRow.slaTarget / scaleMax) * 100)
                      : null

                    return (
                      <div className="triage-distribution-card__sla-bars">
                        <div className="triage-distribution-card__sla-bar-row">
                          <div className="triage-distribution-card__sla-bar-labels">
                            <span>Espera real</span>
                            <strong>
                              {selectedRow.waitMinutes > 0
                                ? formatMinutes(selectedRow.waitMinutes)
                                : '0,0 min'}
                            </strong>
                          </div>
                          <div className="triage-distribution-card__sla-track">
                            <div
                              className={`triage-distribution-card__sla-fill triage-distribution-card__sla-fill--${selectedRow.slaStatus.tone}`}
                              style={{ width: `${realPct}%` }}
                            />
                            {targetPct !== null && (
                              <span
                                className="triage-distribution-card__sla-marker"
                                style={{ left: `${targetPct}%` }}
                                title={`Objetivo SLA: ${selectedRow.slaTarget} min`}
                              />
                            )}
                          </div>
                        </div>

                        {selectedRow.slaTarget !== null && (
                          <div className="triage-distribution-card__sla-bar-row">
                            <div className="triage-distribution-card__sla-bar-labels">
                              <span>Objetivo SLA</span>
                              <strong>{formatMinutes(selectedRow.slaTarget)}</strong>
                            </div>
                            <div className="triage-distribution-card__sla-track">
                              <div
                                className="triage-distribution-card__sla-fill triage-distribution-card__sla-fill--target"
                                style={{ width: `${targetPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="triage-distribution-card__sla-summary">
                          <span>
                            Pacientes en esta prioridad:{' '}
                            <strong>{formatCount(selectedRow.count)}</strong> (
                            {formatPercent(selectedRow.count, total)} del día)
                          </span>
                          {selectedRow.slaTarget !== null && selectedRow.waitMinutes > 0 && (
                            <span className="triage-distribution-card__sla-delta">
                              {selectedRow.waitMinutes <= selectedRow.slaTarget
                                ? `✓ ${decFormat.format(selectedRow.slaTarget - selectedRow.waitMinutes)} min por debajo del tope`
                                : `⚠ +${decFormat.format(selectedRow.waitMinutes - selectedRow.slaTarget)} min sobre el objetivo`}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Gráfico 2: Columnas de pacientes de esta prioridad por franja horaria */}
                <div className="triage-distribution-card__chart-box">
                  <div className="triage-distribution-card__chart-box-header">
                    <span className="triage-distribution-card__chart-box-title">
                      Ingresos de «{selectedRow.shortLabel}» por franja horaria
                    </span>
                    <span className="triage-distribution-card__chart-box-meta">
                      Distribución en los 3 turnos
                    </span>
                  </div>

                  <div className="triage-distribution-card__slot-chart">
                    {selectedSlotBreakdown.map((slot) => {
                      const heightRatio = slot.count > 0 ? Math.max(0.12, slot.count / maxSlotCount) : 0.04
                      return (
                        <div key={slot.id} className="triage-distribution-card__slot-col">
                          <span className="triage-distribution-card__slot-val">
                            {formatCount(slot.count)}
                          </span>
                          <div className="triage-distribution-card__slot-bar-wrap">
                            <div
                              className="triage-distribution-card__slot-bar"
                              style={{
                                '--ratio': heightRatio,
                                '--bar-color': selectedRow.color
                              }}
                            />
                          </div>
                          <span className="triage-distribution-card__slot-name">{slot.label}</span>
                          <span className="triage-distribution-card__slot-range">{slot.range}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lista comparativa de barras horizontales con métricas SLA */}
          <ul className="triage-distribution-card__list" aria-label="Pacientes y SLA por categoría de triage">
            {rows.map((row) => {
              const isSelected = selectedKey === row.key
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(row.key)}
                    className={`triage-distribution-card__row${isSelected ? ' triage-distribution-card__row--selected' : ''}`}
                    style={{ '--row-color': row.color }}
                  >
                    <div className="triage-distribution-card__who">
                      <span
                        className="triage-distribution-card__dot"
                        style={{ '--color': row.color }}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="triage-distribution-card__name">
                          {row.label}
                          {row.slaTarget !== null && (
                            <span className="triage-distribution-card__target-tag">
                              SLA ≤ {row.slaTarget}m
                            </span>
                          )}
                        </div>
                        <div className="triage-distribution-card__hint">{row.hint}</div>
                      </div>
                    </div>

                    <div className="triage-distribution-card__track" aria-hidden="true">
                      <div
                        className="triage-distribution-card__fill"
                        style={{ '--size': `${(row.count / max) * 100}%`, '--color': row.color }}
                      />
                    </div>

                    <div className="triage-distribution-card__wait-col">
                      <span className="triage-distribution-card__wait-value">
                        {row.waitMinutes > 0 ? formatMinutes(row.waitMinutes) : '—'}
                      </span>
                      <span
                        className={`triage-distribution-card__sla-mini triage-distribution-card__sla-mini--${row.slaStatus.tone}`}
                      >
                        {row.slaStatus.label}
                      </span>
                    </div>

                    <span className="triage-distribution-card__count">{formatCount(row.count)}</span>
                    <span className="triage-distribution-card__percent">
                      {formatPercent(row.count, total)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {total === 0 && (
            <p className="triage-distribution-card__note" role="status">
              Todavía no hay pacientes registrados en esta jornada.
            </p>
          )}
        </>
      )}
    </section>
  )
}
