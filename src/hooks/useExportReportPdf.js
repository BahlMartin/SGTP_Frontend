import { useCallback } from 'react'
import { downloadReportePdfApi } from '../services/reportService'
import { getArgentinaDateString } from '../utils/formatters'

/**
 * Hook reutilizable para la exportación y descarga del reporte diario en formato PDF.
 * Conecta con el endpoint /app/reports/descargar-pdf/ del backend, que es la única
 * fuente del documento oficial (no existe generador local de respaldo).
 */
export function useExportReportPdf({ jornadaDate, onSuccessNotice }) {
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
        onSuccessNotice('Informe en formato PDF descargado exitosamente.')
      }
    } catch (err) {
      console.error('Error al descargar el informe PDF:', err)
      if (onSuccessNotice) {
        onSuccessNotice('No se pudo generar el informe PDF. Intente nuevamente en unos instantes.')
      }
    }
  }, [jornadaDate, onSuccessNotice])

  return {
    handleExportPdf
  }
}
