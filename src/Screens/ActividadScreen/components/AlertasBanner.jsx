import React, { useState } from 'react'
import {
    ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowRight
} from 'lucide-react'
import './AlertasBanner.css'

export default function AlertasBanner({ alertas = [], onSelectEvent, onFilterAlerts }) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!alertas || alertas.length === 0) return null

  return (
    <section className="alertas-banner" aria-label="Alertas operacionales">
      <div className="alertas-banner__header">
        <div className="alertas-banner__title-wrapper">
          <div className="alertas-banner__icon-wrapper" aria-hidden="true">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="alertas-banner__title">
              Requieren Revisión ({alertas.length})
            </h3>
            <p className="alertas-banner__description">
              Eventos de seguridad o anomalías operativas detectadas recientemente.
            </p>
          </div>
        </div>

        <div className="alertas-banner__actions">
          {onFilterAlerts && (
            <button
              type="button"
              className="alertas-banner__btn-filter"
              onClick={onFilterAlerts}
            >
              Ver solo alertas en tabla
            </button>
          )}
          <button
            type="button"
            className="alertas-banner__btn-toggle"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            title={isExpanded ? 'Colapsar alertas' : 'Expandir alertas'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <ul className="alertas-banner__list">
          {alertas.map((al, idx) => {
            const isAlta = al.severidad === 'ALTA'
            return (
              <li key={al.evento_id || idx} className="alertas-banner__item">
                <span
                  className={`alertas-banner__badge ${
                    isAlta
                      ? 'alertas-banner__badge--alta'
                      : 'alertas-banner__badge--media'
                  }`}
                >
                  {al.severidad || 'ALERTA'}
                </span>
                <span className="alertas-banner__item-time">{al.hora}</span>
                <span className="alertas-banner__item-text">{al.titulo}</span>
                <span className="alertas-banner__item-quien">
                  ({al.quien})
                </span>
                {onSelectEvent && al.evento_id && (
                  <button
                    type="button"
                    className="alertas-banner__item-action"
                    onClick={() => onSelectEvent(al.evento_id)}
                    title="Inspeccionar en panel lateral"
                  >
                    Detalle <ArrowRight size={13} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

