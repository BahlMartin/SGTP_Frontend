import React from 'react'
import { CheckCircle2 } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import { useAuth } from '../../context/AuthContext'
import { useSecretariaReport } from '../../hooks/useSecretariaReport'
import SecretariaJornadaBar from './components/SecretariaJornadaBar/SecretariaJornadaBar'
import SecretariaKpiGrid from './components/SecretariaKpiGrid/SecretariaKpiGrid'
import TriageDistributionCard from './components/TriageDistributionCard/TriageDistributionCard'
import './SecretariaScreen.css'
import { useWebSocket } from '../../hooks/useWebSocket'

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

  // Implementación de WebSocket
  const { lastMessage: wsReportMessage } = useWebSocket('ws/reportes')
  const { lastMessage: wsTicketMessage } = useWebSocket('ws/tickets')

  React.useEffect(() => {
    if (wsReportMessage?.event === 'REALTIME_METRICS_UPDATED' || wsTicketMessage?.event === 'TICKET_CREATED') {
      // Como el hook recarga los datos al cambiar la fecha, forzamos un re-render suave 
      // si estás mirando el día de HOY. Si estás viendo reportes del mes pasado, no hacemos nada.
      const today = new Date().toISOString().split('T')[0]
      if (jornadaDate === today) {
         // Este truco dispara el useEffect de tu hook useSecretariaReport
         setJornadaDate(prev => prev) 
      }
    }
  }, [wsReportMessage, wsTicketMessage, jornadaDate, setJornadaDate])

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
