import React, { useState, useMemo } from 'react'
import JefaLayout from './components/JefaLayout'
import JefaHeader from './components/JefaHeader'
import LabMatrixCard from './components/LabMatrixCard'
import ActiveStaffCard from './components/ActiveStaffCard'
import AuditTraceabilityCard from './components/AuditTraceabilityCard'
import StaffShiftsCard from './components/StaffShiftsCard'
import EditTicketModal from './components/EditTicketModal'
import AddStaffModal from './components/AddStaffModal'
import PatientSearch from '../../components/PatientSearch/PatientSearch'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { useAuth } from '../../context/AuthContext'
import { useStaffManagement } from '../../hooks/useStaffManagement'
import { useExportReportPdf } from '../../hooks/useExportReportPdf'
import { useSendReportEmail } from '../../hooks/useSendReportEmail'
import { useFeedbackNotice } from '../../hooks/useFeedbackNotice'
import { getTodayLocalDateString } from '../../utils/formatters'
import { computeDailyReportMetrics, computeLabMatrix } from '../../services/reportService'

export default function JefaScreen() {
  const { tickets, updateTicketAsJefa } = useTriageQueue()
  const { userData } = useAuth()
  const {
    staffList,
    toggleShift,
    deleteStaff,
    createStaff
  } = useStaffManagement()

  const [jornadaDate, setJornadaDate] = useState(() => getTodayLocalDateString())
  const { notice: statusNotice, showNotice } = useFeedbackNotice(4000)
  const [editingTicket, setEditingTicket] = useState(null)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)

  const labMatrix = useMemo(() => computeLabMatrix(tickets), [tickets])

  const metrics = useMemo(
    () => computeDailyReportMetrics(tickets, new Date(jornadaDate)),
    [tickets, jornadaDate]
  )

  // Hook reutilizable para la generación y descarga del PDF
  const { handleExportPdf } = useExportReportPdf({
    jornadaDate,
    metrics,
    userData,
    onSuccessNotice: showNotice
  })

  // Hook reutilizable para el envío del reporte por email
  const { handleSendEmail } = useSendReportEmail({
    jornadaDate,
    recipientEmail: userData?.email,
    onSuccessNotice: showNotice
  })

  const handleSaveTicketEdit = async (ticketId, updatePayload) => {
    try {
      await updateTicketAsJefa(ticketId, updatePayload, userData?.rol)
      setEditingTicket(null)
      showNotice('Ticket asistencial actualizado bajo auditoría inmutable de 24hs.')
    } catch (errorInstance) {
      alert(errorInstance.message || 'Error al actualizar el ticket.')
    }
  }

  const handleCreateStaff = async (newStaffPayload) => {
    await createStaff(newStaffPayload, userData?.rol, showNotice)
  }

  const handleToggleShift = (staffMemberId, currentStatus) => {
    toggleShift(staffMemberId, currentStatus, showNotice)
  }

  const handleDeleteStaff = (staffMemberId, staffMemberName, staffMemberRole) => {
    deleteStaff(staffMemberId, staffMemberName, staffMemberRole, userData?.rol, showNotice)
  }

  const handleSelectPatient = (selectedPatient) => {
    showNotice(
      `Paciente encontrado: ${selectedPatient.nombre} ${selectedPatient.apellido} (DNI ${selectedPatient.dni})`
    )
  }

  return (
    <>
      <JefaLayout
        headerContent={<JefaHeader statusMessage={statusNotice} />}
        leftContent={
          <>
            <LabMatrixCard labMatrix={labMatrix} />
            <ActiveStaffCard staffList={staffList} />
          </>
        }
        centerContent={
          <>
            <AuditTraceabilityCard
              jornadaDate={jornadaDate}
              onDateChange={setJornadaDate}
              onExportPdf={handleExportPdf}
              onSendEmail={handleSendEmail}
              tickets={tickets}
              onOpenEditTicket={setEditingTicket}
            />
            <StaffShiftsCard
              staffList={staffList}
              currentUserRole={userData?.rol}
              onOpenAddStaff={() => setShowAddStaffModal(true)}
              onToggleShift={handleToggleShift}
              onDeleteStaff={handleDeleteStaff}
            />
          </>
        }
        searchContent={<PatientSearch onSelectPatient={handleSelectPatient} />}
      />

      <EditTicketModal
        ticket={editingTicket}
        onClose={() => setEditingTicket(null)}
        onSave={handleSaveTicketEdit}
      />

      <AddStaffModal
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        onSubmit={handleCreateStaff}
        currentUserRole={userData?.rol}
      />
    </>
  )
}
