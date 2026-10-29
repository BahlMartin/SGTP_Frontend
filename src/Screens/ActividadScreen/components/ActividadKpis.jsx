import React from 'react'
import {
  KeyRound,
  ShieldAlert,
  Ban,
  FileScan,
  AlertTriangle,
  Users
} from 'lucide-react'
import './ActividadKpis.css'

export default function ActividadKpis({ kpis = {}, activeFilter, onKpiClick }) {
  const cards = [
    {
      id: 'logins',
      title: 'Inicios de Sesión',
      subtitle: 'Sesiones registradas',
      value: kpis.logins_hoy ?? 0,
      icon: KeyRound,
      color: '#4338ca',
      bg: '#eef0fd',
      filterKey: 'categoria',
      filterVal: 'acceso'
    },
    {
      id: 'fallidos',
      title: 'Fallidos / Bloqueados',
      subtitle: 'Contraseñas erróneas',
      value: kpis.fallidos_bloqueados ?? 0,
      icon: ShieldAlert,
      color: '#b91c1c',
      bg: '#fef2f2',
      alert: (kpis.fallidos_bloqueados ?? 0) > 0,
      filterKey: 'resultado',
      filterVal: 'FALLO'
    },
    {
      id: 'cancelaciones',
      title: 'Cancelaciones',
      subtitle: 'Atenciones anuladas',
      value: kpis.cancelaciones ?? 0,
      icon: Ban,
      color: '#92400e',
      bg: '#fdf3e7',
      alert: (kpis.cancelaciones ?? 0) > 0,
      filterKey: 'accion',
      filterVal: 'ATENCION_CANCELADA'
    },
    {
      id: 'ocr',
      title: 'Escaneos OCR',
      subtitle: 'Recetas digitalizadas',
      value: kpis.escaneos_ocr ?? 0,
      icon: FileScan,
      color: '#0f766e',
      bg: '#e6f4f2',
      filterKey: 'categoria',
      filterVal: 'admision'
    },
    {
      id: 'alertas',
      title: 'Alertas Activas',
      subtitle: 'Requieren atención',
      value: kpis.alertas_activas ?? 0,
      icon: AlertTriangle,
      color: '#d97706',
      bg: '#fffbeb',
      alert: (kpis.alertas_activas ?? 0) > 0,
      filterKey: 'solo_alertas',
      filterVal: true
    },
    {
      id: 'usuarios',
      title: 'Personal Activo',
      subtitle: 'Últimas 24 horas',
      value: kpis.usuarios_activos_24h ?? 0,
      icon: Users,
      color: '#1687c9',
      bg: '#e0f2fe',
      filterKey: null,
      filterVal: null
    }
  ]

  return (
    <div className="actividad-kpis" role="region" aria-label="Métricas de auditoría">
      {cards.map((card) => {
        const Icon = card.icon
        const isSelected =
          card.filterKey &&
          activeFilter &&
          activeFilter[card.filterKey] === card.filterVal

        return (
          <button
            key={card.id}
            type="button"
            className={`actividad-kpi-card ${isSelected ? 'actividad-kpi-card--selected' : ''} ${
              card.alert ? 'actividad-kpi-card--alert' : ''
            }`}
            onClick={() => onKpiClick && onKpiClick(card.filterKey, card.filterVal)}
            title={card.filterKey ? `Filtrar por ${card.title}` : card.title}
          >
            <div className="actividad-kpi-card__top">
              <span className="actividad-kpi-card__title">{card.title}</span>
              <div
                className="actividad-kpi-card__icon-box"
                style={{ color: card.color, backgroundColor: card.bg }}
                aria-hidden="true"
              >
                <Icon size={18} />
              </div>
            </div>
            <div className="actividad-kpi-card__value">{card.value}</div>
            <div className="actividad-kpi-card__subtitle">{card.subtitle}</div>
          </button>
        )
      })}
    </div>
  )
}

