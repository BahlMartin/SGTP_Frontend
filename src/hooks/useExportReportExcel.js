import { useCallback } from 'react'
import { downloadReporteExcelApi } from '../services/reportService'
import { getArgentinaDateString } from '../utils/formatters'

/**
 * Hook reutilizable para la exportación y descarga del reporte diario en formato Excel (.xlsx).
 * Conecta con el endpoint /app/reports/descargar-excel/ del backend.
 */
export function useExportReportExcel({ jornadaDate, onSuccessNotice }) {
  const handleExportExcel = useCallback(async () => {
    let dateStr = ''
    if (jornadaDate instanceof Date) {
      dateStr = getArgentinaDateString(jornadaDate)
    } else if (typeof jornadaDate === 'string') {
      dateStr = jornadaDate
    }

    try {
      await downloadReporteExcelApi(dateStr)
      if (onSuccessNotice) {
        onSuccessNotice('Informe en formato Excel (.xlsx) descargado exitosamente.')
      }
    } catch (err) {
      console.error('Error al descargar el informe Excel:', err)
      if (onSuccessNotice) {
        onSuccessNotice('No se pudo generar el informe Excel. Intente nuevamente en unos instantes.')
      }
    }
  }, [jornadaDate, onSuccessNotice])

  return {
    handleExportExcel
  }
}

