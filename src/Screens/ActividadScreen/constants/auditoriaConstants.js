import React from 'react'
import {
  KeyRound,
  ClipboardPlus,
  TestTube,
  Settings2,
  FileSpreadsheet,
  Gauge,
  CircleCheck,
  CircleX,
  Ban
} from 'lucide-react'

/**
 * Ícono SVG distintivo de IA Gemini (estrella principal de 4 puntas + destello secundario).
 * Se construye con React.createElement porque este archivo tiene extensión .js.
 */
export function GeminiLogoIcon({ size = 14, className = '' }) {
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      className,
      'aria-hidden': 'true'
    },
    React.createElement('path', {
      d: 'M10.5 4.5C10.5 9.19442 14.3056 13 19 13C14.3056 13 10.5 16.8056 10.5 21.5C10.5 16.8056 6.69442 13 2 13C6.69442 13 10.5 9.19442 10.5 4.5Z',
      fill: 'currentColor'
    }),
    React.createElement('path', {
      d: 'M19 1.75C19 3.54493 20.4551 5 22.25 5C20.4551 5 19 6.45507 19 8.25C19 6.45507 17.5449 5 15.75 5C17.5449 5 19 3.54493 19 1.75Z',
      fill: 'currentColor',
      opacity: '0.88'
    })
  )
}

export const GEMINI_AI_CONFIG = {
  label: 'IA Gemini',
  Icon: GeminiLogoIcon,
  color: '#6d28d9',
  bg: '#ede9fe',
  border: '#c4b5fd'
}

export const CATEGORIAS_CONFIG = {
  acceso: {
    label: 'Acceso',
    Icon: KeyRound,
    color: '#4338ca',
    bg: '#eef0fd'
  },
  admision: {
    label: 'Admisión',
    Icon: ClipboardPlus,
    color: '#0f766e',
    bg: '#e6f4f2'
  },
  box: {
    label: 'Box',
    Icon: TestTube,
    color: '#be185d',
    bg: '#fbe8f1'
  },
  gestion: {
    label: 'Gestión',
    Icon: Settings2,
    color: '#92400e',
    bg: '#f6ece3'
  },
  reportes: {
    label: 'Reportes',
    Icon: FileSpreadsheet,
    color: '#334155',
    bg: '#e8ecf1'
  },
  sla: {
    label: 'SLA',
    Icon: Gauge,
    color: '#0284c7',
    bg: '#e0f2fe'
  }
}

export const RESULTADOS_CONFIG = {
  EXITO: {
    label: 'Éxito',
    Icon: CircleCheck,
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0'
  },
  FALLO: {
    label: 'Fallo',
    Icon: CircleX,
    color: '#b91c1c',
    bg: '#fef2f2',
    border: '#fecaca'
  },
  DENEGADO: {
    label: 'Denegado',
    Icon: Ban,
    color: '#92400e',
    bg: '#fdf3e7',
    border: '#e8c9a4'
  }
}

export const ROLES_CONFIG = {
  Admision: { label: 'Admisión', color: '#0f766e', bg: '#e6f4f2' },
  Box: { label: 'Box / Técnico', color: '#be185d', bg: '#fbe8f1' },
  Secretaria: { label: 'Secretaría', color: '#334155', bg: '#e8ecf1' },
  Jefa: { label: 'Jefatura', color: '#1687c9', bg: '#e0f2fe' },
  Admin: { label: 'Administrador', color: '#6366f1', bg: '#eef2ff' }
}

export const ACCIONES_CATALOGO = {
  LOGIN_EXITOSO: 'Inicio de sesión exitoso',
  LOGIN_FALLIDO: 'Intento de inicio de sesión fallido',
  CUENTA_BLOQUEADA_AUTO: 'Cuenta bloqueada automáticamente',
  LOGOUT: 'Cierre de sesión',
  USUARIO_CREADO: 'Nuevo empleado creado',
  USUARIO_EDITADO: 'Datos de empleado modificados',
  USUARIO_BLOQUEADO: 'Empleado bloqueado manualmente',
  USUARIO_DESBLOQUEADO: 'Empleado desbloqueado',
  DESBLOQUEO_EMERGENCIA: 'Desbloqueo de emergencia ejecutado',
  USUARIO_REACTIVADO: 'Empleado reactivado en el sistema',
  HABILITACION_HORARIA_CREADA: 'Habilitación horaria extraordinaria concedida',
  HABILITACION_HORARIA_REVOCADA: 'Habilitación horaria revocada',
  HORAS_EXTRAS_PLANIFICADAS: 'Horas extras planificadas',
  ACCESO_FUERA_DE_TURNO: 'Intento de acceso fuera del turno asignado',
  PACIENTE_CREADO: 'Nuevo paciente empadronado',
  PACIENTE_EDITADO: 'Datos del paciente modificados',
  HISTORIAL_PACIENTE_CONSULTADO: 'Historial del paciente consultado',
  TICKET_CREADO: 'Paciente finalizado (Ticket emitido)',
  TICKET_EDITADO: 'Ticket modificado',
  RECETA_ESCANEADA: 'Orden médica escaneada (OCR)',
  OCR_CORREGIDO: 'Corrección manual de datos OCR',
  BOX_TOMADO: 'Toma de puesto de Box',
  PACIENTE_LLAMADO: 'Paciente llamado a Box',
  ESTUDIOS_MODIFICADOS: 'Estudios de laboratorio modificados',
  ATENCION_FINALIZADA: 'Atención finalizada en Box',
  ATENCION_CANCELADA: 'Atención cancelada con motivo',
  SLA_MODIFICADO: 'Umbrales SLA actualizados',
  REPORTE_EXPORTADO: 'Reporte operacional exportado',
  REPORTE_ENVIADO: 'Reporte despachado por correo institucional'
}

function resolveEventMetadata(ev) {
  if (ev?.metadata && typeof ev.metadata === 'object' && Object.keys(ev.metadata).length > 0) {
    return ev.metadata
  }
  if (ev?.evento?.metadata && typeof ev.evento.metadata === 'object') {
    return ev.evento.metadata
  }
  return ev?.metadata || {}
}

export function isGeminiAiEvent(ev) {
  if (!ev) return false
  const meta = resolveEventMetadata(ev)
  const desc = String(
    ev?.descripcion || ev?.what || ev?.titulo || ev?.evento?.descripcion || ''
  )
  return (
    meta?.motor_ia === 'gemini' ||
    meta?.modo === 'recortes_bajo_demanda_ia' ||
    /gemini|bajo_demanda_ia|recortes seleccionados/i.test(desc)
  )
}

export function extractPatientTraceMeta(ev) {
  const meta = resolveEventMetadata(ev)
  const rawTurno = meta.turno ?? meta.ticket ?? ''
  const rawDni = meta.dni ?? ''
  const rawAfiliado = meta.numero_afiliado ?? ''
  const rawBox = meta.box ?? ''
  return {
    turno: rawTurno !== null && rawTurno !== undefined ? String(rawTurno).trim() : '',
    dni: rawDni !== null && rawDni !== undefined ? String(rawDni).trim() : '',
    numeroAfiliado: rawAfiliado !== null && rawAfiliado !== undefined ? String(rawAfiliado).trim() : '',
    box: rawBox !== null && rawBox !== undefined ? String(rawBox).trim() : ''
  }
}

export function getAccionDisplayLabel(ev) {
  if (!ev) return ''
  const target = ev.evento || ev
  const accion = target.accion || ev.accion || ''
  const categoria = String(target.categoria || ev.categoria || '').toLowerCase()
  const meta = resolveEventMetadata(ev)
  const sector = String(meta.sector || '').toLowerCase()

  if (isGeminiAiEvent(ev)) {
    return 'Escaneo IA (Gemini)'
  }

  if (accion === 'PACIENTE_LLAMADO') {
    if (categoria === 'admision' || sector === 'admision') {
      return 'Paciente llamado en Admisión'
    }
    return 'Paciente llamado a Box'
  }

  if (accion === 'ATENCION_CANCELADA') {
    if (categoria === 'admision' || sector === 'admision') {
      return 'Turno cancelado en Admisión'
    }
    return ACCIONES_CATALOGO.ATENCION_CANCELADA
  }

  return ACCIONES_CATALOGO[accion] || accion
}

export function formatHora(val, includeSeconds = false) {
  if (!val) return '—'
  if (typeof val === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(val.trim())) {
    const parts = val.trim()
    return includeSeconds && parts.length === 8 ? parts : parts.slice(0, 5)
  }
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return String(val)
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: false
    })
  } catch {
    return String(val)
  }
}

export function formatFechaHora(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return isoString
  }
}

