import React from 'react';
import { Ban, AlertTriangle } from 'lucide-react';
import { CATEGORIAS_CONFIG } from '../constants/auditoriaConstants';
import './RecentFeedCard.css';

/**
 * Obtiene el ícono y color exactos que utiliza la tabla modal de auditoría
 */
function getFeedItemBadge(item) {
  // 1. Cancelaciones operacionales
  if (item.accion === 'ATENCION_CANCELADA') {
    return {
      Icon: Ban,
      color: '#be185d',
      bg: '#fbe8f1',
      title: 'Cancelación'
    };
  }

  // 2. Alertas o fallos de autenticación / denegaciones
  if (item.resultado === 'FALLO' || (item.alertas && item.alertas.length > 0)) {
    return {
      Icon: AlertTriangle,
      color: '#d97706',
      bg: '#fffbeb',
      title: 'Alerta / Fallo'
    };
  }

  // 3. Categoría según configuración unificada de la tabla modal (acceso, admisión, box, gestión, reportes, sla)
  const catKey = (item.categoria || '').toLowerCase();
  const cat = CATEGORIAS_CONFIG[catKey] || CATEGORIAS_CONFIG.gestion;

  return {
    Icon: cat.Icon,
    color: cat.color,
    bg: cat.bg,
    title: cat.label
  };
}

export default function RecentFeedCard({
  feed = [],
  filtros = {},
  mostrarTablaCompleta = false,
  onToggleTablaCompleta = () => {},
  onSelectEvent = () => {}
}) {
  let feedTitle = 'Feed reciente · últimos 20';
  if (filtros.accion === 'ATENCION_CANCELADA') {
    feedTitle = 'Feed reciente · últimas 20 cancelaciones';
  } else if (filtros.resultado === 'FALLO') {
    feedTitle = 'Feed reciente · últimos 20 fallos / bloqueos';
  } else if (filtros.solo_alertas) {
    feedTitle = 'Feed reciente · últimas 20 alertas';
  } else if (filtros.ocr) {
    feedTitle = 'Feed reciente · últimos 20 escaneos OCR';
  } else if (filtros.accion === 'LOGIN_EXITOSO' || filtros.categoria === 'acceso') {
    feedTitle = 'Feed reciente · últimos 20 accesos';
  }

  return (
    <section className="recent-feed-card" aria-label="Actividad reciente">
      <div className="recent-feed-card__header">
        <h2 className="recent-feed-card__title">{feedTitle}</h2>
        <button
          type="button"
          className="recent-feed-card__toggle-btn"
          onClick={onToggleTablaCompleta}
        >
          {mostrarTablaCompleta ? 'Ocultar tabla ✕' : 'Ver todo →'}
        </button>
      </div>

      {feed && feed.length > 0 ? (
        <ul className="recent-feed-card__list">
          {feed.map((item) => {
            const badge = getFeedItemBadge(item);
            const BadgeIcon = badge.Icon;

            return (
              <li
                key={item.id}
                className="recent-feed-card__item"
                onClick={() => onSelectEvent(item.id)}
                title="Click para ver detalle en panel lateral"
              >
                <time className="recent-feed-card__time">{item.t}</time>
                <span
                  className="recent-feed-card__icon-badge"
                  style={{ color: badge.color, backgroundColor: badge.bg }}
                  title={badge.title}
                >
                  <BadgeIcon size={14} />
                </span>
                <span className="recent-feed-card__who">{item.who}</span>
                <span className="recent-feed-card__what">{item.what}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="recent-feed-card__empty">
          No hay eventos recientes registrados hoy.
        </div>
      )}
    </section>
  );
}
