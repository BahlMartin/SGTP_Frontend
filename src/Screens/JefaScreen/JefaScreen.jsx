import React, { useEffect, useState } from 'react'
import JefaLayout from './components/JefaLayout'
import JefaHeader from './components/JefaHeader'
import LabMatrixCard from './components/LabMatrixCard'
import ActiveStaffCard from './components/ActiveStaffCard'
import StaffShiftsCard from './components/StaffShiftsCard'
import AddStaffModal from './components/AddStaffModal'
import EditStaffModal from './components/EditStaffModal'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import { useAuth } from '../../context/AuthContext'
import { useStaffManagement } from '../../hooks/useStaffManagement'
import { useFeedbackNotice } from '../../hooks/useFeedbackNotice'
import {
  fetchRendimientoPersonalApi,
  fetchResumenEstudiosApi
} from '../../services/ticketService'
import { getTodayLocalDateString } from '../../utils/formatters'

export default function JefaScreen() {
  const { userData } = useAuth()
  const {
    staffList,
    toggleShift,
    deleteStaff,
    createStaff,
    updateStaff,
    unlockStaff,
    reactivateStaff
  } = useStaffManagement()

  const { notice: statusNotice, showNotice } = useFeedbackNotice(4000)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)

  // Estado para rendimiento de personal por fecha
  const [staffDate, setStaffDate] = useState(() => getTodayLocalDateString())
  const [workloadByStaff, setWorkloadByStaff] = useState({
    ticketsIssuedByStaff: {},
    patientsAttendedByBoxStaff: {}
  })
  const [loadingStaffWorkload, setLoadingStaffWorkload] = useState(false)

  // Estado para estudios de laboratorio (Top 5 y búsqueda con lupa por fecha)
  const [studiesDate, setStudiesDate] = useState(() => getTodayLocalDateString())
  const [studiesSearch, setStudiesSearch] = useState('')
  const [labStudies, setLabStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)

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
        top: studiesSearch.trim() ? null : 5
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

  const handleDeleteStaff = (staffMemberId, staffMemberName, staffMemberRole) => {
    deleteStaff(staffMemberId, staffMemberName, staffMemberRole, userData?.rol, showNotice)
  }

  const handleUnlockStaff = (staffMemberId) => {
    unlockStaff(staffMemberId, showNotice)
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
            <ActiveStaffCard
              staffList={staffList}
              selectedDate={staffDate}
              onDateChange={setStaffDate}
              workloadByStaff={workloadByStaff}
              isLoading={loadingStaffWorkload}
            />
            <LabMatrixCard
              labStudies={labStudies}
              selectedDate={studiesDate}
              onDateChange={setStudiesDate}
              searchQuery={studiesSearch}
              onSearchChange={setStudiesSearch}
              onClearSearch={() => setStudiesSearch('')}
              isLoading={loadingStudies}
            />
          </>
        }
        centerContent={
          <StaffShiftsCard
            staffList={staffList}
            currentUserRole={userData?.rol}
            onOpenAddStaff={() => setShowAddStaffModal(true)}
            onToggleShift={handleToggleShift}
            onDeleteStaff={handleDeleteStaff}
            onEditStaff={setEditingStaff}
            onUnlockStaff={handleUnlockStaff}
            onReactivateStaff={handleReactivateStaff}
          />
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
    </>
  )
}
