import { useId } from 'react';
import { ChartState, formatCount, formatPercent, toCount } from './reportChartUtils';
import './TriageDistributionCard.css';

/** Orden fijo = prioridad. Las categorías en 0 se muestran igual. */
export const TRIAGE_CATEGORIES = [
  { key: 'guardia', label: 'Guardia', hint: 'Máxima urgencia', color: '#ef4444' },
  { key: 'medicos', label: 'Médicos', hint: 'Urgente', color: '#f97316' },
  { key: 'discapacidad', label: 'Discapacidad', hint: 'Prioritario', color: '#eab308' },
  { key: 'oncologia', label: 'Oncología', hint: 'Programado / Demanda espontánea', color: '#0284c7' },
  { key: 'extraccion_con_turno', label: 'Extracción con turno', hint: 'Programado', color: '#22c55e' },
  { key: 'extraccion_sin_turno', label: 'Extracción sin turno', hint: 'Demanda espontánea', color: '#a855f7' },
  { key: 'otro', label: 'Otro', hint: 'Requiere justificación', color: '#64748b' },
];

/**
 * A2: barras horizontales ordenadas por prioridad, con el total de pacientes destacado.
 *
 * @param {{ triageDistribution?: Record<string, number>, error?: boolean }} props
 *   triageDistribution: { guardia: 3, medicos: 12, ..., otro: 1 }
 */
export default function TriageDistributionCard({ triageDistribution, error = false }) {
  const titleId = useId();

  const rows = TRIAGE_CATEGORIES.map((category) => ({
    ...category,
    count: toCount(triageDistribution?.[category.key]),
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section className="triage-distribution-card" aria-labelledby={titleId}>
      <header className="triage-distribution-card__header">
        <h2 id={titleId} className="triage-distribution-card__title">
          Distribución por triage
        </h2>
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
          <ul className="triage-distribution-card__list" aria-label="Pacientes por categoría de triage">
            {rows.map((row) => (
              <li key={row.key} className="triage-distribution-card__row">
                <div className="triage-distribution-card__who">
                  <span
                    className="triage-distribution-card__dot"
                    style={{ '--color': row.color }}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="triage-distribution-card__name">{row.label}</div>
                    <div className="triage-distribution-card__hint">{row.hint}</div>
                  </div>
                </div>
                <div className="triage-distribution-card__track" aria-hidden="true">
                  <div
                    className="triage-distribution-card__fill"
                    style={{ '--size': `${(row.count / max) * 100}%`, '--color': row.color }}
                  />
                </div>
                <span className="triage-distribution-card__count">{formatCount(row.count)}</span>
                <span className="triage-distribution-card__percent">{formatPercent(row.count, total)}</span>
              </li>
            ))}
          </ul>

          {total === 0 && (
            <p className="triage-distribution-card__note" role="status">
              Todavía no hay pacientes registrados en esta jornada.
            </p>
          )}
        </>
      )}
    </section>
  );
}
