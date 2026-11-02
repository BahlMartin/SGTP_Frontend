import React from 'react';
import './ActivityStripSVG.css';

export default function ActivityStripSVG({
  turnoProgramado = { inicio: 7, fin: 15, label: '07:00–15:00', es_ilimitado: false },
  barras = [],
  gaps = [],
  selectedBar = null,
  onSelectBar = () => {}
}) {
  const isIlimitado = Boolean(
    turnoProgramado.es_ilimitado ||
    turnoProgramado.esIlimitado ||
    (turnoProgramado.inicio === 0 && (turnoProgramado.fin >= 23.9 || turnoProgramado.fin === 24))
  );

  // Determinar rango de horas
  const startHour = barras.length > 0 ? barras[0].inicio : (isIlimitado ? 0 : 7);
  const endHour = barras.length > 0 ? barras[barras.length - 1].fin : (isIlimitado ? 24 : 19);
  const totalRange = Math.max(1, endHour - startHour);

  // Posición del turno programado
  const turnoIni = isIlimitado ? startHour : (turnoProgramado.inicio ?? 7);
  const turnoFin = isIlimitado ? endHour : (turnoProgramado.fin ?? 15);
  const shiftLeftPct = Math.max(0, Math.min(100, ((turnoIni - startHour) / totalRange) * 100));
  const shiftWidthPct = Math.max(2, Math.min(100 - shiftLeftPct, ((turnoFin - turnoIni) / totalRange) * 100));

  // Generar etiquetas de horas para el eje inferior
  const axisHours = [];
  const step = totalRange > 16 ? 4 : totalRange > 10 ? 2 : 1;
  const startInt = Math.floor(startHour);
  const endInt = Math.ceil(endHour);
  for (let h = startInt; h <= endInt; h += step) {
    axisHours.push(String(h).padStart(2, '0'));
  }
  // Asegurar etiqueta final si no está
  const lastHourStr = String(endInt).padStart(2, '0');
  if (axisHours[axisHours.length - 1] !== lastHourStr && endInt <= 24) {
    axisHours.push(lastHourStr);
  }

  return (
    <div className="activity-strip">
      <div className="activity-strip__legend-row">
        <h3 className="activity-strip__title">Turno vs. actividad</h3>
        <span className="activity-strip__legend-items">
          <span className="activity-strip__legend-item">
            <span className="activity-strip__legend-box-turno" />
            <span>{isIlimitado ? 'Turno (24 hs)' : 'Turno'}</span>
          </span>
          <span className="activity-strip__legend-item">
            <span className="activity-strip__legend-box-actividad" />
            <span>Actividad</span>
          </span>
          <span className="activity-strip__legend-item">
            <span className="activity-strip__legend-box-gap" />
            <span>Sin actividad (&gt; 30 min)</span>
          </span>
        </span>
      </div>

      <div
        role="img"
        aria-label={`Gráfico de actividad y turno de ${String(startInt).padStart(2, '0')}:00 a ${String(endInt).padStart(2, '0')}:00`}
        className="activity-strip__chart-area"
      >
        {/* Banda de Turno */}
        <div
          className="activity-strip__shift-band"
          style={{
            left: `${shiftLeftPct}%`,
            width: `${shiftWidthPct}%`
          }}
          title={isIlimitado ? 'Acceso 24hs / Ilimitado' : `Turno contractual: ${turnoProgramado.label || '07:00–15:00'}`}
        />

        {/* Gaps de inactividad > 30m */}
        {gaps && gaps.map((g, gIdx) => {
          const gIni = g.inicio_hora ?? g.inicio;
          const gFin = g.fin_hora ?? g.fin;
          if (gIni === undefined || gFin === undefined) return null;
          const gLeft = Math.max(0, Math.min(100, ((gIni - startHour) / totalRange) * 100));
          const gWidth = Math.max(0.6, Math.min(100 - gLeft, ((gFin - gIni) / totalRange) * 100));
          return (
            <div
              key={g.id || gIdx}
              className="activity-strip__gap-overlay"
              style={{
                left: `${gLeft}%`,
                width: `${gWidth}%`
              }}
              title={`Sin actividad: ${g.rango || `${g.desde} – ${g.hasta}`} (${g.duracion_min ?? g.minutos ?? 30} min)`}
            />
          );
        })}

        {/* Barras de Actividad */}
        <div className="activity-strip__bars-row">
          {barras.map((b) => {
            const hasEvents = b.count > 0;
            const isSelected = selectedBar && selectedBar.id === b.id;
            return (
              <div
                key={b.id}
                className={`activity-strip__bar ${
                  isSelected
                    ? 'activity-strip__bar--selected'
                    : hasEvents
                    ? 'activity-strip__bar--active'
                    : 'activity-strip__bar--empty'
                }`}
                style={{ height: b.h || (hasEvents ? '20%' : '2px') }}
                onClick={() => {
                  if (hasEvents) {
                    onSelectBar(isSelected ? null : b);
                  }
                }}
                title={
                  hasEvents
                    ? `${b.rango || b.hora_label}: ${b.count} evento(s). Click para ver en el registro.`
                    : `${b.rango || b.hora_label}: Sin actividad registrada`
                }
              />
            );
          })}
        </div>
      </div>

      <div className="activity-strip__axis-labels">
        {axisHours.map((hr, idx) => (
          <span key={idx}>{hr}</span>
        ))}
      </div>
    </div>
  );
}
