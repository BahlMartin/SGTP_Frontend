import React from 'react'
import { getTriageInfo } from '../../constants/triage.constants'
import './TriageBadge.css'

export default function TriageBadge({ categoryKey, showPriority = true, compact = false }) {
  const info = getTriageInfo(categoryKey)
  const categoryClass = info?.id ? `triage-badge--${info.id}` : 'triage-badge--otro'
  const categoryLabel = compact
    ? {
        extraccion_con_turno: 'Ext. con turno',
        extraccion_sin_turno: 'Ext. sin turno'
      }[info.id] || info.key
    : info.key

  return (
    <span className={`triage-badge ${categoryClass}`}>
      <span className="triage-badge__dot" />
      <span className="triage-badge__text">
        {showPriority ? `${info.code}. ` : ''}
        {categoryLabel}
      </span>
    </span>
  )
}
