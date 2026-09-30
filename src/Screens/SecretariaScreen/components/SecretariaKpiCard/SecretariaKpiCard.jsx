import React from 'react'
import './SecretariaKpiCard.css'

export default function SecretariaKpiCard({
  icon: IconComponent,
  metricTitle,
  metricValue,
  metricSubtext
}) {
  return (
    <div className="secretaria-kpi-card">
      <div className="secretaria-kpi-card__top">
        {IconComponent && (
          <span className="secretaria-kpi-card__icon">
            <IconComponent />
          </span>
        )}
        <span className="secretaria-kpi-card__title">{metricTitle}</span>
      </div>
      <div className="secretaria-kpi-card__value">{metricValue}</div>
      <div className="secretaria-kpi-card__subtext">{metricSubtext}</div>
    </div>
  )
}
