import { jsPDF } from 'jspdf'
import { formatDateDDMMAAAA, formatTimeHHMM } from './formatters'

export function generateDailyReportPdf({
  jornadaDate,
  stats = {},
  triageDistribution = {},
  tickets = [],
  franjasHorarias = [],
  resumenSecciones = [],
  insumosTubos = [],
  rendimientoAdmision = [],
  rendimientoBox = [],
  generatedBy = 'Personal de SGTP'
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const formattedDate = formatDateDDMMAAAA(jornadaDate || new Date())

  // ==============================================================================
  // PÁGINA 1: CABECERA Y RESUMEN OPERATIVO / FRANJAS HORARIAS
  // ==============================================================================
  doc.setFillColor(15, 47, 74) // Navy hospitalario
  doc.rect(0, 0, 210, 26, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text('SGTP - SISTEMA DE GESTIÓN DE TRIAGE Y FLUJO DE PACIENTES', 14, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 230, 240)
  doc.text(`Informe Asistencial Diario Consolidado — Jornada: ${formattedDate} | Generado por: ${generatedBy}`, 14, 19)

  // 1. Resumen Ejecutivo
  let y = 34
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('1. Resumen Ejecutivo y Métricas de Flujo', 14, y)

  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, y, 182, 26, 2, 2, 'FD')

  doc.text(`Total Emitidos: ${stats.ingresos || 0}`, 18, y + 7)
  doc.text(`Total Atendidos: ${stats.atendidos || 0}`, 18, y + 14)
  doc.text(`En Curso / Espera: ${stats.enCurso || 0}`, 18, y + 21)

  doc.text(`Espera Promedio: ${stats.esperaPromedio || '—'}`, 75, y + 7)
  doc.text(`Atención Promedio: ${stats.atencionPromedio || '—'}`, 75, y + 14)
  doc.text(`Casos Críticos: ${stats.criticos || 0}`, 75, y + 21)

  doc.text(`Cancelados (Drop-off): ${stats.cancelados || 0}`, 135, y + 7)
  doc.text(`Total Estudios: ${stats.totalEstudios || 0}`, 135, y + 14)
  doc.text(`Secciones Activas: ${resumenSecciones.length || 0}`, 135, y + 21)

  // 2. Franjas Horarias (Turnos)
  y += 34
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('2. Distribución Asistencial por Franjas Horarias (Turnos)', 14, y)

  y += 6
  doc.setFillColor(241, 245, 249)
  doc.rect(14, y, 182, 7, 'F')
  doc.setFontSize(8)
  doc.setTextColor(51, 65, 85)
  doc.text('TURNO / FRANJA', 16, y + 4.8)
  doc.text('HORARIO', 68, y + 4.8)
  doc.text('EMITIDOS', 108, y + 4.8)
  doc.text('ATENDIDOS', 133, y + 4.8)
  doc.text('ESPERA PROM.', 160, y + 4.8)

  y += 8
  if (franjasHorarias.length === 0) {
    const defaultShifts = [
      { nombre: 'Noche / Guardia Madrugada', rango_display: '00:00:00 - 07:59:59' },
      { nombre: 'Mañana / Turno Central', rango_display: '08:00:00 - 15:59:59' },
      { nombre: 'Tarde / Guardia Vespertina', rango_display: '16:00:00 - 23:59:59' }
    ]
    defaultShifts.forEach((s) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(s.nombre, 16, y + 4)
      doc.text(s.rango_display, 68, y + 4)
      doc.text('—', 114, y + 4)
      doc.text('—', 139, y + 4)
      doc.text('—', 165, y + 4)
      y += 6
    })
  } else {
    franjasHorarias.forEach((f) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(String(f.nombre || '—'), 16, y + 4)
      doc.text(String(f.rango_display || '—'), 68, y + 4)
      doc.text(String(f.total_emitidos ?? '0'), 114, y + 4)
      doc.text(String(f.total_atendidos ?? '0'), 139, y + 4)
      doc.text(`${f.promedio_espera_minutos ?? '0'} min`, 165, y + 4)
      y += 6
    })
  }

  // 3. Distribución por Triage
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('3. Distribución de Pacientes por Clasificación de Triage', 14, y)

  y += 6
  const categories = [
    { label: '1. Guardia (Máxima urgencia)', count: triageDistribution.guardia || 0 },
    { label: '2. Médicos (Urgente)', count: triageDistribution.medicos || 0 },
    { label: '3. Discapacidad (Prioritario)', count: triageDistribution.discapacidad || 0 },
    { label: '4. Oncología (Programado)', count: triageDistribution.oncologia || 0 },
    { label: '5. Extracción con turno', count: triageDistribution.extraccion_con_turno || 0 },
    { label: '6. Extracción sin turno', count: triageDistribution.extraccion_sin_turno || 0 },
    { label: '7. Otro', count: triageDistribution.otro || 0 }
  ]

  categories.forEach((cat) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(51, 65, 85)
    doc.text(cat.label, 18, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(`${cat.count} paciente(s)`, 160, y)
    y += 5.5
  })

  // ==============================================================================
  // PÁGINA 2: SECCIONES BIOQUÍMICAS, TUBOS Y RENDIMIENTO PERSONAL
  // ==============================================================================
  doc.addPage()
  let y2 = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 47, 74)
  doc.text('4. Laboratorio: Resumen Consolidado por Sección', 14, y2)

  y2 += 6
  doc.setFillColor(241, 245, 249)
  doc.rect(14, y2, 182, 7, 'F')
  doc.setFontSize(8)
  doc.setTextColor(51, 65, 85)
  doc.text('SECCIÓN BIOQUÍMICA', 16, y2 + 4.8)
  doc.text('TOTAL ESTUDIOS', 115, y2 + 4.8)
  doc.text('PROPORCIÓN (%)', 155, y2 + 4.8)

  y2 += 8
  if (resumenSecciones.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(148, 163, 184)
    doc.text('No se registraron estudios para la jornada seleccionada.', 16, y2 + 4)
    y2 += 8
  } else {
    resumenSecciones.forEach((s) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(String(s.nombre_seccion || s.seccion_nombre || 'Sección'), 16, y2 + 4)
      doc.text(String(s.total_estudios ?? s.total ?? 0), 125, y2 + 4)
      doc.text(`${s.porcentaje ?? 0}%`, 165, y2 + 4)
      y2 += 6
    })
  }

  // 5. Insumos y Tubos Requeridos
  y2 += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 47, 74)
  doc.text('5. Logística de Muestras e Insumos Requeridos (Tubos)', 14, y2)

  y2 += 6
  doc.setFillColor(241, 245, 249)
  doc.rect(14, y2, 182, 7, 'F')
  doc.setFontSize(8)
  doc.setTextColor(51, 65, 85)
  doc.text('TIPO DE MUESTRA / TUBO', 16, y2 + 4.8)
  doc.text('CANTIDAD TUBOS', 115, y2 + 4.8)
  doc.text('PROPORCIÓN (%)', 155, y2 + 4.8)

  y2 += 8
  if (insumosTubos.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(148, 163, 184)
    doc.text('Sin registros de tubos o insumos.', 16, y2 + 4)
    y2 += 8
  } else {
    insumosTubos.forEach((ins) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(String(ins.descripcion_tubo || ins.tipo_muestra || 'Muestra'), 16, y2 + 4)
      doc.text(String(ins.total_tubos ?? 0), 125, y2 + 4)
      doc.text(`${ins.porcentaje ?? 0}%`, 165, y2 + 4)
      y2 += 6
    })
  }

  // 6. Rendimiento de Personal (Admisión vs Box)
  y2 += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 47, 74)
  doc.text('6. Rendimiento de Personal Asistencial (Admisión y Box)', 14, y2)

  y2 += 6
  // Subtabla Admisión
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(13, 148, 136)
  doc.text('A. Operadores de Admisión (Mayor a Menor)', 16, y2)
  y2 += 4

  const topAdm = rendimientoAdmision.slice(0, 5)
  if (topAdm.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('Sin registros de admisión.', 16, y2 + 4)
    y2 += 6
  } else {
    topAdm.forEach((a) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(`• ${a.nombre_completo || a.email || 'Operador'}`, 18, y2 + 4)
      doc.setFont('helvetica', 'bold')
      doc.text(`${a.pacientes_recepcionados ?? 0} pacientes`, 155, y2 + 4)
      y2 += 5.5
    })
  }

  // Subtabla Box
  y2 += 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(13, 148, 136)
  doc.text('B. Técnicos de Box (Mayor a Menor + Tiempo Promedio)', 16, y2)
  y2 += 4

  const topBox = rendimientoBox.slice(0, 5)
  if (topBox.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('Sin registros de atención en box.', 16, y2 + 4)
    y2 += 6
  } else {
    topBox.forEach((b) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(`• ${b.nombre_completo || b.email || 'Técnico'}`, 18, y2 + 4)
      doc.setFont('helvetica', 'bold')
      doc.text(`${b.pacientes_atendidos ?? 0} atenciones (${b.promedio_atencion_minutos ?? 0} min prom)`, 120, y2 + 4)
      y2 += 5.5
    })
  }

  // Pie de página de ambas hojas
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, 285, 196, 285)
    const generatedAt = new Date()
    doc.text(`SGTP Hospitalario | Generado el ${formatDateDDMMAAAA(generatedAt)} ${formatTimeHHMM(generatedAt)}`, 14, 290)
    doc.text(`Página ${i} de ${pageCount}`, 175, 290)
  }

  // Descarga del PDF
  const filename = `Reporte_Diario_SGTP_${formattedDate.replace(/\//g, '-')}.pdf`
  doc.save(filename)
  return filename
}
