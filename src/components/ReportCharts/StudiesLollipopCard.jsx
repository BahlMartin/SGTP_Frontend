import { useId, useMemo } from 'react';
import { ChartState, formatCount, toCount } from './reportChartUtils';
import './StudiesLollipopCard.css';

/**
 * B2: lollipop (línea + punto) con todas las secciones ordenadas de mayor a menor.
 * Si hay más de `scrollAfter` filas, la lista scrollea dentro de la tarjeta.
 *
 * Uso:
 *   <StudiesLollipopCard items={resumen.por_seccion} error={errResumen} />
 *
 * @param {object}  props
 * @param {Array}   props.items       [{ seccion_key, nombre_seccion, total_estudios }]
 * @param {string}  [props.labelKey]  default 'nombre_seccion'
 * @param {string}  [props.keyKey]    default 'seccion_key'
 * @param {string}  [props.valueKey]  default 'total_estudios'
 * @param {number}  [props.scrollAfter] filas visibles antes de scrollear (default 16)
 * @param {boolean} [props.error]     true si falló el backend
 */
export default function StudiesLollipopCard({
  title = 'Estudios realizados por sección',
  items,
  labelKey = 'nombre_seccion',
  keyKey = 'seccion_key',
  valueKey = 'total_estudios',
  scrollAfter = 16,
  error = false,
  emptyMessage = 'No hay estudios realizados para esta jornada.',
  errorMessage = 'El resumen no está disponible para esta jornada.',
}) {
  const titleId = useId();

  const sorted = useMemo(
    () =>
      (items ?? [])
        .map((item) => ({
          id: String(item[keyKey]),
          label: String(item[labelKey] ?? ''),
          value: toCount(item[valueKey]),
        }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es')),
    [items, keyKey, labelKey, valueKey],
  );

  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const max = sorted[0]?.value || 1;
  const isEmpty = !error && total === 0;
  const scrolls = sorted.length > scrollAfter;

  return (
    <section className="studies-lollipop-card" aria-labelledby={titleId}>
      <header className="studies-lollipop-card__header">
        <h2 id={titleId} className="studies-lollipop-card__title">
          {title}
        </h2>
        {!error && (
          <span className="studies-lollipop-card__total">
            <strong>{formatCount(total)}</strong>
            {total === 1 ? 'estudio' : 'estudios'}
          </span>
        )}
      </header>

      {error && <ChartState kind="error" message={errorMessage} />}
      {isEmpty && <ChartState kind="empty" message={emptyMessage} />}

      {!error && !isEmpty && (
        <ul
          className={`studies-lollipop-card__list${scrolls ? ' studies-lollipop-card__list--scroll' : ''}`}
          style={scrolls ? { '--visible-rows': scrollAfter } : undefined}
          aria-label={title}
          tabIndex={scrolls ? 0 : undefined}
        >
          {sorted.map((item) => (
            <li key={item.id} className="studies-lollipop-card__row">
              <span className="studies-lollipop-card__name" title={item.label}>
                {item.label}
              </span>
              <span className="studies-lollipop-card__track" aria-hidden="true">
                <span className="studies-lollipop-card__stem" style={{ '--size': `${(item.value / max) * 100}%` }} />
                <span className="studies-lollipop-card__dot" style={{ '--size': `${(item.value / max) * 100}%` }} />
              </span>
              <span className="studies-lollipop-card__count">{formatCount(item.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
