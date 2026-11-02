import { Users, Clock, BarChart3 } from 'lucide-react'

const formatPct = (val) => {
  const num = Number(val)
  if (!Number.isFinite(num) || num <= 0) return '0%'
  return `${num.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

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
    getSubtext: (metricsData) => {
      const cancelados = metricsData?.cancelados ?? 0
      const adm = metricsData?.canceladosAdmision ?? 0
      const box = metricsData?.canceladosBox ?? 0
      let cancText = `${cancelados} ausentes`
      if (adm > 0 && box > 0) {
        cancText = `${cancelados} ausentes (${adm} adm · ${box} box)`
      } else if (adm > 0) {
        cancText = `${cancelados} ausentes (${adm} en adm)`
      } else if (box > 0) {
        cancText = `${cancelados} ausentes (${box} en box)`
      }
      return `${metricsData?.ingresos ?? 0} ingresos · ${cancText} · ${metricsData?.enCurso ?? 0} en curso`
    },
    getRates: (metricsData) => {
      const ingresos = Number(metricsData?.ingresos) || 0
      const completitud =
        metricsData?.tasaCompletitud !== undefined
          ? Number(metricsData.tasaCompletitud)
          : ingresos > 0
            ? ((Number(metricsData?.atendidos) || 0) / ingresos) * 100
            : 0
      const desercion =
        metricsData?.tasaDesercion !== undefined
          ? Number(metricsData.tasaDesercion)
          : ingresos > 0
            ? ((Number(metricsData?.cancelados) || 0) / ingresos) * 100
            : 0
      const enCursoPct = Math.max(0, 100 - completitud - desercion)

      return {
        hasData: ingresos > 0,
        completitudPct: Math.min(100, Math.max(0, completitud)),
        desercionPct: Math.min(100, Math.max(0, desercion)),
        enCursoPct: ingresos > 0 ? enCursoPct : 0,
        completitudLabel: `${formatPct(completitud)} completitud`,
        desercionLabel: `${formatPct(desercion)} deserción`
      }
    }
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
