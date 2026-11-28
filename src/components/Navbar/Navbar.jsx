import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, LogOut, User, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBox } from '../../context/BoxContext'
import { useTriageQueue } from '../../context/TriageQueueContext'
import { getHomePathByRole } from '../../utils/navigation'
import Logo from '../Logo/Logo'
import './Navbar.css'

const ADMISSION_ACTIVE_TURNO_KEY = 'sgtp_admision_active_turno'
const ADMISSION_FORM_DRAFT_KEY = 'sgtp_admision_form_draft'
const ADMISSION_STATE_CHANGED_EVENT = 'sgtp:admision_state_changed'

function readAdmisionActiveState() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        hasActiveTurno: false,
        activeTurno: null,
        hasFormInProgress: false
      }
    }

    const activeRaw = window.localStorage.getItem(ADMISSION_ACTIVE_TURNO_KEY)
    const activeParsed = activeRaw ? JSON.parse(activeRaw) : null
    const activeTurno = activeParsed?.activeReceptionTurno || null
    const activeTurnoId = activeParsed?.activeReceptionTurnoId || activeTurno?.id || null

    const draftRaw = window.localStorage.getItem(ADMISSION_FORM_DRAFT_KEY)
    const draftParsed = draftRaw ? JSON.parse(draftRaw) : null
    const formData = draftParsed?.formData || null

    const hasFormInProgress = Boolean(
      formData &&
        (String(formData.dni || '').trim() ||
          String(formData.nombre || '').trim() ||
          String(formData.apellido || '').trim() ||
          String(formData.numeroAfiliado || '').trim() ||
          String(formData.numeroLlamado || '').trim() ||
          (Array.isArray(formData.selectedStudies) && formData.selectedStudies.length > 0))
    )

    return {
      hasActiveTurno: Boolean(activeTurnoId),
      activeTurno,
      hasFormInProgress
    }
  } catch {
    return {
      hasActiveTurno: false,
      activeTurno: null,
      hasFormInProgress: false
    }
  }
}

function normalizeBoxEstado(estado) {
  return String(estado || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
}

function getBoxPersonalId(box) {
  const personal = box?.personal_actual_detalle || box?.personal_actual
  if (personal == null) return null
  if (typeof personal === 'object') {
    return personal.id_personal ?? personal.id ?? null
  }
  return personal
}

function isBoxOwnedByUser(box, userData) {
  if (!box || !userData) return false
  const currentUserId = userData?.id_personal ?? userData?.id ?? null
  const boxPersonalId = getBoxPersonalId(box)

  if (currentUserId != null && boxPersonalId != null) {
    return Number(boxPersonalId) === Number(currentUserId)
  }

  const personal = box?.personal_actual_detalle || box?.personal_actual
  if (userData?.matricula && typeof personal === 'object' && personal?.matricula) {
    return String(personal.matricula).trim() === String(userData.matricula).trim()
  }
  return false
}

// Constante estática fuera del componente para evitar reasignación de memoria en cada render
const NAV_TABS = [
  { label: 'Admisión', path: '/admision', roleKey: 'Admision', allowedRoles: ['Admision'] },
  { label: 'Técnico/Box', path: '/box', roleKey: 'Box', allowedRoles: ['Box'] },
  { label: 'Supervisión', path: '/supervision', roleKey: 'Jefa', allowedRoles: ['Jefa', 'Admin'] },
  { label: 'Reportes', path: '/reportes', roleKey: 'Secretaria', allowedRoles: ['Secretaria', 'Jefa', 'Admin'] },
  { label: 'Actividad', path: '/auditoria', roleKey: 'Auditoria', allowedRoles: ['Jefa', 'Admin'] }
]

export default function Navbar({ beforeProfileSlot = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { userData, logout } = useAuth()
  const { boxes = [], currentBoxNumber = 1 } = useBox()
  const { activeInBoxes = {} } = useTriageQueue()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [logoutBlockedReason, setLogoutBlockedReason] = useState('')
  const [admisionState, setAdmisionState] = useState(() => readAdmisionActiveState())

  const firstName = userData?.nombre?.split(' ')[0] || 'Usuario'
  const fullName = [userData?.nombre, userData?.apellidos].filter(Boolean).join(' ') || 'No informado'
  const userRole = userData?.rol || 'Personal'

  useEffect(() => {
    const syncAdmisionState = () => {
      setAdmisionState(readAdmisionActiveState())
    }
    syncAdmisionState()
    window.addEventListener(ADMISSION_STATE_CHANGED_EVENT, syncAdmisionState)
    window.addEventListener('storage', syncAdmisionState)
    return () => {
      window.removeEventListener(ADMISSION_STATE_CHANGED_EVENT, syncAdmisionState)
      window.removeEventListener('storage', syncAdmisionState)
    }
  }, [])

  useEffect(() => {
    if (!isProfileModalOpen && !logoutBlockedReason) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileModalOpen(false)
        setLogoutBlockedReason('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isProfileModalOpen, logoutBlockedReason])

  const activeAttentionBlockReason = useMemo(() => {
    if (userData?.rol === 'Box') {
      const currentBoxKey = `Box ${currentBoxNumber}`
      const currentBoxData = boxes.find(
        (boxItem) => Number(boxItem.numero) === Number(currentBoxNumber)
      )
      const currentBoxPersonalId = getBoxPersonalId(currentBoxData)
      const currentUserId = userData?.id_personal ?? userData?.id ?? null
      const isCurrentBoxOwnedOrUnassigned =
        !currentBoxData ||
        currentBoxPersonalId == null ||
        currentUserId == null ||
        Number(currentBoxPersonalId) === Number(currentUserId)

      const attendingBoxOwnedByUser = boxes.find(
        (boxItem) =>
          normalizeBoxEstado(boxItem?.estado) === 'en atencion' &&
          isBoxOwnedByUser(boxItem, userData)
      )

      const activeTicketInCurrentBox = isCurrentBoxOwnedOrUnassigned
        ? activeInBoxes?.[currentBoxKey]
        : null

      if (attendingBoxOwnedByUser || activeTicketInCurrentBox) {
        const boxNum = attendingBoxOwnedByUser?.numero ?? currentBoxNumber
        const boxKey = `Box ${boxNum}`
        const ticket =
          activeInBoxes?.[boxKey] ||
          activeTicketInCurrentBox ||
          attendingBoxOwnedByUser?.paciente_actual_detalle ||
          attendingBoxOwnedByUser?.paciente_actual

        const patientName =
          ticket?.paciente_nombre && ticket?.paciente_apellido
            ? `${ticket.paciente_nombre} ${ticket.paciente_apellido}`.trim()
            : ticket?.paciente_nombre || 'en curso'
        const ticketNum = ticket?.num_llamado || ticket?.num_totem || ''
        const ticketSuffix = ticketNum ? ` (${ticketNum})` : ''

        return `Está atendiendo al paciente ${patientName}${ticketSuffix} en Box ${boxNum}. Finalice o cancele la atención antes de cerrar sesión.`
      }
    }

    if (userData?.rol === 'Admision') {
      if (admisionState.hasActiveTurno) {
        const turnoNum = admisionState.activeTurno?.numero_llamado
        const turnoDni = admisionState.activeTurno?.dni
        const detailParts = [
          turnoNum ? `Turno ${turnoNum}` : '',
          turnoDni ? `DNI ${turnoDni}` : ''
        ].filter(Boolean)
        const detailSuffix = detailParts.length > 0 ? ` (${detailParts.join(' · ')})` : ''
        return `Tiene un paciente en atención${detailSuffix} en Admisión. Emita el ticket o cancele el turno antes de cerrar sesión.`
      }
      if (admisionState.hasFormInProgress) {
        return 'Tiene un paciente en atención o con carga de datos en curso en Admisión. Emita el ticket, cancele el turno o limpie los datos antes de cerrar sesión.'
      }
    }

    return ''
  }, [userData, currentBoxNumber, boxes, activeInBoxes, admisionState])

  const handleLogoutClick = useCallback(async () => {
    if (activeAttentionBlockReason) {
      setLogoutBlockedReason(activeAttentionBlockReason)
      return
    }

    try {
      await logout()
    } catch (error) {
      const errData = error?.data || {}
      if (
        errData?.error === 'PACIENTE_EN_ATENCION' ||
        String(error?.message || '').includes('PACIENTE_EN_ATENCION')
      ) {
        setLogoutBlockedReason(
          errData?.detail ||
            'No puede cerrar sesión mientras está atendiendo a un paciente. Finalice o cancele la atención actual antes de salir.'
        )
        return
      }
      throw error
    }
  }, [activeAttentionBlockReason, logout])

  // Pestañas visibles según rol (Jefa y Admin ven y navegan libremente entre Supervisión, Reportes y Actividad)
  const visibleTabs = NAV_TABS.filter((tab) => {
    if (!userData?.rol) return false
    if (userData.rol === 'Jefa' || userData.rol === 'Admin') {
      return tab.path === '/supervision' || tab.path === '/reportes' || tab.path === '/auditoria'
    }
    return tab.allowedRoles.includes(userData.rol)
  })

  // Navegación limpia preservando siempre el rol autenticado
  const handleTabClick = useCallback((tab) => {
    navigate(tab.path)
  }, [navigate])

  const handleLogoClick = useCallback(() => {
    navigate(getHomePathByRole(userData?.rol))
  }, [userData?.rol, navigate])

  return (
    <header className="navbar">
      <div className="navbar__left">
        <Logo withText onClick={handleLogoClick} />
      </div>

      <div className="navbar__center">
        <nav className="navbar__pills" aria-label="Navegación principal">
          {visibleTabs.map((tab) => {
            const isActive = location.pathname === tab.path
            return (
              <button
                key={tab.label}
                type="button"
                className={`navbar__pill ${isActive ? 'navbar__pill--active' : ''}`}
                onClick={() => handleTabClick(tab)}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="navbar__right">
        {beforeProfileSlot}

        <button
          type="button"
          className="navbar__profile"
          title={`Ver perfil de ${fullName}`}
          aria-haspopup="dialog"
          onClick={() => setIsProfileModalOpen(true)}
        >
          <div className="navbar__avatar" aria-hidden="true">
            <User size={15} />
          </div>
          <div className="navbar__user-meta">
            <span className="navbar__user-name">{firstName}</span>
            <span className="navbar__user-matricula">
              Matrícula: {userData?.matricula || 'No informada'}
            </span>
            <span className="navbar__user-role">{userRole}</span>
          </div>
        </button>

        <button
          type="button"
          className="navbar__logout-btn"
          onClick={handleLogoutClick}
          title={activeAttentionBlockReason || 'Cerrar Sesión'}
          aria-label="Cerrar Sesión"
        >
          <LogOut size={17} />
        </button>
      </div>

      {isProfileModalOpen && (
        <div
          className="navbar__profile-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsProfileModalOpen(false)
          }}
        >
          <section
            className="navbar__profile-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="navbar-profile-title"
          >
            <button
              type="button"
              className="navbar__profile-close"
              onClick={() => setIsProfileModalOpen(false)}
              aria-label="Cerrar perfil"
            >
              <X size={20} />
            </button>
            <div className="navbar__profile-dialog-avatar" aria-hidden="true">
              <User size={22} />
            </div>
            <h2 id="navbar-profile-title" className="navbar__profile-dialog-title">
              Información del personal
            </h2>
            <dl className="navbar__profile-details">
              <div>
                <dt>Mail</dt>
                <dd>{userData?.email || 'No informado'}</dd>
              </div>
              <div>
                <dt>Nombre completo</dt>
                <dd>{fullName}</dd>
              </div>
              <div>
                <dt>Matrícula</dt>
                <dd>{userData?.matricula || 'No informada'}</dd>
              </div>
              <div>
                <dt>Rol</dt>
                <dd>{userRole}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {logoutBlockedReason && (
        <div
          className="navbar__alert-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLogoutBlockedReason('')
          }}
        >
          <section
            className="navbar__alert-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="navbar-logout-blocked-title"
            aria-describedby="navbar-logout-blocked-desc"
          >
            <button
              type="button"
              className="navbar__alert-close"
              onClick={() => setLogoutBlockedReason('')}
              aria-label="Cerrar aviso"
            >
              <X size={20} />
            </button>
            <div className="navbar__alert-icon" aria-hidden="true">
              <AlertTriangle size={24} />
            </div>
            <h2 id="navbar-logout-blocked-title" className="navbar__alert-title">
              Cierre de sesión bloqueado
            </h2>
            <p id="navbar-logout-blocked-desc" className="navbar__alert-message">
              {logoutBlockedReason}
            </p>
            <div className="navbar__alert-actions">
              <button
                type="button"
                className="navbar__alert-confirm-btn"
                onClick={() => setLogoutBlockedReason('')}
                autoFocus
              >
                Entendido
              </button>
            </div>
          </section>
        </div>
      )}
    </header>
  )
}
