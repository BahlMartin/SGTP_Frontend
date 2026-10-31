import React, { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Users, Clock } from 'lucide-react'
import JefaLayout from './components/JefaLayout'
import JefaHeader from './components/JefaHeader'
import LabMatrixCard from './components/LabMatrixCard'
import ActiveStaffCard from './components/ActiveStaffCard'
import StaffShiftsCard from './components/StaffShiftsCard'
import StaffSecurityCard from './components/StaffSecurityCard/StaffSecurityCard'
import SlaConfigCard from './components/SlaConfigCard/SlaConfigCard'
import AddStaffModal from './components/AddStaffModal'
import EditStaffModal from './components/EditStaffModal'
import AuthorizeOvertimeModal from './components/AuthorizeOvertimeModal'
import ActiveBoxesCard from '../../components/ActiveBoxesCard/ActiveBoxesCard'
import PatientHistoryModal from '../../components/PatientHistoryModal/PatientHistoryModal'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import FloatingToast from '../../components/FloatingToast/FloatingToast'
import { useAuth } from '../../context/AuthContext'
import { useBox } from '../../context/BoxContext'
import { useStaffManagement } from '../../hooks/useStaffManagement'
import { useFeedbackNotice } from '../../hooks/useFeedbackNotice'
import { useWebSocket } from '../../hooks/useWebSocket'
import {
  fetchRendimientoPersonalApi,
  fetchResumenEstudiosApi
} from '../../services/ticketService'
import { getTodayLocalDateString } from '../../utils/formatters'

export default function JefaScreen() {
  const { userData } = useAuth()
  const {
    staffList,
    loadStaff,
    toggleShift,
    authorizeShiftException,
    revokeShiftException,
    bulkRevokeShiftExceptions,
    deleteStaff,
    createStaff,
    updateStaff,
    unlockStaff,
    lockStaff,
    reactivateStaff
  } = useStaffManagement()
  const { refreshBoxes, boxesLoading } = useBox()

  const { notice: statusNotice, showNotice } = useFeedbackNotice(4000)
  const [toastAlert, setToastAlert] = useState(null)
  const [isManagementView, setIsManagementView] = useState(false)
  const [activeCenterTab, setActiveCenterTab] = useState('shifts')
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [staffForOvertime, setStaffForOvertime] = useState(null)
  const [selectedStaffForTickets, setSelectedStaffForTickets] = useState(null)

  const showToast = (message, type = 'success', title = null) => {
    setToastAlert({ message, type, title })
    showNotice(message)
  }

  // --- Conexión WebSocket Única Centralizada (Monitor Operativo para Jefatura) ---
  const { lastMessage: wsMessage } = useWebSocket('monitor-operativo')

  const handleSelectStaffForTickets = (staffMember) => {
    const roleNorm = String(staffMember?.rol || '').trim().toLowerCase()
    if (roleNorm === 'jefa' || roleNorm === 'secretaria') return
    setSelectedStaffForTickets(staffMember)
  }

  // Estado para rendimiento de personal por fecha
  const [staffDate, setStaffDate] = useState(() => getTodayLocalDateString())
  const [workloadByStaff, setWorkloadByStaff] = useState({
    ticketsIssuedByStaff: {},
    patientsAttendedByBoxStaff: {}
  })
  const [loadingStaffWorkload, setLoadingStaffWorkload] = useState(false)

  // Estado para estudios de laboratorio
  const [studiesDate, setStudiesDate] = useState(() => getTodayLocalDateString())
  const [studiesSearch, setStudiesSearch] = useState('')
  const [studiesFilter, setStudiesFilter] = useState('all') // 'all' | 'top5'
  const [labStudies, setLabStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date())

  const isGlobalRefreshing = isRefreshingAll || loadingStaffWorkload || loadingStudies || boxesLoading

  // 1. PANEL "PERSONAL Y CARGA": Reaccionar a cambios en Tickets, Reportes, Cola o Boxes
  useEffect(() => {
    if (!wsMessage) return
    const eventName = wsMessage.event || wsMessage.action

    if (
      [
        'TICKET_CREATED',
        'NEW_TICKET',
        'REALTIME_METRICS_UPDATED',
        'REFRESH_REPORTS',
        'QUEUE_UPDATED',
        'TICKET_LLAMADO',
        'STAFF_UPDATED',
        'BOX_UPDATED',
        'BOX_ATTENDING',
        'LAB_STUDIES_UPDATED'
      ].includes(eventName)
    ) {
      // Re-consultamos métricas de carga de personal
      fetchRendimientoPersonalApi(staffDate)
        .then((data) => {
          setWorkloadByStaff({
            ticketsIssuedByStaff: data.tickets_por_personal || {},
            patientsAttendedByBoxStaff: data.atenciones_por_personal || {},
            patientsAbsentByBoxStaff: data.ausentes_por_personal || {}
          })
        })
        .catch((err) => console.error('Error al actualizar carga por WS:', err))

      // Actualizamos el personal activo (quién está en turno)
      loadStaff().catch(err => console.error('Error al recargar personal:', err))
      
      setLastRefreshedAt(new Date())
    }
  }, [wsMessage, staffDate, loadStaff])

  // 2. PANEL "BOXES DE ATENCIÓN": Reaccionar a cambios de estado o atención en Boxes
  useEffect(() => {
    if (!wsMessage) return
    const eventName = wsMessage.event || wsMessage.action

    if (['BOX_ATTENDING', 'BOX_UPDATED', 'UPDATE_BOX', 'TICKET_LLAMADO'].includes(eventName)) {
      refreshBoxes().catch(err => console.error('Error al actualizar boxes por WS:', err))
      setLastRefreshedAt(new Date())
    }
  }, [wsMessage, refreshBoxes])

  // 3. PANEL "ESTUDIOS DE LABORATORIO": Reaccionar al cierre de atención en Box
  useEffect(() => {
    if (!wsMessage) return
    const eventName = wsMessage.event || wsMessage.action

    if (
      [
        'LAB_STUDIES_UPDATED',
        'ESTUDIOS_ACTUALIZADOS',
        'REFRESH_LAB_STUDIES',
        'LAB_RESULT_READY'
      ].includes(eventName)
    ) {
      fetchResumenEstudiosApi({
        fechaStr: studiesDate,
        search: studiesSearch,
        top: null
      })
        .then((data) => {
          // Soporta tanto si la API retorna una lista directa [...] como si retorna { estudios: [...] }
          const listaEstudios = Array.isArray(data) ? data : (data?.estudios || data?.results || [])
          setLabStudies(listaEstudios)
        })
        .catch((err) => console.error('Error al actualizar laboratorio por WS:', err))

      setLastRefreshedAt(new Date())
    }
  }, [wsMessage, studiesDate, studiesSearch])


  const handleRefreshAll = async () => {
    setIsRefreshingAll(true)
    try {
      await Promise.all([
        fetchRendimientoPersonalApi(staffDate)
          .then((data) => {
            setWorkloadByStaff({
              ticketsIssuedByStaff: data.tickets_por_personal || {},
              patientsAttendedByBoxStaff: data.atenciones_por_personal || {},
            patientsAbsentByBoxStaff: data.ausentes_por_personal || {}
            })
          })
          .catch((error) => {
            console.error('Error al actualizar carga de personal:', error)
          }),
        loadStaff().catch((error) => {
          console.error('Error al actualizar personal:', error)
        }),
        refreshBoxes().catch((error) => {
          console.error('Error al actualizar boxes:', error)
        }),
        fetchResumenEstudiosApi({
          fechaStr: studiesDate,
          search: studiesSearch,
          top: null
        })
          .then((data) => {
            setLabStudies(data.estudios || [])
          })
          .catch((error) => {
            console.error('Error al actualizar estudios:', error)
          })
      ])
      setLastRefreshedAt(new Date())
      showNotice('Personal, boxes y estudios actualizados.')
    } catch (err) {
      console.error('Error en refresco general:', err)
    } finally {
      setIsRefreshingAll(false)
    }
  }

  const formattedRefreshTime = lastRefreshedAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  // Carga reactiva de rendimiento de personal al cambiar la fecha seleccionada
  useEffect(() => {
    let isMounted = true
    setLoadingStaffWorkload(true)

    fetchRendimientoPersonalApi(staffDate)
      .then((data) => {
        if (!isMounted) return
        setWorkloadByStaff({
          ticketsIssuedByStaff: data.tickets_por_personal || {},
          patientsAttendedByBoxStaff: data.atenciones_por_personal || {},
          patientsAbsentByBoxStaff: data.ausentes_por_personal || {}
        })
      })
      .catch((error) => {
        console.error('Error al cargar la carga de personal:', error)
        if (isMounted) {
          showNotice(error.message || 'No se pudo cargar la carga de atenciones por personal.')
        }
      })
      .finally(() => {
        if (isMounted) setLoadingStaffWorkload(false)
      })

    return () => {
      isMounted = false
    }
  }, [staffDate, showNotice])

  // Carga reactiva de estudios de laboratorio
  useEffect(() => {
    let isMounted = true
    setLoadingStudies(true)

    const timer = setTimeout(() => {
      fetchResumenEstudiosApi({
        fechaStr: studiesDate,
        search: studiesSearch,
        top: null
      })
        .then((data) => {
          if (!isMounted) return
          setLabStudies(data.estudios || [])
        })
        .catch((error) => {
          console.error('Error al consultar estudios de laboratorio:', error)
          if (isMounted) {
            showNotice(error.message || 'No se pudo cargar el resumen de estudios.')
          }
        })
        .finally(() => {
          if (isMounted) setLoadingStudies(false)
        })
    }, studiesSearch ? 250 : 0)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [studiesDate, studiesSearch, showNotice])

  const handleCreateStaff = async (newStaffPayload) => {
    try {
      await createStaff(newStaffPayload, userData?.rol, (msg) => {
        showToast(msg, 'success', 'Personal Incorporado')
      })
      setShowAddStaffModal(false)
    } catch (err) {
      showToast(err.message || 'Error al incorporar personal.', 'error', 'Error al Crear Personal')
      throw err
    }
  }

  const handleUpdateStaff = async (staffMemberId, updatePayload) => {
    try {
      await updateStaff(staffMemberId, updatePayload, (msg) => {
        showToast(msg, 'success', 'Personal Actualizado')
      })
      setEditingStaff(null)
    } catch (err) {
      showToast(err.message || 'Error al actualizar datos del personal.', 'error', 'Error al Actualizar')
      throw err
    }
  }

  const handleToggleShift = (staffMemberId, currentStatus) => {
    toggleShift(staffMemberId, currentStatus, (msg) => {
      showToast(msg, 'success', 'Estado de Turno Actualizado')
    })
  }

  const handleAuthorizeOvertime = async (payload) => {
    await authorizeShiftException(payload, (msg) => {
      showToast(msg, 'success', 'Horario Excepcional')
    })
  }

  const handleRevokeOvertime = async (habilitacionId) => {
    await revokeShiftException(habilitacionId, (msg) => {
      showToast(msg, 'success', 'Horas Extras Revocadas')
    })
  }

  const handleBulkRevokeOvertime = async (payload) => {
    await bulkRevokeShiftExceptions(payload, (msg) => {
      showToast(msg, 'success', 'Horas Extras Revocadas')
    })
  }

  const handleDeleteStaff = (staffMemberId, staffMemberName, staffMemberRole) => {
    deleteStaff(staffMemberId, staffMemberName, staffMemberRole, userData?.rol, (msg) => {
      showToast(msg, 'success', 'Personal Eliminado')
    })
  }

  const handleUnlockStaff = (staffMemberId) => {
    unlockStaff(staffMemberId, (msg) => {
      showToast(msg, 'success', 'Cuenta Desbloqueada')
    })
  }

  const handleLockStaff = (staffMemberId) => {
    lockStaff(staffMemberId, (msg) => {
      showToast(msg, 'success', 'Cuenta Bloqueada')
    })
  }

  const handleReactivateStaff = (staffMemberId) => {
    reactivateStaff(staffMemberId, (msg) => {
      showToast(msg, 'success', 'Cuenta Reactivada')
    })
  }

  return (
    <>
      <JefaLayout
        headerContent={
          <JefaHeader
            statusMessage={statusNotice}
            title={isManagementView ? 'Gestión de personal y cuentas' : 'Supervisión'}
            subtitle={
              isManagementView
                ? 'Administración de turnos, personal y seguridad de cuentas'
                : 'Búsqueda de pacientes y gestión del personal asistencial'
            }
          />
        }
        isManagementView={isManagementView}
        onGoToManagement={() => setIsManagementView(true)}
        onBackToMain={() => setIsManagementView(false)}
        desktopSearchContent={
          <div className="jefa-screen__search-panel">
            <PatientSearch />
          </div>
        }
        primaryContent={
          <div className="jefa-screen__overview">
            <div className="jefa-screen__overview-toolbar">
              <div className="jefa-screen__overview-toolbar-left">
                <span className="jefa-screen__overview-title">Monitoreo operativo</span>
                <span className="jefa-screen__overview-subtitle">
                  Personal, boxes y laboratorio
                </span>
              </div>
              {/* Botón de actualizar desactivado temporalmente para validar actualizaciones automáticas vía WebSocket */}
              {/*
              <button
                type="button"
                className="jefa-screen__overview-refresh-btn"
                onClick={handleRefreshAll}
                disabled={isGlobalRefreshing}
                title={`Última actualización: ${formattedRefreshTime}`}
              >
                <RefreshCw
                  size={13}
                  className={isGlobalRefreshing ? 'jefa-screen__overview-refresh-icon--spinning' : ''}
                  aria-hidden="true"
                />
                <span>Actualizar</span>
                <span className="jefa-screen__overview-refresh-time">{formattedRefreshTime}</span>
              </button>
              */}
            </div>

            <div className="jefa-screen__overview-grid">
              <ActiveStaffCard
                staffList={staffList}
                selectedDate={staffDate}
                onDateChange={setStaffDate}
                workloadByStaff={workloadByStaff}
                isLoading={loadingStaffWorkload}
                onSelectStaff={handleSelectStaffForTickets}
              />
              <div className="jefa-screen__desktop-boxes">
                <ActiveBoxesCard
                  canToggleStatus={true}
                  onNotice={showNotice}
                  onSelectStaff={handleSelectStaffForTickets}
                />
              </div>
              <LabMatrixCard
                labStudies={labStudies}
                selectedDate={studiesDate}
                onDateChange={setStudiesDate}
                searchQuery={studiesSearch}
                onSearchChange={setStudiesSearch}
                onClearSearch={() => setStudiesSearch('')}
                isLoading={loadingStudies}
                filterMode={studiesFilter}
                onFilterChange={setStudiesFilter}
                onNotice={showNotice}
              />
            </div>
          </div>
        }
        desktopManagementContent={
          <div className="jefa-screen__desktop-management">
            <div
              className="jefa-screen__view-tabs"
              role="tablist"
              aria-label="Secciones de gestión de personal"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCenterTab === 'shifts'}
                className={`jefa-screen__view-tab ${
                  activeCenterTab === 'shifts' ? 'jefa-screen__view-tab--active' : ''
                }`}
                onClick={() => setActiveCenterTab('shifts')}
              >
                <Users className="jefa-screen__view-tab-icon" />
                <span>Personal y Asignación de Turnos</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCenterTab === 'security'}
                className={`jefa-screen__view-tab ${
                  activeCenterTab === 'security' ? 'jefa-screen__view-tab--active' : ''
                }`}
                onClick={() => setActiveCenterTab('security')}
              >
                <ShieldCheck className="jefa-screen__view-tab-icon" />
                <span>Seguridad y Bloqueo de Cuentas</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCenterTab === 'sla'}
                className={`jefa-screen__view-tab ${
                  activeCenterTab === 'sla' ? 'jefa-screen__view-tab--active' : ''
                }`}
                onClick={() => setActiveCenterTab('sla')}
              >
                <Clock className="jefa-screen__view-tab-icon" />
                <span>Tiempos de espera (SLA)</span>
              </button>
            </div>
            {activeCenterTab === 'shifts' ? (
              <StaffShiftsCard
                staffList={staffList}
                currentUserRole={userData?.rol}
                onOpenAddStaff={() => setShowAddStaffModal(true)}
                onAuthorizeOvertime={setStaffForOvertime}
                onToggleShift={handleToggleShift}
                onDeleteStaff={handleDeleteStaff}
                onEditStaff={setEditingStaff}
                onUnlockStaff={handleUnlockStaff}
                onReactivateStaff={handleReactivateStaff}
              />
            ) : activeCenterTab === 'security' ? (
              <StaffSecurityCard
                staffList={staffList}
                currentUserRole={userData?.rol}
                currentUserId={userData?.id_personal || userData?.id}
                onUnlockStaff={handleUnlockStaff}
                onLockStaff={handleLockStaff}
              />
            ) : (
              <SlaConfigCard onNotice={showNotice} />
            )}
          </div>
        }
        managementContent={
          <div className="jefa-screen__management-view">
            <div
              className="jefa-screen__view-tabs"
              role="tablist"
              aria-label="Secciones de gestión de personal"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCenterTab === 'shifts'}
                className={`jefa-screen__view-tab ${
                  activeCenterTab === 'shifts' ? 'jefa-screen__view-tab--active' : ''
                }`}
                onClick={() => setActiveCenterTab('shifts')}
              >
                <Users className="jefa-screen__view-tab-icon" />
                <span>Personal y Asignación de Turnos</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCenterTab === 'security'}
                className={`jefa-screen__view-tab ${
                  activeCenterTab === 'security' ? 'jefa-screen__view-tab--active' : ''
                }`}
                onClick={() => setActiveCenterTab('security')}
              >
                <ShieldCheck className="jefa-screen__view-tab-icon" />
                <span>Seguridad y Bloqueo de Cuentas</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCenterTab === 'sla'}
                className={`jefa-screen__view-tab ${
                  activeCenterTab === 'sla' ? 'jefa-screen__view-tab--active' : ''
                }`}
                onClick={() => setActiveCenterTab('sla')}
              >
                <Clock className="jefa-screen__view-tab-icon" />
                <span>Tiempos de espera (SLA)</span>
              </button>
            </div>
            {activeCenterTab === 'shifts' ? (
              <StaffShiftsCard
                staffList={staffList}
                currentUserRole={userData?.rol}
                onOpenAddStaff={() => setShowAddStaffModal(true)}
                onAuthorizeOvertime={setStaffForOvertime}
                onToggleShift={handleToggleShift}
                onDeleteStaff={handleDeleteStaff}
                onEditStaff={setEditingStaff}
                onUnlockStaff={handleUnlockStaff}
                onReactivateStaff={handleReactivateStaff}
              />
            ) : activeCenterTab === 'security' ? (
              <StaffSecurityCard
                staffList={staffList}
                currentUserRole={userData?.rol}
                currentUserId={userData?.id_personal || userData?.id}
                onUnlockStaff={handleUnlockStaff}
                onLockStaff={handleLockStaff}
              />
            ) : (
              <SlaConfigCard onNotice={showNotice} />
            )}
          </div>
        }
        searchContent={<PatientSearch />}
        boxesContent={
          <ActiveBoxesCard
            canToggleStatus={true}
            onNotice={showNotice}
            onSelectStaff={handleSelectStaffForTickets}
          />
        }
      />

      <AddStaffModal
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        onSubmit={handleCreateStaff}
        currentUserRole={userData?.rol}
      />

      {editingStaff && (
        <EditStaffModal
          staffMember={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSubmit={handleUpdateStaff}
        />
      )}

      {staffForOvertime && (
        <AuthorizeOvertimeModal
          isOpen={Boolean(staffForOvertime)}
          staffMember={staffForOvertime}
          onClose={() => setStaffForOvertime(null)}
          onSubmit={handleAuthorizeOvertime}
          onRevoke={handleRevokeOvertime}
          onBulkRevoke={handleBulkRevokeOvertime}
        />
      )}

      {selectedStaffForTickets && (
        <PatientHistoryModal
          staffMember={selectedStaffForTickets}
          selectedDate={staffDate}
          onClose={() => setSelectedStaffForTickets(null)}
        />
      )}

      {toastAlert && (
        <FloatingToast
          message={toastAlert.message}
          type={toastAlert.type}
          title={toastAlert.title}
          onClose={() => setToastAlert(null)}
        />
      )}
    </>
  )
}
