import React, { useCallback, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import { useAuth } from '../../context/AuthContext'
import { useSecretariaReport } from '../../hooks/useSecretariaReport'
import SecretariaJornadaBar from './components/SecretariaJornadaBar/SecretariaJornadaBar'
import SendReportEmailModal from './components/SendReportEmailModal/SendReportEmailModal'
import SecretariaKpiGrid from './components/SecretariaKpiGrid/SecretariaKpiGrid'
import TriageDistributionCard from '../../components/ReportCharts/TriageDistributionCard'
import TimeSlotsCard from '../../components/ReportCharts/TimeSlotsCard'
import StudiesLollipopCard from '../../components/ReportCharts/StudiesLollipopCard'
import StudiesSamplesBarsCard from '../../components/ReportCharts/StudiesSamplesBarsCard'
import StaffSecurityCard from '../JefaScreen/components/StaffSecurityCard/StaffSecurityCard'
import { useStaffManagement } from '../../hooks/useStaffManagement'
import { getTodayLocalDateString } from '../../utils/formatters'
import './SecretariaScreen.css'
import { useWebSocket } from '../../hooks/useWebSocket'

export default function SecretariaScreen() {
  const { userData } = useAuth()
  const {
    staffList,
    loadingStaff,
    staffError,
    unlockStaff,
    lockStaff
  } = useStaffManagement()

  const [isThirdPartyEmailModalOpen, setIsThirdPartyEmailModalOpen] = useState(false)

  const {
    jornadaDate,
    jornadaEndDate,
    periodMode,
    setJornadaDate,
    applyPeriodRange,
    notice,
    errorNotice,
    emailError,
    clearEmailError,
    isSendingEmail,
    metrics,
    handleExportPdf,
    handleExportExcel,
    handleSendEmail,
    showNotice,
    refreshMetrics
  } = useSecretariaReport({ userData })

  const handleUnlockStaff = (staffMemberId) => {
    unlockStaff(staffMemberId, showNotice)
  }

  const handleLockStaff = (staffMemberId) => {
    lockStaff(staffMemberId, showNotice)
  }

  const lastRefreshRef = useRef(0)

  const handleWsEvent = useCallback(
    (msg) => {
      const evt = msg?.event || msg?.action || msg?.tipo_evento
      const isRelevant = [
        'REALTIME_METRICS_UPDATED',
        'REFRESH_REPORTS',
        'TICKET_CREATED',
        'NEW_TICKET',
        'TICKET_UPDATED',
        'TICKET_LLAMADO',
        'reporte_actualizado'
      ].includes(evt)

      if (!isRelevant) return

      const today = getTodayLocalDateString()
      const endDate = jornadaEndDate || jornadaDate
      if (today >= jornadaDate && today <= endDate) {
        const now = Date.now()
        if (now - lastRefreshRef.current > 400) {
          lastRefreshRef.current = now
          refreshMetrics()
        }
      }
    },
    [jornadaDate, jornadaEndDate, refreshMetrics]
  )

  // Implementación de WebSocket para actualización de métricas en tiempo real
  useWebSocket('reportes', { onMessage: handleWsEvent })
  useWebSocket('tickets', { onMessage: handleWsEvent })

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

        {errorNotice && !isThirdPartyEmailModalOpen && (
          <div className="secretaria-screen__notice secretaria-screen__notice--error" role="alert">
            <AlertCircle className="secretaria-screen__notice-icon" />
            <span className="secretaria-screen__notice-text">{errorNotice}</span>
          </div>
        )}

        <SecretariaJornadaBar
          jornadaDate={jornadaDate}
          jornadaEndDate={jornadaEndDate}
          periodMode={periodMode}
          onDateChange={(selectedDateValue) => setJornadaDate(selectedDateValue)}
          onApplyPeriod={applyPeriodRange}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
          onSendEmail={() => handleSendEmail()}
          onOpenThirdPartyEmailModal={() => setIsThirdPartyEmailModalOpen(true)}
          userEmail={userData?.email || ''}
          isSendingEmail={isSendingEmail}
        />

        <SendReportEmailModal
          isOpen={isThirdPartyEmailModalOpen}
          onClose={() => setIsThirdPartyEmailModalOpen(false)}
          onConfirmSend={(customEmail) => handleSendEmail(customEmail)}
          isSending={isSendingEmail}
          backendError={emailError}
          onClearError={clearEmailError}
        />

        <SecretariaKpiGrid
          atendidos={metrics.atendidos}
          cancelados={metrics.cancelados}
          ingresos={metrics.ingresos}
          enCurso={metrics.enCurso}
          tasaCompletitud={metrics.tasaCompletitud}
          tasaDesercion={metrics.tasaDesercion}
          esperaPromedio={metrics.esperaPromedio}
          atencionPromedio={metrics.atencionPromedio}
          criticos={metrics.criticos}
        />

        <TimeSlotsCard franjasHorarias={metrics.franjasHorarias} />

        <div className="secretaria-screen__study-summaries">
          <StudiesLollipopCard
            items={metrics.resumenEstudiosRealizadosPorSeccion ?? []}
            error={!Array.isArray(metrics.resumenEstudiosRealizadosPorSeccion)}
          />
          <StudiesSamplesBarsCard
            items={metrics.resumenEstudiosRealizadosPorMuestra ?? []}
            error={!Array.isArray(metrics.resumenEstudiosRealizadosPorMuestra)}
          />
        </div>

        <TriageDistributionCard
          triageDistribution={metrics.triageDistribution}
          slaTriage={metrics.slaTriage}
          franjasHorarias={metrics.franjasHorarias}
        />

        <section className="secretaria-screen__security-section" aria-labelledby="secretaria-security-title">
          <h2 id="secretaria-security-title" className="secretaria-screen__section-title">
            Seguridad y bloqueo de cuentas
          </h2>
          {loadingStaff ? (
            <div className="secretaria-screen__staff-status" role="status">
              Cargando el listado de personal...
            </div>
          ) : staffError ? (
            <div className="secretaria-screen__staff-status secretaria-screen__staff-status--error" role="alert">
              No se pudo cargar el listado de personal: {staffError}
            </div>
          ) : (
            <StaffSecurityCard
              staffList={staffList}
              currentUserRole={userData?.rol}
              currentUserId={userData?.id_personal ?? userData?.id}
              onUnlockStaff={handleUnlockStaff}
              onLockStaff={handleLockStaff}
            />
          )}
        </section>
      </main>
    </div>
  )
}
