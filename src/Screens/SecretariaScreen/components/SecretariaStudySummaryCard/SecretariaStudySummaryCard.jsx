import React from 'react'
import './SecretariaStudySummaryCard.css'

export default function SecretariaStudySummaryCard({
  title,
  items,
  labelKey,
  keyKey,
  scrollable = false
}) {
  const hasSummary = Array.isArray(items)

  return (
    <section className="secretaria-study-summary" aria-label={title}>
      <header className="secretaria-study-summary__header">
        <h2 className="secretaria-study-summary__title">{title}</h2>
        <span className="secretaria-study-summary__count">
          {hasSummary
            ? `${items.length} ${items.length === 1 ? 'categoría' : 'categorías'}`
            : 'No disponible'}
        </span>
      </header>

      {!hasSummary ? (
        <p className="secretaria-study-summary__empty" role="alert">
          El resumen no está disponible para esta jornada.
        </p>
      ) : items.length > 0 ? (
        <ul className={`secretaria-study-summary__list ${scrollable ? 'secretaria-study-summary__list--scrollable' : ''}`}>
          {items.map((item) => (
            <li
              className="secretaria-study-summary__row"
              key={item[keyKey] || item[labelKey]}
            >
              <span className="secretaria-study-summary__label">{item[labelKey]}</span>
              <span className="secretaria-study-summary__total">
                {item.total_estudios}
                <span className="secretaria-study-summary__total-label">estudios</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="secretaria-study-summary__empty">
          No hay estudios realizados para esta jornada.
        </p>
      )}
    </section>
  )
}
