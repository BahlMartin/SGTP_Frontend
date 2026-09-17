import React from 'react'
import { getTriageInfo } from '../../utils/triageAlgorithm'
import './TriageBadge.css'

export default function TriageBadge({ categoryKey, showPriority = true }) {
  const info = getTriageInfo(categoryKey)

  return (
    <span
      className="triage-badge"
      style={{
        backgroundColor: info.bgBadge,
        color: info.textColor,
        borderColor: info.color + '40'
      }}
    >
      <span className="triage-dot" style={{ backgroundColor: info.color }} />
      <span className="triage-text">
        {showPriority ? `${info.code}. ` : ''}
        {info.key}
      </span>
    </span>
  )
}
