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
  const fallidosVal = kpis.fallidos_bloqueados ?? kpis.fallidos_hoy ?? 0
  const cancelacionesVal = kpis.cancelaciones ?? kpis.cancelaciones_hoy ?? 0
  const ocrVal = kpis.escaneos_ocr ?? kpis.escaneos_ocr_hoy ?? 0
  const alertasVal = kpis.alertas_activas ?? kpis.alertas_periodo ?? 0
  const usuariosVal = kpis.usuarios_activos_24h ?? kpis.usuarios_activos_hoy ?? kpis.usuarios_activos ?? 0
  const loginsVal = kpis.logins_hoy ?? 0

  const cards = [
    {
      id: 'logins',
      title: 'Inicios de Sesión',
      subtitle: 'Sesiones registradas',
      value: loginsVal,
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
      value: fallidosVal,
      icon: ShieldAlert,
      color: '#b91c1c',
      bg: '#fef2f2',
      alert: fallidosVal > 0,
      filterKey: 'resultado',
      filterVal: 'FALLO'
    },
    {
      id: 'cancelaciones',
      title: 'Cancelaciones',
      subtitle: 'Atenciones anuladas',
      value: cancelacionesVal,
      icon: Ban,
      color: '#92400e',
      bg: '#fdf3e7',
      alert: cancelacionesVal > 0,
      filterKey: 'accion',
      filterVal: 'ATENCION_CANCELADA'
    },
    {
      id: 'ocr',
      title: 'Escaneos OCR',
      subtitle: 'Recetas digitalizadas',
      value: ocrVal,
      icon: FileScan,
      color: '#0f766e',
      bg: '#e6f4f2',
      filterKey: 'ocr',
      filterVal: true
    },
    {
      id: 'alertas',
      title: 'Alertas Activas',
      subtitle: 'Requieren atención',
      value: alertasVal,
      icon: AlertTriangle,
      color: '#d97706',
      bg: '#fffbeb',
      alert: alertasVal > 0,
      filterKey: 'solo_alertas',
      filterVal: true
    },
    {
      id: 'usuarios',
      title: 'Personal Activo',
      subtitle: 'Últimas 24 horas',
      value: usuariosVal,
      icon: Users,
      color: '#1687c9',
      bg: '#e0f2fe',
      filterKey: 'personal_activo',
      filterVal: true
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
