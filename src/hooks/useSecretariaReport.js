import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { computeDailyReportMetrics, fetchMetricasDiariasApi } from '../services/reportService'
import { getTodayLocalDateString } from '../utils/formatters'
import { useExportReportPdf } from './useExportReportPdf'
import { useSendReportEmail } from './useSendReportEmail'
import { useFeedbackNotice } from './useFeedbackNotice'

const EMPTY_TICKETS = []

/**
 * Hook personalizado para orquestar el estado de Secretaría, el cómputo de métricas
 * reales desde el backend y delegar la exportación en PDF y el despacho de correos.
 */
export function useSecretariaReport({ tickets = EMPTY_TICKETS, userData = null }) {
  const [jornadaDate, setJornadaDate] = useState(() => getTodayLocalDateString())
  const { notice, showNotice } = useFeedbackNotice(4000)
  const ticketsRef = useRef(tickets)

  useEffect(() => {
    ticketsRef.current = tickets
  }, [tickets])

  // Asegurar fecha por defecto si el usuario limpia el input
  useEffect(() => {
    if (!jornadaDate) {
      setJornadaDate(getTodayLocalDateString())
    }
  }, [jornadaDate])

  const [metrics, setMetrics] = useState(() => computeDailyReportMetrics(tickets, jornadaDate))

  const refreshMetrics = useCallback(async () => {
    if (!jornadaDate) return
    try {
      const backendMetrics = await fetchMetricasDiariasApi(jornadaDate)
      if (backendMetrics) {
        setMetrics(backendMetrics)
      }
    } catch (err) {
      console.warn('Utilizando cómputo asistencial de métricas:', err)
      setMetrics(computeDailyReportMetrics(ticketsRef.current, jornadaDate))
    }
  }, [jornadaDate])

  // Sincronizar métricas consolidadas con el backend al cambiar la fecha
  useEffect(() => {
    let cancelled = false
    async function loadBackendMetrics() {
      try {
        const backendMetrics = await fetchMetricasDiariasApi(jornadaDate)
        if (!cancelled && backendMetrics) {
          setMetrics(backendMetrics)
        }
      } catch (err) {
        console.warn('Utilizando cómputo asistencial de métricas:', err)
        if (!cancelled) {
          setMetrics(computeDailyReportMetrics(ticketsRef.current, jornadaDate))
        }
      }
    }
    loadBackendMetrics()
    return () => {
      cancelled = true
    }
  }, [jornadaDate])

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
        return 0
      }
      const rawPercentage = (patientCount / totalPacientes) * 100
      return Math.min(rawPercentage, 100)
    },
    [totalPacientes]
  )

  // Hook reutilizable para exportación de PDF (conectado con backend)
  const { handleExportPdf } = useExportReportPdf({
    jornadaDate,
    onSuccessNotice: showNotice
  })

  // Hook reutilizable para despacho por correo SMTP (conectado con backend)
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
    showNotice,
    refreshMetrics
  }
}
