import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, User, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getHomePathByRole } from '../../utils/navigation'
import Logo from '../Logo/Logo'
import './Navbar.css'

// Constante estática fuera del componente para evitar reasignación de memoria en cada render
const NAV_TABS = [
  { label: 'Admisión', path: '/admision', roleKey: 'Admision', allowedRoles: ['Admision'] },
  { label: 'Técnico/Box', path: '/box', roleKey: 'Box', allowedRoles: ['Box'] },
  { label: 'Supervisión', path: '/supervision', roleKey: 'Jefa', allowedRoles: ['Jefa', 'Admin'] },
  { label: 'Reportes', path: '/reportes', roleKey: 'Secretaria', allowedRoles: ['Secretaria', 'Jefa', 'Admin'] }
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userData, logout } = useAuth()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  const firstName = userData?.nombre?.split(' ')[0] || 'Usuario'
  const fullName = [userData?.nombre, userData?.apellidos].filter(Boolean).join(' ') || 'No informado'
  const userRole = userData?.rol || 'Personal'

  useEffect(() => {
    if (!isProfileModalOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsProfileModalOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isProfileModalOpen])

  // Pestañas visibles según rol (Jefa y Admin ven y navegan libremente entre Supervisión y Reportes)
  const visibleTabs = NAV_TABS.filter((tab) => {
    if (!userData?.rol) return false
    if (userData.rol === 'Jefa' || userData.rol === 'Admin') {
      return tab.path === '/supervision' || tab.path === '/reportes'
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
          onClick={logout}
          title="Cerrar Sesión"
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
    </header>
  )
}
