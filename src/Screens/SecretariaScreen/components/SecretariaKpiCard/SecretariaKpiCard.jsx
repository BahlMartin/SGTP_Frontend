import React from 'react'
import './SecretariaKpiCard.css'

export default function SecretariaKpiCard({
  icon: IconComponent,
  metricTitle,
  metricValue,
  metricSubtext,
  metricRates = null
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

      {metricRates && (
        <div className="secretaria-kpi-card__rates">
          <div
            className="secretaria-kpi-card__progress"
            role="img"
            aria-label={`${metricRates.completitudLabel}, ${metricRates.desercionLabel}`}
          >
            {metricRates.hasData && (
              <>
                <span
                  className="secretaria-kpi-card__progress-segment secretaria-kpi-card__progress-segment--completed"
                  style={{ width: `${metricRates.completitudPct}%` }}
                />
                <span
                  className="secretaria-kpi-card__progress-segment secretaria-kpi-card__progress-segment--active"
                  style={{ width: `${metricRates.enCursoPct}%` }}
                />
                <span
                  className="secretaria-kpi-card__progress-segment secretaria-kpi-card__progress-segment--deserted"
                  style={{ width: `${metricRates.desercionPct}%` }}
                />
              </>
            )}
          </div>
          <div className="secretaria-kpi-card__badges">
            <span className="secretaria-kpi-card__badge secretaria-kpi-card__badge--completed">
              {metricRates.completitudLabel}
            </span>
            <span className="secretaria-kpi-card__badge secretaria-kpi-card__badge--deserted">
              {metricRates.desercionLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
