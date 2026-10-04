import React from 'react'
import './TriageDistributionItem.css'

export default function TriageDistributionItem({
  categoryName,
  patientCount = 0,
  percentageValue = 0,
  cssModifier = 'otro'
}) {
  const progressWidth = Math.min(Math.max(Number(percentageValue) || 0, 0), 100)

  return (
    <div className="triage-dist-item">
      <div className="triage-dist-item__labels">
        <span className="triage-dist-item__name">{categoryName}</span>
        <span className="triage-dist-item__qty">{patientCount}</span>
      </div>
      <div
        className="triage-dist-item__bar-track"
        role="progressbar"
        aria-label={`Distribución de ${categoryName}`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progressWidth}
      >
        <div
          className={`triage-dist-item__bar-fill triage-dist-item__bar-fill--${cssModifier}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  )
}
