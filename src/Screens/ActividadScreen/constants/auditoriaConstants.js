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
  TICKET_CREADO: 'Ticket de atención generado',
  TICKET_EDITADO: 'Ticket modificado',
  RECETA_ESCANEADA: 'Orden médica escaneada (OCR)',
  OCR_CORREGIDO: 'Corrección manual de datos OCR',
  BOX_TOMADO: 'Toma de puesto de Box',
  PACIENTE_LLAMADO: 'Paciente llamado a Box',
  ESTUDIOS_MODIFICADOS: 'Estudios de laboratorio modificados',
  ATENCION_FINALIZADA: 'Atención médica finalizada',
  ATENCION_CANCELADA: 'Atención cancelada con motivo',
  SLA_MODIFICADO: 'Umbrales SLA actualizados',
  REPORTE_EXPORTADO: 'Reporte operacional exportado',
  REPORTE_ENVIADO: 'Reporte despachado por correo institucional'
}

export function formatHora(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return isoString
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

