import React, { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
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

  const firstName = userData?.nombre?.split(' ')[0] || 'Usuario'
  const userRole = userData?.rol || 'Personal'

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
        <div className="navbar__profile" title={`Usuario: ${userData?.nombre || ''}`}>
          <div className="navbar__avatar" aria-hidden="true">
            <User size={15} />
          </div>
          <div className="navbar__user-meta">
            <span className="navbar__user-name">{firstName}</span>
            <span className="navbar__user-role">{userRole}</span>
          </div>
        </div>

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
    </header>
  )
}
