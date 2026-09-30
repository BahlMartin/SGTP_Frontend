import React, { useState, useMemo, useCallback } from 'react'
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
import { generateDailyReportPdf } from '../../utils/pdfGenerator'
import {
  computeDailyReportMetrics,
  computeLabMatrix,
  sendDailyReportEmailApi
} from '../../services/reportService'

const getTodayDateString = () => {
  const currentDate = new Date()
  const offsetInMinutes = currentDate.getTimezoneOffset()
  const localDate = new Date(currentDate.getTime() - offsetInMinutes * 60 * 1000)
  return localDate.toISOString().slice(0, 10)
}

export default function JefaScreen() {
  const { tickets, updateTicketAsJefa } = useTriageQueue()
  const { userData } = useAuth()
  const {
    staffList,
    toggleShift,
    deleteStaff,
    createStaff
  } = useStaffManagement()

  const [jornadaDate, setJornadaDate] = useState(() => getTodayDateString())
  const [statusNotice, setStatusNotice] = useState(null)
  const [editingTicket, setEditingTicket] = useState(null)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)

  const showNotice = useCallback((messageText) => {
    setStatusNotice(messageText)
    const timerIdentifier = setTimeout(() => {
      setStatusNotice(null)
    }, 4000)
    return () => clearTimeout(timerIdentifier)
  }, [])

  const labMatrix = useMemo(() => computeLabMatrix(tickets), [tickets])

  const metrics = useMemo(
    () => computeDailyReportMetrics(tickets, new Date(jornadaDate)),
    [tickets, jornadaDate]
  )

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
      const responseEmail = await sendDailyReportEmailApi(jornadaDate, userData?.email)
      showNotice(responseEmail.message)
    } catch (error) {
      alert(error.message)
    }
  }

  const handleSaveTicketEdit = async (ticketId, updatePayload) => {
    try {
      await updateTicketAsJefa(ticketId, updatePayload, userData?.rol)
      setEditingTicket(null)
      showNotice('Ticket asistencial actualizado bajo auditoría inmutable de 24hs.')
    } catch (error) {
      alert(error.message)
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
