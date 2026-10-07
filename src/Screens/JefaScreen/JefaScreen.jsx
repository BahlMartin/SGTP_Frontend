import React, { useEffect, useMemo, useState } from 'react'
import JefaLayout from './components/JefaLayout'
import JefaHeader from './components/JefaHeader'
import LabMatrixCard from './components/LabMatrixCard'
import ActiveStaffCard from './components/ActiveStaffCard'
import StaffShiftsCard from './components/StaffShiftsCard'
import AddStaffModal from './components/AddStaffModal'
import EditStaffModal from './components/EditStaffModal'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { useStaffManagement } from '../../hooks/useStaffManagement'
import { useFeedbackNotice } from '../../hooks/useFeedbackNotice'
import { fetchAsignacionesBoxApi } from '../../services/boxService'
import { computeTopLabStudies } from '../../services/reportService'

export default function JefaScreen() {
  const { tickets, refreshTickets } = useTriageQueue()
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
  const [boxAssignments, setBoxAssignments] = useState([])

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      refreshTickets()
    }, 30_000)

    return () => window.clearInterval(refreshInterval)
  }, [refreshTickets])

  useEffect(() => {
    let isMounted = true
    fetchAsignacionesBoxApi()
      .then((assignments) => {
        if (isMounted) setBoxAssignments(assignments)
      })
      .catch((error) => {
        console.error('Error al cargar las atenciones del personal:', error)
        if (isMounted) {
          showNotice(error.message || 'No se pudo cargar la carga de atenciones por personal.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [showNotice])

  const workloadByStaff = useMemo(() => {
    const completedTickets = tickets.filter(
      (ticket) => ticket.estado === 'Atendido' || ticket.estado_backend === 'Finalizado'
    )
    const completedTicketIds = new Set(
      completedTickets.map((ticket) => String(ticket.id_ticket || ticket.id))
    )
    const ticketsIssuedByStaff = {}

    for (const ticket of tickets) {
      const staffId = ticket.personal_admision
      if (staffId !== null && staffId !== undefined) {
        const key = String(staffId)
        ticketsIssuedByStaff[key] = (ticketsIssuedByStaff[key] || 0) + 1
      }
    }

    const boxPatientsByStaff = new Map()
    for (const assignment of boxAssignments) {
      const ticketId = assignment.ticket ? String(assignment.ticket) : ''
      if (
        !assignment.personal ||
        !ticketId ||
        !assignment.fecha_hora_final ||
        assignment.motivo_cierre !== 'Finalizado' ||
        !completedTicketIds.has(ticketId)
      ) {
        continue
      }

      const staffId = String(assignment.personal)
      if (!boxPatientsByStaff.has(staffId)) boxPatientsByStaff.set(staffId, new Set())
      boxPatientsByStaff.get(staffId).add(ticketId)
    }

    const patientsAttendedByBoxStaff = Object.fromEntries(
      Array.from(boxPatientsByStaff, ([staffId, patientIds]) => [staffId, patientIds.size])
    )

    return { ticketsIssuedByStaff, patientsAttendedByBoxStaff }
  }, [boxAssignments, tickets])
  const topLabStudies = useMemo(() => computeTopLabStudies(tickets), [tickets])

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
            <ActiveStaffCard staffList={staffList} workloadByStaff={workloadByStaff} />
            <LabMatrixCard labStudies={topLabStudies} />
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
