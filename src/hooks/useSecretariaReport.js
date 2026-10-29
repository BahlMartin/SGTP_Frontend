import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { computeDailyReportMetrics, fetchMetricasDiariasApi } from '../services/reportService'
import { getTodayLocalDateString } from '../utils/formatters'
import { useExportReportPdf } from './useExportReportPdf'
import { useExportReportExcel } from './useExportReportExcel'
import { useSendReportEmail } from './useSendReportEmail'
import { useFeedbackNotice } from './useFeedbackNotice'

const EMPTY_TICKETS = []

/**
 * Hook personalizado para orquestar el estado de Secretaría, el cómputo de métricas
 * reales desde el backend (por día, semana, mes o rango de fechas) y delegar
 * la exportación en PDF, Excel y el despacho de correos.
 */
export function useSecretariaReport({ tickets = EMPTY_TICKETS, userData = null }) {
  const [jornadaDate, setJornadaDate] = useState(() => getTodayLocalDateString())
  const [jornadaEndDate, setJornadaEndDate] = useState(() => getTodayLocalDateString())
  const [periodMode, setPeriodMode] = useState('dia') // 'dia' | 'semana' | 'mes' | 'rango'

  const { notice, showNotice } = useFeedbackNotice(4000)
  const { notice: errorNotice, showNotice: showErrorNotice, clearNotice: clearErrorNotice } = useFeedbackNotice(6000)
  const ticketsRef = useRef(tickets)

  useEffect(() => {
    ticketsRef.current = tickets
  }, [tickets])

  // Asegurar fechas por defecto si quedan vacías
  useEffect(() => {
    if (!jornadaDate) {
      const today = getTodayLocalDateString()
      setJornadaDate(today)
      if (!jornadaEndDate) setJornadaEndDate(today)
    }
  }, [jornadaDate, jornadaEndDate])

  // Actualizar período completo (desde, hasta, modo) en una sola operación
  const applyPeriodRange = useCallback((desdeStr, hastaStr = null, mode = 'dia') => {
    const start = desdeStr || getTodayLocalDateString()
    const end = hastaStr || start
    setJornadaDate(start <= end ? start : end)
    setJornadaEndDate(start <= end ? end : start)
    setPeriodMode(mode)
  }, [])

  const [metrics, setMetrics] = useState(() =>
    computeDailyReportMetrics(tickets, jornadaDate, jornadaEndDate)
  )

  const refreshMetrics = useCallback(async () => {
    if (!jornadaDate) return
    const end = jornadaEndDate || jornadaDate
    try {
      const backendMetrics = await fetchMetricasDiariasApi(jornadaDate, end)
      if (backendMetrics) {
        setMetrics(backendMetrics)
      }
    } catch (err) {
      console.warn('Utilizando cómputo asistencial de métricas:', err)
      setMetrics(computeDailyReportMetrics(ticketsRef.current, jornadaDate, end))
    }
  }, [jornadaDate, jornadaEndDate])

  // Sincronizar métricas consolidadas con el backend al cambiar el período aplicado
  useEffect(() => {
    let cancelled = false
    const end = jornadaEndDate || jornadaDate
    async function loadBackendMetrics() {
      try {
        const backendMetrics = await fetchMetricasDiariasApi(jornadaDate, end)
        if (!cancelled && backendMetrics) {
          setMetrics(backendMetrics)
        }
      } catch (err) {
        console.warn('Utilizando cómputo asistencial de métricas:', err)
        if (!cancelled) {
          setMetrics(computeDailyReportMetrics(ticketsRef.current, jornadaDate, end))
        }
      }
    }
    loadBackendMetrics()
    return () => {
      cancelled = true
    }
  }, [jornadaDate, jornadaEndDate])

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
    jornadaEndDate,
    onSuccessNotice: showNotice
  })

  // Hook reutilizable para exportación de Excel (conectado con backend)
  const { handleExportExcel } = useExportReportExcel({
    jornadaDate,
    jornadaEndDate,
    onSuccessNotice: showNotice
  })

  // Hook reutilizable para despacho por correo SMTP (conectado con backend)
  const { handleSendEmail, isSendingEmail, emailError, clearEmailError } = useSendReportEmail({
    jornadaDate,
    jornadaEndDate,
    recipientEmail: userData?.email,
    onSuccessNotice: (msg) => {
      clearErrorNotice()
      showNotice(msg)
    },
    onErrorNotice: (errMsg) => {
      showErrorNotice(errMsg)
    }
  })

  return {
    jornadaDate,
    jornadaEndDate,
    periodMode,
    setJornadaDate: (d) => applyPeriodRange(d, d, 'dia'),
    applyPeriodRange,
    notice,
    errorNotice,
    clearErrorNotice,
    emailError,
    clearEmailError,
    isSendingEmail,
    metrics,
    totalPacientes,
    getPercentage,
    handleExportPdf,
    handleExportExcel,
    handleSendEmail,
    showNotice,
    showErrorNotice,
    refreshMetrics
  }
}
