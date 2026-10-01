import React from 'react'
import './TriageDistributionItem.css'

export default function TriageDistributionItem({
  categoryName,
  patientCount = 0,
  percentageValue = 5,
  cssModifier = 'otro'
}) {
  return (
    <div className="triage-dist-item">
      <div className="triage-dist-item__labels">
        <span className="triage-dist-item__name">{categoryName}</span>
        <span className="triage-dist-item__qty">{patientCount}</span>
      </div>
      <div className="triage-dist-item__bar-track">
        <svg
          className="triage-dist-item__bar-svg"
          viewBox="0 0 100 14"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            x="0"
            y="0"
            width={percentageValue}
            height="14"
            rx="7"
            className={`triage-dist-item__bar-fill triage-dist-item__bar-fill--${cssModifier}`}
          />
        </svg>
      </div>
    </div>
  )
}
