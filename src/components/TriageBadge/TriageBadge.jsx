import React from 'react'
import { getTriageInfo } from '../../constants/triage.constants'
import './TriageBadge.css'

export default function TriageBadge({ categoryKey, showPriority = true }) {
  const info = getTriageInfo(categoryKey)
  const categoryClass = info?.id ? `triage-badge--${info.id}` : 'triage-badge--otro'

  return (
    <span className={`triage-badge ${categoryClass}`}>
      <span className="triage-badge__dot" />
      <span className="triage-badge__text">
        {showPriority ? `${info.code}. ` : ''}
        {info.key}
      </span>
    </span>
  )
}
