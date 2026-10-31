import React, { useState } from 'react'

/**
 * ActivityStripSVG:
 * Componente SVG nativo y reactivo para representar la línea de tiempo de 24 horas:
 * - Banda de turno asignado (ej. 07:00 - 15:00).
 * - Bloques de actividad real en la jornada.
 * - Indicadores visuales de gaps de inactividad > 30m.
 * - Resaltado de actividad fuera de turno (horas extras / accesos anómalos).
 */
export default function ActivityStripSVG({
  turnoProgramado = { inicio: 7, fin: 15, label: '07:00–15:00' },
  bloques = [],
  ancho = 850,
  alto = 100,
  onSelectEvent
}) {
  const [hoveredBlock, setHoveredBlock] = useState(null)

  const isIlimitado = Boolean(
    turnoProgramado.es_ilimitado ||
    turnoProgramado.esIlimitado ||
    (turnoProgramado.inicio === 0 && (turnoProgramado.fin >= 23.9 || turnoProgramado.fin === 24))
  )

  // Mapeo lineal de horas (0 a 24) al eje X (margen izquierdo 45px, margen derecho 25px)
  const marginX = 45
  const chartWidth = ancho - marginX - 25
  const horaToX = (hora) => marginX + (Math.max(0, Math.min(24, hora)) / 24) * chartWidth

  const shiftStartX = isIlimitado ? marginX : horaToX(turnoProgramado.inicio ?? 7)
  const shiftEndX = isIlimitado ? marginX + chartWidth : horaToX(turnoProgramado.fin ?? 15)
  const shiftWidth = Math.max(2, shiftEndX - shiftStartX)

  const ticks = [0, 4, 8, 12, 16, 20, 24]

  const getBlockColor = (b) => {
    if (b.color_tipo === 'login') return '#6366f1'
    if (b.color_tipo === 'cancelacion') return '#dc2626'
    if (b.color_tipo === 'alerta') return '#f59e0b'
    if (b.color_tipo === 'ticket') return '#1687c9'
    if (b.tipo === 'fuera_turno' && !isIlimitado) return '#ef4444'
    return '#1687c9'
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: '100%', minWidth: '650px', display: 'block' }}
        role="img"
        aria-label={`Línea de tiempo de actividad diaria. Turno asignado: ${turnoProgramado.label || '07:00-15:00'}`}
      >
        <defs>
          <pattern id="gapPattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
          </pattern>
        </defs>

        {/* 1. Fondo del timeline */}
        <rect x={marginX} y="32" width={chartWidth} height="32" rx="4" fill="#f8fafc" stroke="#d9e5ea" strokeWidth="1" />

        {/* 2. Franja de Turno Asignado */}
        <rect
          x={shiftStartX}
          y="32"
          width={shiftWidth}
          height="32"
          fill={isIlimitado ? '#ecfdf5' : '#e0f2fe'}
          opacity={isIlimitado ? '0.45' : '0.75'}
          stroke={isIlimitado ? '#10b981' : '#1687c9'}
          strokeWidth="1"
          strokeDasharray={isIlimitado ? 'none' : '3 3'}
        />

        {/* 3. Bloques de Actividad Real */}
        {bloques.map((b, idx) => {
          const x = horaToX(b.inicio)
          const w = Math.max(4, horaToX(b.fin) - x)
          const fill = getBlockColor(b)

          return (
            <rect
              key={idx}
              x={x}
              y="36"
              width={w}
              height="24"
              rx="3"
              fill={fill}
              opacity="0.92"
              style={{
                cursor: b.evento_id ? 'pointer' : 'default',
                transition: 'opacity 0.15s ease, transform 0.15s ease'
              }}
              onClick={() => {
                if (b.evento_id && onSelectEvent) {
                  onSelectEvent(b.evento_id)
                }
              }}
              onMouseEnter={() => setHoveredBlock(b)}
              onMouseLeave={() => setHoveredBlock(null)}
            >
              <title>{`${b.titulo || 'Actividad'}: ${b.inicio_str || b.inicio} (${b.color_tipo || b.tipo}) - Clic para ver detalle`}</title>
            </rect>
          )
        })}

        {/* 4. Marcas de Tiempo y Líneas Guía (Ticks) */}
        {ticks.map((t) => {
          const x = horaToX(t)
          const label = `${String(t).padStart(2, '0')}:00`
          return (
            <g key={t}>
              <line x1={x} y1="64" x2={x} y2="69" stroke="#94a3a8" strokeWidth="1" />
              <text
                x={x}
                y="81"
                textAnchor="middle"
                fontSize="10"
                fontFamily="monospace"
                fill="#647a85"
                fontWeight="500"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* 5. Leyenda en la cabecera del SVG con colores por actividad */}
        <text x={marginX} y="18" fontSize="11" fontWeight="600" fill="#275369">
          Línea de tiempo de actividad (24 hs)
        </text>

        {/* Leyenda: Turno */}
        <rect x={marginX + 190} y="8" width="10" height="10" fill={isIlimitado ? '#ecfdf5' : '#e0f2fe'} stroke={isIlimitado ? '#10b981' : '#1687c9'} strokeDasharray={isIlimitado ? 'none' : '2 2'} />
        <text x={marginX + 204} y="17" fontSize="10" fill="#647a85">
          {isIlimitado ? 'Acceso 24h' : 'Turno'}
        </text>

        {/* Leyenda: Login */}
        <rect x={marginX + 270} y="8" width="10" height="10" fill="#6366f1" rx="2" />
        <text x={marginX + 284} y="17" fontSize="10" fill="#647a85">
          Inicio Sesión
        </text>

        {/* Leyenda: Ticket */}
        <rect x={marginX + 365} y="8" width="10" height="10" fill="#1687c9" rx="2" />
        <text x={marginX + 379} y="17" fontSize="10" fill="#647a85">
          Ticket / Atención
        </text>

        {/* Leyenda: Alerta */}
        <rect x={marginX + 480} y="8" width="10" height="10" fill="#f59e0b" rx="2" />
        <text x={marginX + 494} y="17" fontSize="10" fill="#647a85">
          Alerta
        </text>

        {/* Leyenda: Cancelación */}
        <rect x={marginX + 545} y="8" width="10" height="10" fill="#dc2626" rx="2" />
        <text x={marginX + 559} y="17" fontSize="10" fill="#647a85">
          Cancelación
        </text>
      </svg>

      {/* Tooltip flotante al hacer hover en bloque */}
      {hoveredBlock && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            left: `${horaToX(hoveredBlock.inicio)}px`,
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '4px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          {hoveredBlock.titulo || hoveredBlock.accion} ({hoveredBlock.inicio_str} – {hoveredBlock.fin_str}) · Clic para abrir detalle
        </div>
      )}
    </div>
  )
}

