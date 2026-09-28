import React, { useState, useEffect } from 'react'
import {
  Download,
  Mail,
  UserPlus,
  CheckCircle,
  Edit2,
  X,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react'
import Navbar from '../../components/Navbar/Navbar'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import TriageBadge from '../../components/TriageBadge/TriageBadge'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { formatTimeHHMM } from '../../utils/formatters'
import { generateDailyReportPdf } from '../../utils/pdfGenerator'
import { computeDailyReportMetrics, sendDailyReportEmailApi } from '../../services/reportService'
import {
  fetchAllStaffApi,
  createStaffUserApi,
  toggleShiftExceptionApi,
  deleteStaffUserApi
} from '../../services/userService'
import './JefaScreen.css'

const getTodayDateString = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const localDate = new Date(now.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 10)
}

export default function JefaScreen() {
  const { tickets, updateTicketAsJefa } = useTriageQueue()
  const { userData } = useAuth()

  const [jornadaDate, setJornadaDate] = useState(() => getTodayDateString())
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

  const handleDeleteStaff = async (staffId, staffName, staffRole) => {
    const canDelete = userData?.rol === 'Admin' || (userData?.rol === 'Jefa' && staffRole !== 'Admin' && staffRole !== 'Jefa')

    if (!canDelete) {
      alert('No tienes permisos para eliminar este perfil de personal.')
      return
    }

    const confirmed = window.confirm(`¿Deseas borrar al personal ${staffName}? Esta acción no se puede deshacer.`)
    if (!confirmed) return

    try {
      await deleteStaffUserApi(userData?.rol, staffId)
      await loadStaff()
      showNotice('Miembro del personal eliminado correctamente.')
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
    <div className="jefa-screen">
      <Navbar />

      <main className="jefa-screen__main">
        <div className="jefa-screen__header">
          <h1 className="jefa-screen__title">Supervisión</h1>
          <p className="jefa-screen__subtitle">Metricas en tiempo real, auditoria y reportes diarios</p>
        </div>

        {statusMessage && (
          <div className="jefa-screen__alert">
            <CheckCircle size={18} />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="jefa-screen__grid">
          {/* Columna Izquierda: Estudios Laboratorios y Personal Activo */}
          <div className="jefa-screen__left-column">
            {/* Tarjeta Estudios Laboratorios (Imagen 2) */}
            <div className="jefa-screen__matrix-card">
              <h3 className="jefa-screen__section-title">Estudios laboratorios</h3>
              <div className="jefa-screen__matrix-table">
                {labMatrix.map((item) => (
                  <div key={item.nombre} className="jefa-screen__matrix-row">
                    <div className="jefa-screen__matrix-cat">
                      <span className="jefa-screen__matrix-cat-name">{item.nombre}</span>
                      <span className="jefa-screen__matrix-cat-total">{item.total} Total</span>
                    </div>
                    <div className="jefa-screen__matrix-tags">
                      <div className="jefa-screen__matrix-tag jefa-screen__matrix-tag--pend">
                        <span className="jefa-screen__matrix-tag-val">{item.pend}</span>
                        <span className="jefa-screen__matrix-tag-lbl">Pend.</span>
                      </div>
                      <div className="jefa-screen__matrix-tag jefa-screen__matrix-tag--curso">
                        <span className="jefa-screen__matrix-tag-val">{item.curso}</span>
                        <span className="jefa-screen__matrix-tag-lbl">Curso</span>
                      </div>
                      <div className="jefa-screen__matrix-tag jefa-screen__matrix-tag--listos">
                        <span className="jefa-screen__matrix-tag-val">{item.listos}</span>
                        <span className="jefa-screen__matrix-tag-lbl">Listos</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personal Activo y Carga (Imagen 2) */}
            <div className="jefa-screen__staff-card">
              <div className="jefa-screen__staff-header">
                <span className="jefa-screen__section-title">Personal activo y carga</span>
                <span className="jefa-screen__staff-count">
                  {staffList.filter((s) => s.estado === 'En turno').length} en turno
                </span>
              </div>

              <ul className="jefa-screen__staff-list">
                {staffList.slice(0, 4).map((staff) => (
                  <li key={staff.id} className="jefa-screen__staff-item">
                    <div className="jefa-screen__staff-info">
                      <span
                        className={`jefa-screen__staff-dot ${
                          staff.estado === 'En turno'
                            ? 'jefa-screen__staff-dot--active'
                            : 'jefa-screen__staff-dot--offline'
                        }`}
                      />
                      <div className="jefa-screen__staff-titles">
                        <span className="jefa-screen__staff-name">{staff.nombre}</span>
                        <span className="jefa-screen__staff-subarea">
                          {staff.area} - {staff.estado}
                        </span>
                      </div>
                    </div>
                    <div className="jefa-screen__staff-stat">
                      <span className="jefa-screen__staff-load-num">{staff.pacientesAtendidos}</span>
                      <span className="jefa-screen__staff-load-lbl">atendidos</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Área Central: Auditoría y Trazabilidad + Personal y Asignación de Turnos */}
          <div className="jefa-screen__center-column">
            {/* Auditoría y trazabilidad (Imagen 2) */}
            <div className="jefa-screen__audit-card">
              <div className="jefa-screen__audit-header">
                <h3 className="jefa-screen__audit-title">Auditoria y trazabilidad</h3>
                <div className="jefa-screen__audit-controls">
                  <div className="jefa-screen__date-box">
                    <input
                      type="date"
                      value={jornadaDate}
                      onChange={(e) => setJornadaDate(e.target.value)}
                      className="jefa-screen__date-input"
                    />
                  </div>
                  <button className="jefa-screen__btn-export" onClick={handleExportPdf}>
                    <Download size={15} />
                    exportar PDF
                  </button>
                  <button className="jefa-screen__btn-email" onClick={handleSendEmail}>
                    <Mail size={15} />
                    enviar por mail
                  </button>
                </div>
              </div>

              <div className="jefa-screen__audit-table-wrap">
                <table className="jefa-screen__audit-table">
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
                        <td className="jefa-screen__audit-id">{t.num_totem || t.id}</td>
                        <td className="jefa-screen__audit-patient">
                          {t.paciente_nombre} {t.paciente_apellido}
                        </td>
                        <td>
                          <TriageBadge categoryKey={t.clasificacion_triage} showPriority={false} />
                        </td>
                        <td>
                          <span
                            className={`jefa-screen__state-pill ${
                              t.estado === 'Atendido'
                                ? 'jefa-screen__state-pill--done'
                                : t.estado === 'En atencion'
                                ? 'jefa-screen__state-pill--progress'
                                : 'jefa-screen__state-pill--wait'
                            }`}
                          >
                            {t.estado}
                          </span>
                        </td>
                        <td className="jefa-screen__audit-mat">{t.mat_admision || '—'}</td>
                        <td className="jefa-screen__audit-mat">{t.mat_box || '—'}</td>
                        <td className="jefa-screen__audit-time">{formatTimeHHMM(t.fecha_hora_admision)}</td>
                        <td className="jefa-screen__audit-time">{formatTimeHHMM(t.fecha_hora_llamado)}</td>
                        <td className="jefa-screen__audit-time">{formatTimeHHMM(t.fecha_hora_cierre)}</td>
                        <td>
                          <button
                            className="jefa-screen__btn-edit-ticket"
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
            <div className="jefa-screen__shifts-card">
              <div className="jefa-screen__shifts-header">
                <div className="jefa-screen__shifts-title-wrap">
                  <UserPlus size={18} className="jefa-screen__shifts-icon" />
                  <h3 className="jefa-screen__shifts-title">Personal y asignacion de turnos</h3>
                </div>
                <button
                  className="jefa-screen__btn-add-staff"
                  onClick={() => setShowAddStaffModal(true)}
                >
                  <Plus size={15} />
                  Nuevo Personal
                </button>
              </div>

              <div className="jefa-screen__shifts-table-wrap">
                <table className="jefa-screen__shifts-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Matricula</th>
                      <th>Rol</th>
                      <th>Turno</th>
                      <th>Estado</th>
                      <th>Habilitación Horaria</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((s) => (
                      <tr key={s.id}>
                        <td className="jefa-screen__shift-name">{s.nombre}</td>
                        <td className="jefa-screen__shift-mat">{s.matricula}</td>
                        <td>
                          <span className="jefa-screen__shift-role">{s.rol}</span>
                        </td>
                        <td className="jefa-screen__shift-turno">{s.turno}</td>
                        <td>
                          <span
                            className={`jefa-screen__status-chip ${
                              s.estado === 'En turno'
                                ? 'jefa-screen__status-chip--active'
                                : 'jefa-screen__status-chip--offline'
                            }`}
                          >
                            {s.estado}
                          </span>
                        </td>
                        <td>
                          {s.rol !== 'Admin' && s.rol !== 'Jefa' ? (
                            <button
                              className={`jefa-screen__btn-toggle-shift ${
                                s.estado === 'En turno'
                                  ? 'jefa-screen__btn-toggle-shift--disable'
                                  : 'jefa-screen__btn-toggle-shift--enable'
                              }`}
                              onClick={() => handleToggleShift(s.id, s.estado)}
                            >
                              {s.estado === 'En turno' ? 'Restringir' : 'Habilitar'}
                            </button>
                          ) : (
                            <span className="jefa-screen__permanent-badge">Acceso 24hs</span>
                          )}
                        </td>
                        <td>
                          {(userData?.rol === 'Admin' || userData?.rol === 'Jefa') && (
                            <button
                              className="jefa-screen__btn-delete-staff"
                              title="Eliminar personal"
                              onClick={() => handleDeleteStaff(s.id, s.nombre, s.rol)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="jefa-screen__search-panel">
          <PatientSearch
            onSelectPatient={(p) =>
              showNotice(`Paciente encontrado: ${p.nombre} ${p.apellido} (DNI ${p.dni})`)
            }
          />
        </div>
      </main>

      {/* Modal de Modificación de Ticket por Jefa (Ventana de 24h) */}
      {editingTicket && (
        <div className="jefa-screen__modal-overlay">
          <div className="jefa-screen__modal-card">
            <button className="jefa-screen__modal-close" onClick={() => setEditingTicket(null)}>
              <X size={18} />
            </button>
            <h3 className="jefa-screen__modal-title">Modificar Ticket Asistencial (Jefa)</h3>
            <p className="jefa-screen__modal-desc">
              Ticket: <strong>{editingTicket.num_totem}</strong> — Paciente:{' '}
              <strong>{editingTicket.paciente_nombre} {editingTicket.paciente_apellido}</strong>
            </p>

            <div className="jefa-screen__modal-field">
              <label>Reclasificar Triage:</label>
              <select
                className="jefa-screen__modal-select"
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
              <div className="jefa-screen__modal-field">
                <label>Justificación técnica:</label>
                <textarea
                  className="jefa-screen__modal-textarea"
                  rows={3}
                  value={editJustification}
                  onChange={(e) => setEditJustification(e.target.value)}
                  placeholder="Justifique el motivo de reclasificación..."
                />
              </div>
            )}

            <div className="jefa-screen__modal-actions">
              <button className="jefa-screen__btn-save" onClick={handleSaveTicketEdit}>
                Confirmar Modificación
              </button>
              <button className="jefa-screen__btn-cancel" onClick={() => setEditingTicket(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alta de Personal por Jefa / Admin */}
      {showAddStaffModal && (
        <div className="jefa-screen__modal-overlay">
          <div className="jefa-screen__modal-card">
            <button className="jefa-screen__modal-close" onClick={() => setShowAddStaffModal(false)}>
              <X size={18} />
            </button>
            <h3 className="jefa-screen__modal-title">Alta de Personal Asistencial</h3>
            <p className="jefa-screen__modal-desc">
              Gestión de personal de Admisión y Box de Atención.
            </p>

            {staffError && (
              <div className="jefa-screen__modal-error">
                <AlertCircle size={16} />
                <span>{staffError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="jefa-screen__staff-form">
              <div className="jefa-screen__modal-field">
                <label>Nombre y Apellido:</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Lic. Roberto Gomez"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                />
              </div>

              <div className="jefa-screen__modal-field">
                <label>Correo Institucional:</label>
                <input
                  type="email"
                  required
                  placeholder="rgomez@sgtp.hospital.gob.ar"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                />
              </div>

              <div className="jefa-screen__modal-field">
                <label>Matrícula Profesional:</label>
                <input
                  type="text"
                  required
                  placeholder="ej: TEC-8821"
                  value={newStaffMatricula}
                  onChange={(e) => setNewStaffMatricula(e.target.value)}
                />
              </div>

              <div className="jefa-screen__modal-field">
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

              <div className="jefa-screen__modal-field">
                <label>Turno Laboral:</label>
                <input
                  type="text"
                  value={newStaffTurno}
                  onChange={(e) => setNewStaffTurno(e.target.value)}
                />
              </div>

              <div className="jefa-screen__modal-actions">
                <button type="submit" className="jefa-screen__btn-save">
                  Crear Usuario
                </button>
                <button
                  type="button"
                  className="jefa-screen__btn-cancel"
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
