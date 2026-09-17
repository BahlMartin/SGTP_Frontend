import { jsPDF } from 'jspdf'
import { formatDateDDMMAAAA } from './formatters'

export function generateDailyReportPdf({
  jornadaDate,
  stats,
  triageDistribution,
  tickets = [],
  generatedBy = 'Personal de SGTP'
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const formattedDate = formatDateDDMMAAAA(jornadaDate || new Date())

  // Cabecera institucional
  doc.setFillColor(3, 36, 51) // Navy hospitalario
  doc.rect(0, 0, 210, 28, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.text('SGTP - SISTEMA DE GESTIÓN DE TRIAGE Y FLUJO DE PACIENTES', 14, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(200, 230, 240)
  doc.text(`Informe Clínico Diario - Jornada: ${formattedDate} | Generado por: ${generatedBy}`, 14, 20)

  // Resumen de Métricas Clave
  let y = 38
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('1. Resumen Operativo de la Jornada', 14, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, y, 182, 24, 3, 3, 'FD')

  doc.text(`Total Atendidos: ${stats.atendidos || 0}`, 20, y + 8)
  doc.text(`Pacientes en Espera / Curso: ${(stats.ingresos || 0) + (stats.enCurso || 0)}`, 20, y + 16)

  doc.text(`Espera Promedio: ${stats.esperaPromedio || '—'}`, 80, y + 8)
  doc.text(`Atención Promedio: ${stats.atencionPromedio || '—'}`, 80, y + 16)

  doc.text(`Casos Críticos (Guardia + Médicos): ${stats.criticos || 0}`, 135, y + 8)

  // Distribución por Triage
  y += 34
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('2. Distribución de Pacientes por Clasificación de Triage', 14, y)

  y += 8
  const categories = [
    { label: '1. Guardia (Máxima urgencia)', count: triageDistribution.guardia || 0 },
    { label: '2. Médicos (Urgente)', count: triageDistribution.medicos || 0 },
    { label: '3. Discapacidad (Prioritario)', count: triageDistribution.discapacidad || 0 },
    { label: '4. Oncología (Programado)', count: triageDistribution.oncologia || 0 },
    { label: '5. Extracción con turno (Demanda Espontánea)', count: triageDistribution.extraccion_con_turno || 0 },
    { label: '6. Extracción sin turno (Demanda Espontánea)', count: triageDistribution.extraccion_sin_turno || 0 },
    { label: '7. Otro (Requiere Justificación)', count: triageDistribution.otro || 0 }
  ]

  categories.forEach((cat) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(cat.label, 18, y)
    doc.setFont('helvetica', 'bold')
    doc.text(`${cat.count} paciente(s)`, 160, y)
    y += 6
  })

  // Detalle de Trazabilidad y Auditoría (Últimos Tickets)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('3. Registro de Auditoría y Trazabilidad (Muestra de Tickets)', 14, y)

  y += 8
  // Encabezados de tabla
  doc.setFillColor(241, 245, 249)
  doc.rect(14, y, 182, 8, 'F')
  doc.setFontSize(8.5)
  doc.setTextColor(51, 65, 85)
  doc.text('TÓTEM / ID', 16, y + 5.5)
  doc.text('PACIENTE', 42, y + 5.5)
  doc.text('TRIAGE', 90, y + 5.5)
  doc.text('ESTADO', 125, y + 5.5)
  doc.text('ADMISION', 150, y + 5.5)
  doc.text('BOX', 178, y + 5.5)

  y += 9
  const tableRows = tickets.slice(0, 15)
  if (tableRows.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text('No hay registros de tickets para la jornada seleccionada.', 16, y + 4)
  } else {
    tableRows.forEach((t) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(String(t.num_totem || t.id || '—'), 16, y + 4)
      doc.text(String(t.paciente_nombre || '—').substring(0, 24), 42, y + 4)
      doc.text(String(t.clasificacion_triage || '—').substring(0, 16), 90, y + 4)
      doc.text(String(t.estado || '—'), 125, y + 4)
      doc.text(String(t.mat_admision || 'TEC-ADM'), 150, y + 4)
      doc.text(String(t.box_asignado || '—'), 178, y + 4)
      y += 6
      if (y > 275) {
        doc.addPage()
        y = 20
      }
    })
  }

  // Pie de página
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Documento generado electrónicamente bajo políticas de auditoría inmutable SGTP. UTC: ${new Date().toISOString()}`, 14, 290)

  // Descarga del PDF
  const filename = `Reporte_Diario_SGTP_${formattedDate.replace(/\//g, '-')}.pdf`
  doc.save(filename)
  return filename
}
