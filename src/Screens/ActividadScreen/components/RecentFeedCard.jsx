import React from 'react';
import './RecentFeedCard.css';

function FeedIcon({ category }) {
  if (category === 'acceso') {
    // Key icon
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 7.5a4 4 0 1 1-1 2.6L4 20v-3h3v-2h2l2.5-2.5" />
      </svg>
    );
  }
  if (category === 'cancelacion') {
    // Ban icon
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
      </svg>
    );
  }
  if (category === 'alerta') {
    // Alert triangle
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01" />
      </svg>
    );
  }
  if (category === 'atencion') {
    // Box / ticket
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2 M8.5 2h7 M14.5 16h-5" />
      </svg>
    );
  }
  // Default / scan / audit
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export default function RecentFeedCard({
  feed = [],
  mostrarTablaCompleta = false,
  onToggleTablaCompleta = () => {},
  onSelectEvent = () => {}
}) {
  return (
    <section className="recent-feed-card" aria-label="Actividad reciente">
      <div className="recent-feed-card__header">
        <h2 className="recent-feed-card__title">Feed reciente · últimos 20</h2>
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
          {feed.map((item) => (
            <li
              key={item.id}
              className="recent-feed-card__item"
              onClick={() => onSelectEvent(item.id)}
              title="Click para ver detalle en panel lateral"
            >
              <time className="recent-feed-card__time">{item.t}</time>
              <span
                className="recent-feed-card__icon-badge"
                style={{ color: item.fg || '#334155', backgroundColor: item.bg || '#edf2f5' }}
              >
                <FeedIcon category={item.category} />
              </span>
              <span className="recent-feed-card__who">{item.who}</span>
              <span className="recent-feed-card__what">{item.what}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="recent-feed-card__empty">
          No hay eventos recientes registrados hoy.
        </div>
      )}
    </section>
  );
}

