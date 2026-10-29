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
  ancho = 800,
  alto = 95
}) {
  const [hoveredBlock, setHoveredBlock] = useState(null)

  // Mapeo lineal de horas (0 a 24) al eje X (margen izquierdo 50px, margen derecho 20px)
  const marginX = 45
  const chartWidth = ancho - marginX - 25
  const horaToX = (hora) => marginX + (Math.max(0, Math.min(24, hora)) / 24) * chartWidth

  const shiftStartX = horaToX(turnoProgramado.inicio ?? 7)
  const shiftEndX = horaToX(turnoProgramado.fin ?? 15)
  const shiftWidth = Math.max(2, shiftEndX - shiftStartX)

  const ticks = [0, 4, 8, 12, 16, 20, 24]

  return (
    <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: '100%', minWidth: '600px', display: 'block' }}
        role="img"
        aria-label={`Línea de tiempo de actividad diaria. Turno asignado: ${turnoProgramado.label || '07:00-15:00'}`}
      >
        <defs>
          <pattern id="gapPattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
          </pattern>
        </defs>

        {/* 1. Fondo del timeline */}
        <rect x={marginX} y="30" width={chartWidth} height="32" rx="4" fill="#f8fafc" stroke="#d9e5ea" strokeWidth="1" />

        {/* 2. Franja de Turno Asignado */}
        <rect
          x={shiftStartX}
          y="30"
          width={shiftWidth}
          height="32"
          fill="#e0f2fe"
          opacity="0.75"
          stroke="#1687c9"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* 3. Bloques de Actividad Real */}
        {bloques.map((b, idx) => {
          const x = horaToX(b.inicio)
          const w = Math.max(3, horaToX(b.fin) - x)
          const isFuera = b.tipo === 'fuera_turno'
          const fill = isFuera ? '#ef4444' : '#1687c9'

          return (
            <rect
              key={idx}
              x={x}
              y="34"
              width={w}
              height="24"
              rx="2"
              fill={fill}
              opacity="0.9"
              style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
              onMouseEnter={() => setHoveredBlock(b)}
              onMouseLeave={() => setHoveredBlock(null)}
            >
              <title>{`${b.tipo === 'fuera_turno' ? 'Fuera de turno: ' : 'Actividad: '}${b.inicio_str || b.inicio} a ${b.fin_str || b.fin} (${b.eventos || 1} acciones)`}</title>
            </rect>
          )
        })}

        {/* 4. Marcas de Tiempo y Líneas Guía (Ticks) */}
        {ticks.map((t) => {
          const x = horaToX(t)
          const label = `${String(t).padStart(2, '0')}:00`
          return (
            <g key={t}>
              <line x1={x} y1="62" x2={x} y2="67" stroke="#94a3a8" strokeWidth="1" />
              <text
                x={x}
                y="79"
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

        {/* 5. Leyenda en la cabecera del SVG */}
        <text x={marginX} y="18" fontSize="11" fontWeight="600" fill="#275369">
          Línea de tiempo de actividad (24 hs)
        </text>

        <rect x={ancho - 310} y="8" width="12" height="12" fill="#e0f2fe" stroke="#1687c9" strokeDasharray="2 2" />
        <text x={ancho - 292} y="18" fontSize="10" fill="#647a85">
          Turno ({turnoProgramado.label || 'Asignado'})
        </text>

        <rect x={ancho - 160} y="8" width="12" height="12" fill="#1687c9" rx="2" />
        <text x={ancho - 142} y="18" fontSize="10" fill="#647a85">
          Actividad
        </text>

        <rect x={ancho - 70} y="8" width="12" height="12" fill="#ef4444" rx="2" />
        <text x={ancho - 52} y="18" fontSize="10" fill="#647a85">
          Extra/Fuera
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
            zIndex: 10
          }}
        >
          {hoveredBlock.inicio_str} – {hoveredBlock.fin_str} ({hoveredBlock.eventos} ev.)
        </div>
      )}
    </div>
  )
}

