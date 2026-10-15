import { useCallback } from 'react'
import { downloadReportePdfApi } from '../services/reportService'
import { generateDailyReportPdf } from '../utils/pdfGenerator'
import { getArgentinaDateString } from '../utils/formatters'

/**
 * Hook reutilizable para la exportación y descarga del reporte diario en formato PDF.
 * Conecta con el endpoint /app/reports/descargar-pdf/ del backend.
 */
export function useExportReportPdf({
  jornadaDate,
  metrics,
  userData,
  onSuccessNotice
}) {
  const handleExportPdf = useCallback(async () => {
    let dateStr = ''
    if (jornadaDate instanceof Date) {
      dateStr = getArgentinaDateString(jornadaDate)
    } else if (typeof jornadaDate === 'string') {
      dateStr = jornadaDate
    }

    try {
      await downloadReportePdfApi(dateStr)
      if (onSuccessNotice) {
        onSuccessNotice('Reporte oficial en formato PDF descargado del backend exitosamente.')
      }
    } catch (err) {
      console.warn('Fallback a generador PDF local:', err)
      const roleLabel = userData?.rol ? `(${userData.rol})` : '(Secretaría)'
      const generatedBy = userData?.nombre
        ? `${userData.nombre} ${roleLabel}`
        : 'Personal SGTP'

      const safeTargetDate = jornadaDate instanceof Date ? jornadaDate : new Date(jornadaDate)

      generateDailyReportPdf({
        jornadaDate: safeTargetDate,
        stats: {
          atendidos: metrics?.atendidos ?? 0,
          ingresos: metrics?.ingresos ?? 0,
          enCurso: metrics?.enCurso ?? 0,
          esperaPromedio: metrics?.esperaPromedio ?? '—',
          atencionPromedio: metrics?.atencionPromedio ?? '—',
          criticos: metrics?.criticos ?? 0
        },
        triageDistribution: metrics?.triageDistribution ?? {},
        tickets: metrics?.tickets ?? [],
        generatedBy
      })

      if (onSuccessNotice) {
        onSuccessNotice('Reporte diario en formato PDF exportado exitosamente.')
      }
    }
  }, [jornadaDate, metrics, userData, onSuccessNotice])

  return {
    handleExportPdf
  }
}
