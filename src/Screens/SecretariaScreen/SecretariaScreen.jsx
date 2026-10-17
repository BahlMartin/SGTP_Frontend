import React, { useCallback } from 'react'   
import { CheckCircle2 } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import { useAuth } from '../../context/AuthContext'
import { useSecretariaReport } from '../../hooks/useSecretariaReport'
import SecretariaJornadaBar from './components/SecretariaJornadaBar/SecretariaJornadaBar'
import SecretariaKpiGrid from './components/SecretariaKpiGrid/SecretariaKpiGrid'
import TriageDistributionCard from './components/TriageDistributionCard/TriageDistributionCard'
import './SecretariaScreen.css'

import useWebSocket from '../../hooks/useWebSocket' // [NUEVO]

export default function SecretariaScreen() {
  const { userData } = useAuth()

  const {
    jornadaDate,
    setJornadaDate,
    notice,
    isSendingEmail,
    metrics,
    getPercentage,
    handleExportPdf,
    handleSendEmail
  } = useSecretariaReport({ userData })

  // [NUEVO] Escuchar el canal de reportes
  useWebSocket('reportes', {
    onMessage: useCallback((msg) => {
      if (msg?.action === 'REFRESH_REPORTS') {
        // Si tu hook useSecretariaReport no expone una función "refreshMetrics", 
        // un truco reactivo limpio es re-asignar la fecha actual para que 
        // el useEffect dentro del hook vuelva a dispararse:
        setJornadaDate((prev) => new Date(prev).toISOString().split('T')[0] + ' ') 
        setTimeout(() => setJornadaDate(jornadaDate), 50) 
      }
    }, [jornadaDate, setJornadaDate])
  })

  return (
    <div className="secretaria-screen">
      <Navbar />

      <main className="secretaria-screen__main">
        <header className="secretaria-screen__header">
          <h1 className="secretaria-screen__title">Reportes</h1>
          <p className="secretaria-screen__subtitle">Consulta y descarga de reportes diarios</p>
        </header>

        {notice && (
          <div className="secretaria-screen__notice" role="status">
            <CheckCircle2 className="secretaria-screen__notice-icon" />
            <span className="secretaria-screen__notice-text">{notice}</span>
          </div>
        )}

        <SecretariaJornadaBar
          jornadaDate={jornadaDate}
          onDateChange={(selectedDateValue) => setJornadaDate(selectedDateValue)}
          onExportPdf={handleExportPdf}
          onSendEmail={handleSendEmail}
          isSendingEmail={isSendingEmail}
        />

        <SecretariaKpiGrid
          atendidos={metrics.atendidos}
          ingresos={metrics.ingresos}
          enCurso={metrics.enCurso}
          esperaPromedio={metrics.esperaPromedio}
          atencionPromedio={metrics.atencionPromedio}
          criticos={metrics.criticos}
        />

        <TriageDistributionCard
          triageDistribution={metrics.triageDistribution}
          calculatePercentage={getPercentage}
        />
      </main>
    </div>
  )
}
