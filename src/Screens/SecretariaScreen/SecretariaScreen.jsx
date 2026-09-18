import React, { useState, useEffect } from 'react'
import {
  Download,
  Mail,
  Users,
  Clock,
  BarChart3,
  CheckCircle2
} from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { computeDailyReportMetrics, sendDailyReportEmailApi } from '../../services/reportService'
import { generateDailyReportPdf } from '../../utils/pdfGenerator'
import './SecretariaScreen.css'

const getTodayDateString = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const localDate = new Date(now.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 10)
}

export default function SecretariaScreen() {
  const { tickets } = useTriageQueue()
  const { userData } = useAuth()
  const [jornadaDate, setJornadaDate] = useState(() => getTodayDateString())
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!jornadaDate) {
      setJornadaDate(getTodayDateString())
    }
  }, [jornadaDate])

  // Métricas dinámicas calculadas según la fecha seleccionada
  const metrics = computeDailyReportMetrics(tickets, jornadaDate)
  const { atendidos, enCurso, ingresos, criticos, esperaPromedio, atencionPromedio, triageDistribution } = metrics

  // Calcular el total para proporciones de barras
  const totalPacientes = Object.values(triageDistribution).reduce((a, b) => a + b, 0) || 1

  const getPercentage = (count) => {
    if (!count) return 5 // Un pequeño ancho visual mínimo como en el mockup
    return Math.min(Math.max((count / totalPacientes) * 100, 10), 100)
  }

  const handleExportPdf = () => {
    generateDailyReportPdf({
      jornadaDate: new Date(jornadaDate),
      stats: {
        atendidos,
        ingresos,
        enCurso,
        esperaPromedio,
        atencionPromedio,
        criticos
      },
      triageDistribution,
      tickets: metrics.tickets,
      generatedBy: `${userData?.nombre} (Secretaría)`
    })
    showBanner('Reporte diario en formato PDF exportado y descargado exitosamente.')
  }

  const handleSendEmail = async () => {
    try {
      const res = await sendDailyReportEmailApi(jornadaDate, userData?.email)
      showBanner(res.message)
    } catch (err) {
      alert(err.message)
    }
  }

  const showBanner = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  return (
    <div className="secretaria-screen-layout">
      <Navbar />

      <main className="secretaria-main-content">
        <div className="secretaria-header-text">
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Consulta y descarga de reportes diarios</p>
        </div>

        {notice && (
          <div className="secretaria-notice-banner">
            <CheckCircle2 size={18} />
            <span>{notice}</span>
          </div>
        )}

        {/* Controles de Jornada y Acciones (Imagen 1) */}
        <div className="jornada-control-bar">
          <div className="jornada-picker-wrap">
            <span className="jornada-label">Jornada:</span>
            <div className="input-date-styled">
              <input
                type="date"
                value={jornadaDate}
                onChange={(e) => setJornadaDate(e.target.value)}
                className="date-input"
              />
            </div>
          </div>

          <div className="jornada-buttons">
            <button className="btn-action-teal" onClick={handleExportPdf}>
              <Download size={15} />
              exportar PDF
            </button>
            <button className="btn-action-white" onClick={handleSendEmail}>
              <Mail size={15} />
              enviar por mail
            </button>
          </div>
        </div>

        {/* 4 Stat Metric Cards (Imagen 1) */}
        <div className="kpi-cards-grid">
          {/* Card 1: Atendidos */}
          <div className="kpi-card">
            <div className="kpi-card-top">
              <Users size={18} className="kpi-icon" />
              <span className="kpi-title">atendidos</span>
            </div>
            <div className="kpi-value">{atendidos}</div>
            <div className="kpi-subtext">
              {ingresos} ingresos - {enCurso} en curso
            </div>
          </div>

          {/* Card 2: Espera Promedio */}
          <div className="kpi-card">
            <div className="kpi-card-top">
              <Clock size={18} className="kpi-icon" />
              <span className="kpi-title">Espera promedio</span>
            </div>
            <div className="kpi-value">{esperaPromedio}</div>
            <div className="kpi-subtext">Emision → llamado</div>
          </div>

          {/* Card 3: Atención Promedio */}
          <div className="kpi-card">
            <div className="kpi-card-top">
              <Clock size={18} className="kpi-icon" />
              <span className="kpi-title">Atención promedio</span>
            </div>
            <div className="kpi-value">{atencionPromedio}</div>
            <div className="kpi-subtext">Llamado → cierre</div>
          </div>

          {/* Card 4: Críticos */}
          <div className="kpi-card">
            <div className="kpi-card-top">
              <BarChart3 size={18} className="kpi-icon" />
              <span className="kpi-title">Críticos</span>
            </div>
            <div className="kpi-value">{criticos}</div>
            <div className="kpi-subtext">Guardia + Médicos</div>
          </div>
        </div>

        {/* Tarjeta de Distribución por Triage (Imagen 1) */}
        <div className="triage-distribution-card">
          <h3 className="dist-title">Distribucion por triage</h3>

          <div className="dist-bars-two-cols">
            {/* Columna Izquierda de Barras */}
            <div className="dist-col">
              {/* Guardia */}
              <div className="dist-bar-item">
                <div className="dist-bar-labels">
                  <span className="dist-name">Guardia</span>
                  <span className="dist-qty">{triageDistribution.guardia}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill bar-guardia"
                    style={{ width: `${getPercentage(triageDistribution.guardia)}%` }}
                  />
                </div>
              </div>

              {/* Discapacidad */}
              <div className="dist-bar-item">
                <div className="dist-bar-labels">
                  <span className="dist-name">Discapacidad</span>
                  <span className="dist-qty">{triageDistribution.discapacidad}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill bar-discapacidad"
                    style={{ width: `${getPercentage(triageDistribution.discapacidad)}%` }}
                  />
                </div>
              </div>

              {/* Extracción con turno */}
              <div className="dist-bar-item">
                <div className="dist-bar-labels">
                  <span className="dist-name">Extraccion con turno</span>
                  <span className="dist-qty">{triageDistribution.extraccion_con_turno}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill bar-ext-turno"
                    style={{ width: `${getPercentage(triageDistribution.extraccion_con_turno)}%` }}
                  />
                </div>
              </div>

              {/* Otro */}
              <div className="dist-bar-item">
                <div className="dist-bar-labels">
                  <span className="dist-name">Otro</span>
                  <span className="dist-qty">{triageDistribution.otro}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill bar-otro"
                    style={{ width: `${getPercentage(triageDistribution.otro)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Columna Derecha de Barras */}
            <div className="dist-col">
              {/* Médicos */}
              <div className="dist-bar-item">
                <div className="dist-bar-labels">
                  <span className="dist-name">Medicos</span>
                  <span className="dist-qty">{triageDistribution.medicos}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill bar-medicos"
                    style={{ width: `${getPercentage(triageDistribution.medicos)}%` }}
                  />
                </div>
              </div>

              {/* Oncología */}
              <div className="dist-bar-item">
                <div className="dist-bar-labels">
                  <span className="dist-name">Oncologia</span>
                  <span className="dist-qty">{triageDistribution.oncologia}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill bar-oncologia"
                    style={{ width: `${getPercentage(triageDistribution.oncologia)}%` }}
                  />
                </div>
              </div>

              {/* Extracción sin turno */}
              <div className="dist-bar-item">
                <div className="dist-bar-labels">
                  <span className="dist-name">Extraccion sin turno</span>
                  <span className="dist-qty">{triageDistribution.extraccion_sin_turno}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill bar-ext-sinturno"
                    style={{ width: `${getPercentage(triageDistribution.extraccion_sin_turno)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
