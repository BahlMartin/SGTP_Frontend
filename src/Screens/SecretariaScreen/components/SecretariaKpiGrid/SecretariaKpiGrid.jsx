import React from 'react'
import SecretariaKpiCard from '../SecretariaKpiCard/SecretariaKpiCard'
import { REPORT_KPI_DEFINITIONS } from '../../../../constants/report.constants'
import './SecretariaKpiGrid.css'

export default function SecretariaKpiGrid({
  atendidos = 0,
  ingresos = 0,
  enCurso = 0,
  esperaPromedio = '—',
  atencionPromedio = '—',
  criticos = 0
}) {
  const currentMetrics = {
    atendidos,
    ingresos,
    enCurso,
    esperaPromedio,
    atencionPromedio,
    criticos
  }

  return (
    <div className="secretaria-kpi-grid">
      {REPORT_KPI_DEFINITIONS.map((kpiDefinitionItem) => (
        <SecretariaKpiCard
          key={kpiDefinitionItem.id}
          icon={kpiDefinitionItem.icon}
          metricTitle={kpiDefinitionItem.title}
          metricValue={kpiDefinitionItem.getValue(currentMetrics)}
          metricSubtext={kpiDefinitionItem.getSubtext(currentMetrics)}
        />
      ))}
    </div>
  )
}
