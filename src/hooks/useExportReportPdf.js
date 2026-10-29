import { useCallback } from 'react'
import { downloadReportePdfApi } from '../services/reportService'
import { getArgentinaDateString } from '../utils/formatters'

/**
 * Hook reutilizable para la exportación y descarga del reporte en formato PDF.
 * Conecta con el endpoint /app/reports/descargar-pdf/ del backend.
 */
export function useExportReportPdf({ jornadaDate, jornadaEndDate = null, onSuccessNotice }) {
  const handleExportPdf = useCallback(async () => {
    let dateStr = ''
    if (jornadaDate instanceof Date) {
      dateStr = getArgentinaDateString(jornadaDate)
    } else if (typeof jornadaDate === 'string') {
      dateStr = jornadaDate
    }

    let endDateStr = dateStr
    if (jornadaEndDate instanceof Date) {
      endDateStr = getArgentinaDateString(jornadaEndDate)
    } else if (typeof jornadaEndDate === 'string' && jornadaEndDate.trim()) {
      endDateStr = jornadaEndDate
    }

    try {
      await downloadReportePdfApi(dateStr, endDateStr)
      if (onSuccessNotice) {
        onSuccessNotice('Informe en formato PDF descargado exitosamente.')
      }
    } catch (err) {
      console.error('Error al descargar el informe PDF:', err)
      if (onSuccessNotice) {
        onSuccessNotice('No se pudo generar el informe PDF. Intente nuevamente en unos instantes.')
      }
    }
  }, [jornadaDate, jornadaEndDate, onSuccessNotice])

  return {
    handleExportPdf
  }
}
