import React from 'react'
import TriageDistributionItem from './TriageDistributionItem'
import { TRIAGE_CATEGORIES } from '../../../../constants/triage.constants'
import './TriageDistributionCard.css'

const LEFT_COLUMN_CATEGORIES = [
  TRIAGE_CATEGORIES.GUARDIA,
  TRIAGE_CATEGORIES.DISCAPACIDAD,
  TRIAGE_CATEGORIES.EXTRACCION_CON_TURNO,
  TRIAGE_CATEGORIES.OTRO
]

const RIGHT_COLUMN_CATEGORIES = [
  TRIAGE_CATEGORIES.MEDICOS,
  TRIAGE_CATEGORIES.ONCOLOGIA,
  TRIAGE_CATEGORIES.EXTRACCION_SIN_TURNO
]

export default function TriageDistributionCard({
  triageDistribution = {},
  calculatePercentage
}) {
  const renderColumnItems = (columnCategoriesList) => {
    return columnCategoriesList.map((categoryItem) => {
      const patientCount = triageDistribution[categoryItem.id] || 0
      const percentageValue = calculatePercentage ? calculatePercentage(patientCount) : 0

      return (
        <TriageDistributionItem
          key={categoryItem.id}
          categoryName={categoryItem.key}
          patientCount={patientCount}
          percentageValue={percentageValue}
          cssModifier={categoryItem.id}
        />
      )
    })
  }

  return (
    <div className="triage-distribution-card">
      <h3 className="triage-distribution-card__title">Distribucion por triage</h3>

      <div className="triage-distribution-card__grid">
        <div className="triage-distribution-card__column">
          {renderColumnItems(LEFT_COLUMN_CATEGORIES)}
        </div>
        <div className="triage-distribution-card__column">
          {renderColumnItems(RIGHT_COLUMN_CATEGORIES)}
        </div>
      </div>
    </div>
  )
}
