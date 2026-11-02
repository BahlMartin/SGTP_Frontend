import React from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react'
import './AlertasBanner.css'

export default function AlertasBanner({ alertas = [], onSelectEvent, onFilterAlerts }) {
  if (!alertas || alertas.length === 0) {
    return (
      <section className="alertas-banner" aria-label="Requieren revisión">
        <h2 className="alertas-banner__heading">
          <AlertTriangle size={18} color="#92400e" />
          <span>Requieren revisión (0)</span>
        </h2>
        <div className="alertas-banner__empty-state">
          <CheckCircle2 size={18} color="#16a34a" />
          <span>No hay anomalías operacionales pendientes de revisión</span>
        </div>
      </section>
    )
  }

  return (
    <section className="alertas-banner" aria-label="Requieren revisión">
      <div className="alertas-banner__header">
        <h2 className="alertas-banner__heading">
          <AlertTriangle size={18} color="#92400e" />
          <span>Requieren revisión ({alertas.length})</span>
        </h2>
        {onFilterAlerts && (
          <button
            type="button"
            className="alertas-banner__btn-filter"
            onClick={onFilterAlerts}
            title="Filtrar solo alertas en la tabla"
          >
            Ver solo alertas
          </button>
        )}
      </div>

      <ul className="alertas-banner__list">
        {alertas.map((al, idx) => {
          const isAlta = al.severidad === 'ALTA'
          return (
            <li
              key={al.evento_id || idx}
              className={`alertas-banner__card-item ${
                isAlta
                  ? 'alertas-banner__card-item--alta'
                  : 'alertas-banner__card-item--media'
              }`}
              onClick={() => onSelectEvent && al.evento_id && onSelectEvent(al.evento_id)}
            >
              <span className="alertas-banner__sev-pill">
                <ShieldAlert size={15} />
                <span>{isAlta ? 'Alta' : 'Media'}</span>
              </span>

              <div className="alertas-banner__item-info">
                <span className="alertas-banner__item-title">{al.titulo}</span>
                <span className="alertas-banner__item-sub">
                  {al.quien} · {al.hora}{al.ip ? ` · IP ${al.ip}` : ''}
                </span>
              </div>

              {onSelectEvent && al.evento_id && (
                <button
                  type="button"
                  className="alertas-banner__btn-ver-eventos"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectEvent(al.evento_id)
                  }}
                  title="Inspeccionar detalle en panel lateral"
                >
                  Ver eventos
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

