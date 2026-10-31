import React from 'react';
import './DashboardChartsCard.css';

export default function DashboardChartsCard({ actividadPorHora = [], cancelacionesPorMotivo = [] }) {
  // Asegurar horas base si backend no envió
  const defaultHours = [
    { hora: 7, count: 0, h: '0%' },
    { hora: 8, count: 0, h: '0%' },
    { hora: 9, count: 0, h: '0%' },
    { hora: 10, count: 0, h: '0%' },
    { hora: 11, count: 0, h: '0%' },
    { hora: 12, count: 0, h: '0%' },
    { hora: 13, count: 0, h: '0%' },
    { hora: 14, count: 0, h: '0%' },
    { hora: 15, count: 0, h: '0%' },
    { hora: 16, count: 0, h: '0%' },
    { hora: 17, count: 0, h: '0%' },
    { hora: 18, count: 0, h: '0%' },
    { hora: 19, count: 0, h: '0%' }
  ];

  const bars = (actividadPorHora && actividadPorHora.length > 0) ? actividadPorHora : defaultHours;

  const totalCancelaciones = (cancelacionesPorMotivo || []).reduce((acc, m) => acc + (m.n || 0), 0);

  return (
    <section className="dashboard-charts-card" aria-label="Métricas de actividad y cancelaciones">
      {/* Actividad por hora */}
      <div className="dashboard-charts-card__block">
        <h2 className="dashboard-charts-card__title">Actividad por hora</h2>
        <div
          role="img"
          aria-label="Eventos por hora"
          className="dashboard-charts-card__bars-container"
        >
          {bars.map((b, idx) => (
            <div
              key={b.hora || idx}
              className="dashboard-charts-card__bar-col"
              title={`${String(b.hora).padStart(2, '0')}:00 hs · ${b.count || 0} eventos`}
            >
              <div
                className="dashboard-charts-card__bar"
                style={{ height: b.h || '0%' }}
              />
            </div>
          ))}
        </div>
        <div className="dashboard-charts-card__hours-labels">
          <span>07</span>
          <span>09</span>
          <span>11</span>
          <span>13</span>
          <span>15</span>
          <span>17</span>
          <span>19</span>
        </div>
      </div>

      {/* Cancelaciones por motivo */}
      <div className="dashboard-charts-card__block">
        <h2 className="dashboard-charts-card__title">Cancelaciones por motivo</h2>
        {cancelacionesPorMotivo && cancelacionesPorMotivo.length > 0 && totalCancelaciones > 0 ? (
          <div className="dashboard-charts-card__motivos-list">
            {cancelacionesPorMotivo.map((m, idx) => (
              <div key={idx} className="dashboard-charts-card__motivo-row">
                <span className="dashboard-charts-card__motivo-label" title={m.label}>
                  {m.label}
                </span>
                <span className="dashboard-charts-card__motivo-bar-bg">
                  <span
                    className="dashboard-charts-card__motivo-bar-fill"
                    style={{ width: m.w || '0%' }}
                  />
                </span>
                <span className="dashboard-charts-card__motivo-count">{m.n}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="dashboard-charts-card__empty">
            Sin cancelaciones registradas hoy en el sistema.
          </p>
        )}
      </div>
    </section>
  );
}

