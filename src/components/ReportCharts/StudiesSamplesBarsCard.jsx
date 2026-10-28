import { useId, useMemo } from 'react';
import { Droplet, Ellipsis, FlaskConical, TestTube } from 'lucide-react';
import { ChartState, formatCount, formatPercent, toCount } from './reportChartUtils';
import './StudiesSamplesBarsCard.css';

// Se resuelve por clave normalizada: 'materia_fecal' / 'materia-fecal' / 'Materia fecal' -> 'materiafecal'
const normalizeKey = (key) => String(key ?? '').toLowerCase().replace(/[^a-z]/g, '');

// Colores propios (no se pisan con los de triage). Todos pasan AA con texto blanco.
const SAMPLE_STYLE = {
  sangre: { Icon: Droplet, color: '#0f766e', tint: '#ccfbf1' },
  orina: { Icon: FlaskConical, color: '#4338ca', tint: '#e0e7ff' },
  materiafecal: { Icon: TestTube, color: '#b45309', tint: '#fef3c7' },
  otros: { Icon: Ellipsis, color: '#64748b', tint: '#f1f5f9' },
};
const FALLBACK_STYLE = { Icon: Ellipsis, color: '#64748b', tint: '#f1f5f9' };

/**
 * C3: barras verticales, una por tipo de muestra, con ícono, nombre y porcentaje.
 *
 * Uso:
 *   <StudiesSamplesBarsCard items={resumen.por_muestra} error={errResumen} />
 *
 * @param {object}  props
 * @param {Array}   props.items       [{ muestra_key, nombre_muestra, total_estudios }]
 * @param {string}  [props.labelKey]  default 'nombre_muestra'
 * @param {string}  [props.keyKey]    default 'muestra_key'
 * @param {string}  [props.valueKey]  default 'total_estudios'
 * @param {boolean} [props.error]     true si falló el backend
 */
export default function StudiesSamplesBarsCard({
  title = 'Estudios realizados por muestra',
  items,
  labelKey = 'nombre_muestra',
  keyKey = 'muestra_key',
  valueKey = 'total_estudios',
  error = false,
  emptyMessage = 'No hay estudios realizados para esta jornada.',
  errorMessage = 'El resumen no está disponible para esta jornada.',
}) {
  const titleId = useId();

  const { rows, total } = useMemo(() => {
    const list = (items ?? [])
      .map((item) => ({
        id: String(item[keyKey]),
        label: String(item[labelKey] ?? ''),
        value: toCount(item[valueKey]),
        ...(SAMPLE_STYLE[normalizeKey(item[keyKey])] ?? FALLBACK_STYLE),
      }))
      .sort((a, b) => b.value - a.value);
    return { rows: list, total: list.reduce((sum, item) => sum + item.value, 0) };
  }, [items, keyKey, labelKey, valueKey]);

  const max = Math.max(1, ...rows.map((row) => row.value));
  const isEmpty = !error && total === 0;
  const chartLabel = `${title}, total ${formatCount(total)}: ${rows
    .map((row) => `${row.label} ${formatCount(row.value)}`)
    .join(', ')}`;

  return (
    <section className="studies-samples-card" aria-labelledby={titleId}>
      <header className="studies-samples-card__header">
        <h2 id={titleId} className="studies-samples-card__title">
          {title}
        </h2>
        {!error && (
          <span className="studies-samples-card__total">
            <strong>{formatCount(total)}</strong>
            {total === 1 ? 'estudio' : 'estudios'}
          </span>
        )}
      </header>

      {error && <ChartState kind="error" message={errorMessage} />}
      {isEmpty && <ChartState kind="empty" message={emptyMessage} />}

      {!error && !isEmpty && (
        <>
          {/* Barras: el valor va escrito encima de cada una. El resumen accesible está en aria-label. */}
          <div className="studies-samples-card__plot" role="img" aria-label={chartLabel}>
            {rows.map((row) => (
              <div key={row.id} className="studies-samples-card__column">
                <span className="studies-samples-card__value">{formatCount(row.value)}</span>
                <div
                  className="studies-samples-card__bar"
                  style={{ '--ratio': row.value / max, '--color': row.color }}
                />
              </div>
            ))}
          </div>

          {/* Etiquetas alineadas con las barras: mismo gap y mismo flex:1 */}
          <ul className="studies-samples-card__labels" aria-label={title}>
            {rows.map((row) => (
              <li key={row.id} className="studies-samples-card__label">
                <span
                  className="studies-samples-card__icon"
                  style={{ '--color': row.color, '--tint': row.tint }}
                  aria-hidden="true"
                >
                  <row.Icon size={20} />
                </span>
                <span className="studies-samples-card__name">{row.label}</span>
                <span className="studies-samples-card__percent">{formatPercent(row.value, total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
