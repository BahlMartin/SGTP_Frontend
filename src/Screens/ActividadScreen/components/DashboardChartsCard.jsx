import React, { useState } from 'react';
import './DashboardChartsCard.css';

export default function DashboardChartsCard({
  actividadPorHora = [],
  cancelacionesPorMotivo = [],
  cancelacionesDesglose = null
}) {
  // Filtros interactivos de sector para cancelaciones (Admisión y Box)
  const [selAdmision, setSelAdmision] = useState(true);
  const [selBox, setSelBox] = useState(true);

  // Generar las 24 horas del día (00:00 a 23:00) si backend no envió datos completos
  const defaultHours = Array.from({ length: 24 }, (_, i) => ({
    hora: i,
    count: 0,
    h: '0%'
  }));

  // Combinar o usar las 24 horas
  let bars = defaultHours;
  if (actividadPorHora && actividadPorHora.length > 0) {
    if (actividadPorHora.length === 24) {
      bars = actividadPorHora;
    } else {
      const map = new Map(actividadPorHora.map((b) => [b.hora, b]));
      bars = defaultHours.map((dh) => map.get(dh.hora) || dh);
    }
  }

  // Toggle de sectores de cancelación
  const handleToggleSector = (sector) => {
    if (sector === 'admision') {
      if (selAdmision && !selBox) {
        setSelBox(true);
      } else {
        setSelAdmision((prev) => !prev);
      }
    } else if (sector === 'box') {
      if (selBox && !selAdmision) {
        setSelAdmision(true);
      } else {
        setSelBox((prev) => !prev);
      }
    }
  };

  // Determinar sector activo
  let activeSector = 'general';
  if (selAdmision && selBox) {
    activeSector = 'general';
  } else if (selAdmision) {
    activeSector = 'admision';
  } else if (selBox) {
    activeSector = 'box';
  }

  // Lista de motivos según el sector seleccionado
  const motivosAMostrar =
    cancelacionesDesglose && cancelacionesDesglose[activeSector]
      ? cancelacionesDesglose[activeSector]
      : cancelacionesPorMotivo || [];

  const totalCancelaciones = motivosAMostrar.reduce((acc, m) => acc + (m.n || 0), 0);

  return (
    <section className="dashboard-charts-card" aria-label="Métricas de actividad y cancelaciones">
      {/* Actividad por hora (24 hs completas) */}
      <div className="dashboard-charts-card__block">
        <div className="dashboard-charts-card__header-row">
          <h2 className="dashboard-charts-card__title">Actividad por hora (24 hs)</h2>
        </div>
        <div
          role="img"
          aria-label="Eventos por hora durante las 24 horas del día"
          className="dashboard-charts-card__bars-container"
        >
          {bars.map((b, idx) => (
            <div
              key={b.hora ?? idx}
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
          <span>00</span>
          <span>04</span>
          <span>08</span>
          <span>12</span>
          <span>16</span>
          <span>20</span>
          <span>23</span>
        </div>
      </div>

      {/* Cancelaciones por motivo con filtro Admisión / Box */}
      <div className="dashboard-charts-card__block">
        <div className="dashboard-charts-card__header-row">
          <h2 className="dashboard-charts-card__title">
            Cancelaciones por motivo
            {activeSector !== 'general' && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#be185d', marginLeft: '6px' }}>
                ({activeSector === 'admision' ? 'Admisión' : 'Box'})
              </span>
            )}
          </h2>

          <div className="dashboard-charts-card__sector-filters" role="group" aria-label="Filtrar por sector">
            <button
              type="button"
              className={`dashboard-charts-card__sector-btn ${selAdmision ? 'dashboard-charts-card__sector-btn--active' : ''}`}
              onClick={() => handleToggleSector('admision')}
              title="Filtrar cancelaciones de Admisión"
            >
              Admisión
            </button>
            <button
              type="button"
              className={`dashboard-charts-card__sector-btn ${selBox ? 'dashboard-charts-card__sector-btn--active' : ''}`}
              onClick={() => handleToggleSector('box')}
              title="Filtrar cancelaciones de Box"
            >
              Box
            </button>
          </div>
        </div>

        {motivosAMostrar && motivosAMostrar.length > 0 && totalCancelaciones > 0 ? (
          <div className="dashboard-charts-card__motivos-list">
            {motivosAMostrar.map((m, idx) => (
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
            Sin cancelaciones registradas hoy en{' '}
            {activeSector === 'general' ? 'el sistema' : activeSector === 'admision' ? 'Admisión' : 'Box'}.
          </p>
        )}
      </div>
    </section>
  );
}
