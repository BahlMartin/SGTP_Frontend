import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { computeDailyReportMetrics } from '../services/reportService'
import { getTodayLocalDateString } from '../utils/formatters'
import { useExportReportPdf } from './useExportReportPdf'
import { useSendReportEmail } from './useSendReportEmail'

/**
 * Hook personalizado para orquestar el estado de Secretaría, el cómputo de métricas
 * y delegar la exportación en PDF y el despacho de correos en hooks especializados.
 */
export function useSecretariaReport({ tickets = [], userData = null }) {
  const [jornadaDate, setJornadaDate] = useState(() => getTodayLocalDateString())
  const [notice, setNotice] = useState(null)
  const noticeTimerRef = useRef(null)

  // Limpieza del temporizador en desmontaje
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current)
      }
    }
  }, [])

  // Asegurar fecha por defecto si el usuario limpia el input
  useEffect(() => {
    if (!jornadaDate) {
      setJornadaDate(getTodayLocalDateString())
    }
  }, [jornadaDate])

  const showNotice = useCallback((messageText) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current)
    }
    setNotice(messageText)
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null)
    }, 4000)
  }, [])

  // Métricas dinámicas calculadas según la fecha seleccionada de forma memorizada
  const metrics = useMemo(() => {
    return computeDailyReportMetrics(tickets, jornadaDate)
  }, [tickets, jornadaDate])

  // Total de pacientes para proporciones visuales
  const totalPacientes = useMemo(() => {
    const countsList = Object.values(metrics.triageDistribution || {})
    const sum = countsList.reduce(
      (accumulatedTotal, currentCategoryCount) => accumulatedTotal + currentCategoryCount,
      0
    )
    return sum || 1
  }, [metrics.triageDistribution])

  // Porcentaje proporcional para visualización de barras
  const getPercentage = useCallback(
    (patientCount) => {
      if (!patientCount) {
        return 5 // Ancho visual mínimo
      }
      const rawPercentage = (patientCount / totalPacientes) * 100
      return Math.min(Math.max(rawPercentage, 10), 100)
    },
    [totalPacientes]
  )

  // Hook reutilizable para exportación de PDF
  const { handleExportPdf } = useExportReportPdf({
    jornadaDate,
    metrics,
    userData,
    onSuccessNotice: showNotice
  })

  // Hook reutilizable para despacho por correo
  const { handleSendEmail, isSendingEmail } = useSendReportEmail({
    jornadaDate,
    recipientEmail: userData?.email,
    onSuccessNotice: showNotice
  })

  return {
    jornadaDate,
    setJornadaDate,
    notice,
    isSendingEmail,
    metrics,
    totalPacientes,
    getPercentage,
    handleExportPdf,
    handleSendEmail,
    showNotice
  }
}
