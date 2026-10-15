import { Users, Clock, BarChart3 } from 'lucide-react'

/**
 * Esquema de configuración para las tarjetas de indicadores clave (KPI)
 * del módulo de reportes diarios.
 */
export const REPORT_KPI_DEFINITIONS = [
  {
    id: 'kpi-atendidos',
    icon: Users,
    title: 'atendidos',
    getValue: (metricsData) => metricsData?.atendidos ?? 0,
    getSubtext: (metricsData) =>
      `${metricsData?.ingresos ?? 0} ingresos - ${metricsData?.enCurso ?? 0} en curso`
  },
  {
    id: 'kpi-espera',
    icon: Clock,
    title: 'Espera promedio',
    getValue: (metricsData) => metricsData?.esperaPromedio ?? '—',
    getSubtext: () => 'Emision → llamado'
  },
  {
    id: 'kpi-atencion',
    icon: Clock,
    title: 'Atención promedio',
    getValue: (metricsData) => metricsData?.atencionPromedio ?? '—',
    getSubtext: () => 'Llamado → cierre'
  },
  {
    id: 'kpi-criticos',
    icon: BarChart3,
    title: 'Críticos',
    getValue: (metricsData) => metricsData?.criticos ?? 0,
    getSubtext: () => 'De los atendidos · Guardia + Médicos'
  }
]
