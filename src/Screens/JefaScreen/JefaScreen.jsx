import React, { useState, useEffect } from 'react'
import {
  Download,
  Mail,
  UserPlus,
  CheckCircle,
  Edit2,
  X,
  Plus
} from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import TriageBadge from '../../components/TriageBadge/TriageBadge'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { formatTimeHHMM } from '../../utils/formatters'
import { generateDailyReportPdf } from '../../utils/pdfGenerator'
import { computeDailyReportMetrics, sendDailyReportEmailApi } from '../../services/reportService'
import { fetchAllStaffApi, createStaffUserApi, toggleShiftExceptionApi } from '../../services/userService'
import './JefaScreen.css'

export default function JefaScreen() {
  const { tickets, updateTicketAsJefa } = useTriageQueue()
  const { userData } = useAuth()

  const [jornadaDate, setJornadaDate] = useState('2026-09-19')
  const [staffList, setStaffList] = useState([])
  const [statusMessage, setStatusMessage] = useState(null)

  // Modales
  const [editingTicket, setEditingTicket] = useState(null)
  const [editTriage, setEditTriage] = useState('')
  const [editJustification, setEditJustification] = useState('')

  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffMatricula, setNewStaffMatricula] = useState('')
  const [newStaffRol, setNewStaffRol] = useState('Box')
  const [newStaffTurno, setNewStaffTurno] = useState('Mañana (07:00 - 15:00)')
  const [staffError, setStaffError] = useState(null)

  const loadStaff = async () => {
    try {
      const data = await fetchAllStaffApi()
      setStaffList(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadStaff()
  }, [])

  // Métricas calculadas para la jornada
  const metrics = computeDailyReportMetrics(tickets, new Date(jornadaDate))

  // Matriz de Estudios de Laboratorio
  const labCategories = ['Hemograma', 'Bioquimica', 'Orina', 'Cultivo', 'Otro']
  const labMatrix = labCategories.map((cat) => {
    let total = 0
    let pend = 0
    let curso = 0
    let listos = 0

    tickets.forEach((t) => {
      const hasCat = t.estudios?.some((e) => e.toLowerCase().includes(cat.toLowerCase()))
      if (hasCat) {
        total++
        if (t.estado === 'Espera') pend++
        else if (t.estado === 'En atencion') curso++
        else if (t.estado === 'Atendido') listos++
      }
    })

    return { nombre: cat, total, pend, curso, listos }
  })

  const handleExportPdf = () => {
    generateDailyReportPdf({
      jornadaDate: new Date(jornadaDate),
      stats: {
        atendidos: metrics.atendidos,
        ingresos: metrics.ingresos,
        enCurso: metrics.enCurso,
        esperaPromedio: metrics.esperaPromedio,
        atencionPromedio: metrics.atencionPromedio,
        criticos: metrics.criticos
      },
      triageDistribution: metrics.triageDistribution,
      tickets: metrics.tickets,
      generatedBy: `${userData?.nombre} (${userData?.rol})`
    })
    showNotice('Reporte diario exportado a PDF correctamente.')
  }

  const handleSendEmail = async () => {
    try {
      const res = await sendDailyReportEmailApi(jornadaDate, userData?.email)
      showNotice(res.message)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleShift = async (staffId, currentStatus) => {
    try {
      const nextStatus = currentStatus !== 'En turno'
      await toggleShiftExceptionApi(staffId, nextStatus)
      await loadStaff()
      showNotice(`Habilitación de turno actualizada para el personal.`)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleOpenEditTicket = (t) => {
    setEditingTicket(t)
    setEditTriage(t.clasificacion_triage)
    setEditJustification(t.justificacion_otro || '')
  }

  const handleSaveTicketEdit = async () => {
    if (!editingTicket) return
    try {
      await updateTicketAsJefa(
        editingTicket.id,
        {
          clasificacion_triage: editTriage,
          justificacion_otro: editJustification
        },
        userData?.rol
      )
      setEditingTicket(null)
      showNotice('Ticket asistencial actualizado bajo auditoría inmutable de 24hs.')
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCreateStaff = async (e) => {
    e.preventDefault()
    setStaffError(null)

    // Restricción de jerarquía: Jefa no puede crear Admin ni Jefa
    if (userData?.rol === 'Jefa' && (newStaffRol === 'Admin' || newStaffRol === 'Jefa')) {
      setStaffError('Restricción RBAC: La Jefa solo puede dar de alta personal de Admisión o Box.')
      return
    }

    try {
      await createStaffUserApi(userData?.rol, {
        nombre: newStaffName,
        email: newStaffEmail,
        matricula: newStaffMatricula,
        rol: newStaffRol,
        turno: newStaffTurno
      })
      setShowAddStaffModal(false)
      setNewStaffName('')
      setNewStaffEmail('')
      setNewStaffMatricula('')
      loadStaff()
      showNotice('Personal incorporado exitosamente.')
    } catch (err) {
      setStaffError(err.message)
    }
  }

  const showNotice = (msg) => {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(null), 4000)
  }

  return (
    <div className="jefa-screen-layout">
      <Navbar />

      <main className="jefa-main-content">
        <div className="jefa-header-text">
          <h1 className="page-title">Supervisión</h1>
          <p className="page-subtitle">Metricas en tiempo real, auditoria y reportes diarios</p>
        </div>

        {statusMessage && (
          <div className="jefa-status-alert">
            <CheckCircle size={18} />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="jefa-grid-container">
          {/* Columna Izquierda: Estudios Laboratorios y Personal Activo */}
          <div className="jefa-left-column">
            {/* Tarjeta Estudios Laboratorios (Imagen 2) */}
            <div className="studies-matrix-card">
              <h3 className="section-title-sm">Estudios laboratorios</h3>
              <div className="matrix-table">
                {labMatrix.map((item) => (
                  <div key={item.nombre} className="matrix-row">
                    <div className="matrix-cat-info">
                      <span className="cat-name">{item.nombre}</span>
                      <span className="cat-total">{item.total} Total</span>
                    </div>
                    <div className="matrix-tags">
                      <div className="m-tag tag-pend">
                        <span className="tag-val">{item.pend}</span>
                        <span className="tag-lbl">Pend.</span>
                      </div>
                      <div className="m-tag tag-curso">
                        <span className="tag-val">{item.curso}</span>
                        <span className="tag-lbl">Curso</span>
                      </div>
                      <div className="m-tag tag-listos">
                        <span className="tag-val">{item.listos}</span>
                        <span className="tag-lbl">Listos</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personal Activo y Carga (Imagen 2) */}
            <div className="active-staff-card">
              <div className="staff-header-wrap">
                <span className="section-title-sm">Personal activo y carga</span>
                <span className="staff-count-label">
                  {staffList.filter((s) => s.estado === 'En turno').length} en turno
                </span>
              </div>

              <ul className="staff-active-list">
                {staffList.slice(0, 4).map((staff) => (
                  <li key={staff.id} className="staff-active-item">
                    <div className="staff-dot-name">
                      <span
                        className={`staff-status-dot ${
                          staff.estado === 'En turno' ? 'dot-active' : 'dot-offline'
                        }`}
                      />
                      <div className="staff-titles">
                        <span className="staff-fullname">{staff.nombre}</span>
                        <span className="staff-subarea">
                          {staff.area} - {staff.estado}
                        </span>
                      </div>
                    </div>
                    <div className="staff-load-stat">
                      <span className="load-number">{staff.pacientesAtendidos}</span>
                      <span className="load-lbl">atendidos</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Área Central: Auditoría y Trazabilidad + Personal y Asignación de Turnos */}
          <div className="jefa-center-column">
            {/* Auditoría y trazabilidad (Imagen 2) */}
            <div className="audit-trace-card">
              <div className="audit-card-header">
                <h3>Auditoria y trazabilidad</h3>
                <div className="audit-header-controls">
                  <div className="date-picker-box">
                    <input
                      type="date"
                      value={jornadaDate}
                      onChange={(e) => setJornadaDate(e.target.value)}
                      className="jornada-input"
                    />
                  </div>
                  <button className="btn-export-pdf" onClick={handleExportPdf}>
                    <Download size={15} />
                    exportar PDF
                  </button>
                  <button className="btn-send-email" onClick={handleSendEmail}>
                    <Mail size={15} />
                    enviar por mail
                  </button>
                </div>
              </div>

              <div className="audit-table-wrapper">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Paciente</th>
                      <th>Triage</th>
                      <th>Estado</th>
                      <th>Mat.Admisión</th>
                      <th>Mat.Box</th>
                      <th>Emisión</th>
                      <th>Llamado</th>
                      <th>Cierre</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice(0, 8).map((t) => (
                      <tr key={t.id}>
                        <td className="t-id">{t.num_totem || t.id}</td>
                        <td className="t-patient">
                          {t.paciente_nombre} {t.paciente_apellido}
                        </td>
                        <td>
                          <TriageBadge categoryKey={t.clasificacion_triage} showPriority={false} />
                        </td>
                        <td>
                          <span
                            className={`state-pill ${
                              t.estado === 'Atendido'
                                ? 'pill-done'
                                : t.estado === 'En atencion'
                                ? 'pill-progress'
                                : 'pill-wait'
                            }`}
                          >
                            {t.estado}
                          </span>
                        </td>
                        <td className="t-mat">{t.mat_admision || '—'}</td>
                        <td className="t-mat">{t.mat_box || '—'}</td>
                        <td className="t-time">{formatTimeHHMM(t.fecha_hora_admision)}</td>
                        <td className="t-time">{formatTimeHHMM(t.fecha_hora_llamado)}</td>
                        <td className="t-time">{formatTimeHHMM(t.fecha_hora_cierre)}</td>
                        <td>
                          <button
                            className="btn-edit-ticket-jefa"
                            title="Editar clasificación dentro de las 24hs"
                            onClick={() => handleOpenEditTicket(t)}
                          >
                            <Edit2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Personal y Asignación de Turnos (Imagen 2) */}
            <div className="staff-shifts-card">
              <div className="shifts-card-header">
                <div className="shifts-title-wrap">
                  <UserPlus size={18} className="user-plus-icon" />
                  <h3>Personal y asignacion de turnos</h3>
                </div>
                <button
                  className="btn-add-staff-trigger"
                  onClick={() => setShowAddStaffModal(true)}
                >
                  <Plus size={15} />
                  Nuevo Personal
                </button>
              </div>

              <div className="shifts-table-wrapper">
                <table className="shifts-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Matricula</th>
                      <th>Rol</th>
                      <th>Turno</th>
                      <th>Estado</th>
                      <th>Habilitación Horaria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((s) => (
                      <tr key={s.id}>
                        <td className="s-name">{s.nombre}</td>
                        <td className="s-mat">{s.matricula}</td>
                        <td>
                          <span className="s-role-badge">{s.rol}</span>
                        </td>
                        <td className="s-turno">{s.turno}</td>
                        <td>
                          <span
                            className={`status-chip ${
                              s.estado === 'En turno' ? 'chip-green' : 'chip-grey'
                            }`}
                          >
                            {s.estado}
                          </span>
                        </td>
                        <td>
                          {s.rol !== 'Admin' && s.rol !== 'Jefa' ? (
                            <button
                              className={`btn-toggle-shift ${
                                s.estado === 'En turno' ? 'btn-disable' : 'btn-enable'
                              }`}
                              onClick={() => handleToggleShift(s.id, s.estado)}
                            >
                              {s.estado === 'En turno' ? 'Restringir' : 'Habilitar'}
                            </button>
                          ) : (
                            <span className="permanent-badge">Acceso 24hs</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Búsqueda de Paciente */}
          <div className="jefa-right-column">
            <PatientSearch
              onSelectPatient={(p) =>
                showNotice(`Paciente encontrado: ${p.nombre} ${p.apellido} (DNI ${p.dni})`)
              }
            />
          </div>
        </div>
      </main>

      {/* Modal de Modificación de Ticket por Jefa (Ventana de 24h) */}
      {editingTicket && (
        <div className="jefa-modal-overlay">
          <div className="jefa-modal-card">
            <button className="btn-close-modal" onClick={() => setEditingTicket(null)}>
              <X size={18} />
            </button>
            <h3>Modificar Ticket Asistencial (Jefa)</h3>
            <p className="jefa-modal-desc">
              Ticket: <strong>{editingTicket.num_totem}</strong> — Paciente:{' '}
              <strong>{editingTicket.paciente_nombre} {editingTicket.paciente_apellido}</strong>
            </p>

            <div className="modal-field">
              <label>Reclasificar Triage:</label>
              <select
                className="modal-select"
                value={editTriage}
                onChange={(e) => setEditTriage(e.target.value)}
              >
                <option value="Guardia">1. Guardia (Máxima urgencia)</option>
                <option value="Medicos">2. Médicos (Urgente)</option>
                <option value="Discapacidad">3. Discapacidad (Prioritario)</option>
                <option value="Oncologia">4. Oncología (Programado)</option>
                <option value="Extraccion con turno">5. Extracción con turno</option>
                <option value="Extraccion sin turno">6. Extracción sin turno</option>
                <option value="Otro">7. Otro (Requiere Justificación)</option>
              </select>
            </div>

            {editTriage === 'Otro' && (
              <div className="modal-field">
                <label>Justificación técnica:</label>
                <textarea
                  className="modal-textarea"
                  rows={3}
                  value={editJustification}
                  onChange={(e) => setEditJustification(e.target.value)}
                  placeholder="Justifique el motivo de reclasificación..."
                />
              </div>
            )}

            <div className="modal-actions-row">
              <button className="btn-save-edit" onClick={handleSaveTicketEdit}>
                Confirmar Modificación
              </button>
              <button className="btn-cancel-edit" onClick={() => setEditingTicket(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alta de Personal por Jefa / Admin */}
      {showAddStaffModal && (
        <div className="jefa-modal-overlay">
          <div className="jefa-modal-card">
            <button className="btn-close-modal" onClick={() => setShowAddStaffModal(false)}>
              <X size={18} />
            </button>
            <h3>Alta de Personal Asistencial</h3>
            <p className="jefa-modal-desc">
              Gestión de personal de Admisión y Box de Atención.
            </p>

            {staffError && (
              <div className="modal-error-alert">
                <AlertCircle size={16} />
                <span>{staffError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="add-staff-form">
              <div className="modal-field">
                <label>Nombre y Apellido:</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Lic. Roberto Gomez"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Correo Institucional:</label>
                <input
                  type="email"
                  required
                  placeholder="rgomez@sgtp.hospital.gob.ar"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Matrícula Profesional:</label>
                <input
                  type="text"
                  required
                  placeholder="ej: TEC-8821"
                  value={newStaffMatricula}
                  onChange={(e) => setNewStaffMatricula(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Rol Asignado:</label>
                <select value={newStaffRol} onChange={(e) => setNewStaffRol(e.target.value)}>
                  <option value="Box">Técnico / Box</option>
                  <option value="Admision">Admisión</option>
                  {userData?.rol === 'Admin' && (
                    <>
                      <option value="Secretaria">Secretaría</option>
                      <option value="Jefa">Jefa de Turno</option>
                    </>
                  )}
                </select>
              </div>

              <div className="modal-field">
                <label>Turno Laboral:</label>
                <input
                  type="text"
                  value={newStaffTurno}
                  onChange={(e) => setNewStaffTurno(e.target.value)}
                />
              </div>

              <div className="modal-actions-row">
                <button type="submit" className="btn-save-edit">
                  Crear Usuario
                </button>
                <button
                  type="button"
                  className="btn-cancel-edit"
                  onClick={() => setShowAddStaffModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
