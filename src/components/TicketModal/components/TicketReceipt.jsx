import React from 'react'
import { formatDateDDMMAAAA, formatTimeHHMM } from '../../../utils/formatters'
import TriageBadge from '../../TriageBadge/TriageBadge'
import './TicketReceipt.css'

export default function TicketReceipt({ ticket }) {
  if (!ticket) return null

  const formatAdmision = () => {
    const nombre = ticket.personal_admision_nombre?.trim()
    const matricula = (ticket.personal_admision_matricula || ticket.mat_admision)?.trim()

    if (nombre && matricula) return `${nombre} (Mat. ${matricula})`
    if (nombre) return nombre
    if (matricula) return `Mat. ${matricula}`
    return 'No informada'
  }

  const formatBoxOperador = () => {
    const nombre = ticket.personal_box_nombre?.trim()
    const matricula = ticket.personal_box_matricula?.trim()

    if (nombre && matricula) return `${nombre} (Mat. ${matricula})`
    if (nombre) return nombre
    if (matricula) return `Mat. ${matricula}`
    return ''
  }

  const boxOperador = formatBoxOperador()
  const boxIdentificador = ticket.box_numero
    ? `Box ${ticket.box_numero}`
    : (ticket.box_asignado || (ticket.estado === 'Atendido' || ticket.estado === 'Finalizado' ? 'Box asignado' : ''))

  const isAtendido = ticket.estado === 'Atendido' || ticket.estado === 'Finalizado'

  const detailRows = [
    { label: 'Paciente:', value: `${ticket.paciente_nombre} ${ticket.paciente_apellido}` },
    { label: 'DNI:', value: ticket.paciente_dni },
    { label: 'Obra Social:', value: ticket.paciente_obra_social || ticket.obra_social || 'IOMA' },
    { label: 'N° Afiliado:', value: ticket.paciente_numero_afiliado || 'No informado' },
    { label: 'Triage:', value: <TriageBadge categoryKey={ticket.clasificacion_triage} /> },
    ticket.justificacion_otro && {
      label: 'Justificación:',
      value: ticket.justificacion_otro,
      small: true
    },
    {
      label: 'Fecha y Hora:',
      value: `${formatDateDDMMAAAA(ticket.fecha_hora_admision)} ${formatTimeHHMM(ticket.fecha_hora_admision)}`
    },
    { label: 'Admisión:', value: formatAdmision() },
    boxIdentificador && { label: 'Box de Atención:', value: boxIdentificador },
    boxOperador && { label: 'Técnico de Box:', value: boxOperador },
    ticket.estado === 'Cancelado' && {
      label: 'Estado del Turno:',
      value: 'Cancelado / Paciente Ausente',
      isCancelled: true
    },
    ticket.observaciones_cierre_box && {
      label: 'Observación Box:',
      value: ticket.observaciones_cierre_box,
      small: true,
      isCancelled: true
    },
    ticket.fecha_hora_atencion_box && {
      label: 'Hora Box:',
      value: `${formatDateDDMMAAAA(ticket.fecha_hora_atencion_box)} ${formatTimeHHMM(ticket.fecha_hora_atencion_box)}`
    },
    ticket.fecha_estimada_entrega && {
      id: 'fecha_retiro_row',
      label: 'Retiro estimado:',
      value: `${formatDateDDMMAAAA(ticket.fecha_estimada_entrega)} ${formatTimeHHMM(ticket.fecha_estimada_entrega)} hs`,
      isEffective: true
    },
    ...(() => {
      const rawEstudios = Array.isArray(ticket.estudios_raw) ? ticket.estudios_raw : []
      const tieneModificacionesBox = rawEstudios.some(
        (e) => e?.origen === 'box' || e?.estado === 'Cancelado'
      )

      if (!tieneModificacionesBox) {
        return [
          {
            id: 'estudios_gral',
            label: 'Estudios:',
            value: ticket.estudios?.length > 0 ? ticket.estudios.join(', ') : 'Rutina estándar',
            small: true,
            isStudy: true
          }
        ]
      }

      const admision = rawEstudios
        .filter((e) => e?.origen === 'admision')
        .map((e) => e?.estudio_detalle?.nombre || e?.nombre || 'Estudio')

      const cancelados = rawEstudios
        .filter((e) => e?.estado === 'Cancelado')
        .map((e) => {
          const nom = e?.estudio_detalle?.nombre || e?.nombre || 'Estudio'
          const motivo = e?.motivo_modificacion ? ` (${e.motivo_modificacion})` : ''
          return `${nom}${motivo}`
        })

      const agregados = rawEstudios
        .filter((e) => e?.origen === 'box')
        .map((e) => e?.estudio_detalle?.nombre || e?.nombre || 'Estudio')

      return [
        admision.length > 0 && {
          id: 'estudios_admision',
          label: (
            <span>
              Estudios<br />(Admisión):
            </span>
          ),
          value: admision.join(', '),
          small: true,
          isStudy: true
        },
        cancelados.length > 0 && {
          id: 'estudios_cancelados',
          label: (
            <span>
              Cancelados<br />en Box:
            </span>
          ),
          value: cancelados.join(' | '),
          small: true,
          isStudy: true,
          isCancelled: true
        },
        agregados.length > 0 && {
          id: 'estudios_agregados',
          label: (
            <span>
              Agregados<br />en Box:
            </span>
          ),
          value: agregados.join(', '),
          small: true,
          isStudy: true,
          isAdded: true
        },
        {
          id: 'estudios_efectivos',
          label: (
            <span>
              Estudios<br />Efectivos:
            </span>
          ),
          value: ticket.estudios?.length > 0 ? ticket.estudios.join(', ') : 'Ninguno',
          small: true,
          isStudy: true,
          isEffective: true
        }
      ].filter(Boolean)
    })()
  ].filter(Boolean)

  return (
    <div className="ticket-modal__receipt" id="printable-ticket">
      <div className="ticket-modal__receipt-header">
        <h4 className="ticket-modal__hospital-name">HOSPITAL PÚBLICO SGTP</h4>
        <p className="ticket-modal__hospital-sub">Laboratorio Central & Triage</p>
      </div>

      <div className="ticket-modal__call-box">
        <span className="ticket-modal__call-label">N° DE LLAMADO EXTERNO</span>
        <span className="ticket-modal__call-number">{ticket.num_llamado || 'S/N'}</span>
        <span className="ticket-modal__totem-id">Identificador: {ticket.num_totem}</span>
      </div>

      {/* Banner destacado de fecha y hora estimada de retiro */}
      {ticket.fecha_estimada_entrega && (
        <div className="ticket-modal__delivery-banner">
          <span className="ticket-modal__delivery-banner-label">DISPONIBLE PARA RETIRO A PARTIR DE</span>
          <strong className="ticket-modal__delivery-banner-date">
            {formatDateDDMMAAAA(ticket.fecha_estimada_entrega)} • {formatTimeHHMM(ticket.fecha_estimada_entrega)} hs
          </strong>
          <span className="ticket-modal__delivery-banner-sub">
            (Días hábiles de lunes a viernes{ticket.demora_horas_max ? ` • Demora máx.: ${ticket.demora_horas_max} hs` : ''}
            {ticket.estudio_mayor_demora ? ` por ${ticket.estudio_mayor_demora}` : ''})
          </span>
        </div>
      )}

      <div className="ticket-modal__details">
        {detailRows.map((row, index) => (
          <div
            className={`ticket-modal__row ${row.isStudy ? 'ticket-modal__row--study' : ''} ${row.isEffective ? 'ticket-modal__row--effective' : ''}`}
            key={row.id || (typeof row.label === 'string' ? row.label : index)}
          >
            <span className="ticket-modal__row-label">{row.label}</span>
            <span
              className={`ticket-modal__row-value ${row.small ? 'ticket-modal__row-value--small' : ''} ${row.isCancelled ? 'ticket-modal__row-value--cancelled' : ''} ${row.isAdded ? 'ticket-modal__row-value--added' : ''} ${row.isEffective ? 'ticket-modal__row-value--effective' : ''}`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="ticket-modal__receipt-footer">
        <p>
          {isAtendido
            ? 'Conserve este comprobante para retirar sus análisis en ventanilla de Secretaría.'
            : 'Por favor aguarde su turno en la sala de espera frente a la pantalla multibox.'}
        </p>
        <span className="ticket-modal__uuid">UUID: {ticket.id}</span>
      </div>
    </div>
  )
}
