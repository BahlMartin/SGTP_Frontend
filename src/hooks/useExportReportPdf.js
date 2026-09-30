import { useCallback } from 'react'
import { generateDailyReportPdf } from '../utils/pdfGenerator'

/**
 * Hook reutilizable para la exportación y descarga del reporte diario en formato PDF.
 * Diseñado para ser consumido tanto en JefaScreen como en SecretariaScreen.
 */
export function useExportReportPdf({
  jornadaDate,
  metrics,
  userData,
  onSuccessNotice
}) {
  const handleExportPdf = useCallback(() => {
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
      onSuccessNotice('Reporte diario en formato PDF exportado y descargado exitosamente.')
    }
  }, [jornadaDate, metrics, userData, onSuccessNotice])

  return {
    handleExportPdf
  }
}
