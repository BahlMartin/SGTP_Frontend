import { CircleAlert, Inbox } from 'lucide-react';
import './report-chart-state.css';

const countFormat = new Intl.NumberFormat('es-AR');
const percentFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 1234 -> "1.234" */
export const formatCount = (n) => countFormat.format(n ?? 0);

/** (40, 91) -> "44,0%"  (total 0 -> "0,0%") */
export const formatPercent = (part, total) =>
  `${percentFormat.format(total > 0 ? (part / total) * 100 : 0)}%`;

/** Normaliza lo que llegue del backend a un entero >= 0. */
export const toCount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Estado vacío / error compartido por las tres tarjetas.
 * kind: 'empty' | 'error'
 */
export function ChartState({ kind, message }) {
  const isError = kind === 'error';
  const Icon = isError ? CircleAlert : Inbox;
  return (
    <div
      className={`chart-state${isError ? ' chart-state--error' : ''}`}
      role={isError ? 'alert' : 'status'}
    >
      <Icon className="chart-state__icon" size={28} aria-hidden="true" />
      <p className="chart-state__text">{message}</p>
    </div>
  );
}
