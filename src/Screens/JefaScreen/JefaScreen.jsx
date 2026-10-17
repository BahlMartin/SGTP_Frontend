import React, { useEffect, useState, useCallback } from 'react'   
import { Users, ShieldCheck, RefreshCw } from 'lucide-react'
import JefaLayout from './components/JefaLayout'
import JefaHeader from './components/JefaHeader'
import LabMatrixCard from './components/LabMatrixCard'
import ActiveStaffCard from './components/ActiveStaffCard'
import StaffShiftsCard from './components/StaffShiftsCard'
import StaffSecurityCard from './components/StaffSecurityCard/StaffSecurityCard'
import AddStaffModal from './components/AddStaffModal'
import EditStaffModal from './components/EditStaffModal'
import AuthorizeOvertimeModal from './components/AuthorizeOvertimeModal'
import ActiveBoxesCard from '../../components/ActiveBoxesCard/ActiveBoxesCard'
import PatientHistoryModal from '../../components/PatientHistoryModal/PatientHistoryModal'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import { useAuth } from '../../context/AuthContext'
import { useBox } from '../../context/BoxContext'
import { useStaffManagement } from '../../hooks/useStaffManagement'
import { useFeedbackNotice } from '../../hooks/useFeedbackNotice'
import {
  fetchRendimientoPersonalApi,
  fetchResumenEstudiosApi
} from '../../services/ticketService'
import { getTodayLocalDateString } from '../../utils/formatters'

import useWebSocket from '../../hooks/useWebSocket' // [NUEVO]

export default function JefaScreen() {
  const { userData } = useAuth()
  const {
    staffList,
    loadStaff,
    toggleShift,
    authorizeShiftException,
    revokeShiftException,
    deleteStaff,
    createStaff,
    updateStaff,
    unlockStaff,
    lockStaff,
    reactivateStaff
  } = useStaffManagement()
  const { refreshBoxes, boxesLoading } = useBox()

  const { notice: statusNotice, showNotice } = useFeedbackNotice(4000)
  const [activeCenterTab, setActiveCenterTab] = useState('shifts') // 'shifts' | 'security'
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [staffForOvertime, setStaffForOvertime] = useState(null)
  const [selectedStaffForTickets, setSelectedStaffForTickets] = useState(null)

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

  // Estado para estudios de laboratorio (búsqueda y filtro Top 5 / Todos por fecha)
  const [studiesDate, setStudiesDate] = useState(() => getTodayLocalDateString())
  const [studiesSearch, setStudiesSearch] = useState('')
  const [studiesFilter, setStudiesFilter] = useState('all') // 'all' | 'top5'
  const [labStudies, setLabStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date())

  const isGlobalRefreshing = isRefreshingAll || loadingStaffWorkload || loadingStudies || boxesLoading

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true)
    try {
      await Promise.all([
        fetchRendimientoPersonalApi(staffDate)
          .then((data) => {
            setWorkloadByStaff({
              ticketsIssuedByStaff: data.tickets_por_personal || {},
              patientsAttendedByBoxStaff: data.atenciones_por_personal || {}
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

  // [NUEVO] Escuchar el Monitor Operativo
  useWebSocket('monitor-operativo', {
    onMessage: useCallback((msg) => {
      // Cuando ingresa un ticket nuevo o se cierra una atención (REFRESH_REPORTS),
      // forzamos la actualización silenciosa del dashboard de la jefa.
      if (msg?.action === 'NEW_TICKET' || msg?.action === 'REFRESH_REPORTS') {
        handleRefreshAll()
      }
    }, [handleRefreshAll])
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
          patientsAttendedByBoxStaff: data.atenciones_por_personal || {}
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

  // Carga reactiva de estudios de laboratorio al cambiar fecha o término de búsqueda (con debounce sutil)
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
    await createStaff(newStaffPayload, userData?.rol, showNotice)
  }

  const handleUpdateStaff = async (staffMemberId, updatePayload) => {
    await updateStaff(staffMemberId, updatePayload, showNotice)
    setEditingStaff(null)
  }

  const handleToggleShift = (staffMemberId, currentStatus) => {
    toggleShift(staffMemberId, currentStatus, showNotice)
  }

  const handleAuthorizeOvertime = async (payload) => {
    await authorizeShiftException(payload, showNotice)
  }

  const handleRevokeOvertime = async (habilitacionId) => {
    await revokeShiftException(habilitacionId, showNotice)
  }

  const handleDeleteStaff = (staffMemberId, staffMemberName, staffMemberRole) => {
    deleteStaff(staffMemberId, staffMemberName, staffMemberRole, userData?.rol, showNotice)
  }

  const handleUnlockStaff = (staffMemberId) => {
    unlockStaff(staffMemberId, showNotice)
  }

  const handleLockStaff = (staffMemberId) => {
    lockStaff(staffMemberId, showNotice)
  }

  const handleReactivateStaff = (staffMemberId) => {
    reactivateStaff(staffMemberId, showNotice)
  }

  return (
    <>
      <JefaLayout
        headerContent={<JefaHeader statusMessage={statusNotice} />}
        leftContent={
          <>
            <div className="jefa-screen__overview-toolbar">
              <div className="jefa-screen__overview-toolbar-left">
                <span className="jefa-screen__overview-title">Monitoreo operativo</span>
                <span className="jefa-screen__overview-subtitle">Personal, boxes y laboratorio</span>
              </div>
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
            </div>

            <ActiveStaffCard
              staffList={staffList}
              selectedDate={staffDate}
              onDateChange={setStaffDate}
              workloadByStaff={workloadByStaff}
              isLoading={loadingStaffWorkload}
              onSelectStaff={handleSelectStaffForTickets}
            />
            <ActiveBoxesCard
              canToggleStatus={true}
              onNotice={showNotice}
              onSelectStaff={handleSelectStaffForTickets}
            />
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
            />
          </>
        }
        centerContent={
          <div className="jefa-screen__center-content-wrapper">
            <div className="jefa-screen__view-tabs" role="tablist" aria-label="Secciones de gestión de personal">
              <button
                type="button"
                role="tab"
                aria-selected={activeCenterTab === 'shifts'}
                className={`jefa-screen__view-tab ${activeCenterTab === 'shifts' ? 'jefa-screen__view-tab--active' : ''}`}
                onClick={() => setActiveCenterTab('shifts')}
              >
                <Users className="jefa-screen__view-tab-icon" />
                <span>Personal y Asignación de Turnos</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCenterTab === 'security'}
                className={`jefa-screen__view-tab ${activeCenterTab === 'security' ? 'jefa-screen__view-tab--active' : ''}`}
                onClick={() => setActiveCenterTab('security')}
              >
                <ShieldCheck className="jefa-screen__view-tab-icon" />
                <span>Seguridad y Bloqueo de Cuentas</span>
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
            ) : (
              <StaffSecurityCard
                staffList={staffList}
                currentUserRole={userData?.rol}
                currentUserId={userData?.id_personal || userData?.id}
                onUnlockStaff={handleUnlockStaff}
                onLockStaff={handleLockStaff}
              />
            )}
          </div>
        }
        searchContent={<PatientSearch />}
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
        />
      )}

      {selectedStaffForTickets && (
        <PatientHistoryModal
          staffMember={selectedStaffForTickets}
          selectedDate={staffDate}
          onClose={() => setSelectedStaffForTickets(null)}
        />
      )}
    </>
  )
}
