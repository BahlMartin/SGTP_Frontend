import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userData, logout, switchDemoRole } = useAuth()

  const tabs = [
    { label: 'Admision', path: '/admision', roleKey: 'Admision' },
    { label: 'Tecnico/Box', path: '/box', roleKey: 'Box' },
    { label: 'Jefa', path: '/supervision', roleKey: 'Jefa' },
    { label: 'Secretaria', path: '/reportes', roleKey: 'Secretaria' }
  ]

  const handleTabClick = (tab) => {
    // Si el usuario actual tiene un rol distinto, le permitimos cambiar de rol o navegar
    if (userData && userData.rol !== tab.roleKey && userData.rol !== 'Admin') {
      switchDemoRole(tab.roleKey)
    }
    navigate(tab.path)
  }

  const isTabActive = (tab) => {
    return location.pathname === tab.path
  }

  return (
    <header className="sgtp-navbar">
      <div className="navbar-left">
        <div className="navbar-brand-logo" onClick={() => navigate('/admision')}>
          <svg className="ecg-svg" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 12H10L14 3L18 21L23 8L27 15L29 12H38"
              stroke="#2dd4bf"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="navbar-brand-text">SGTP</span>
      </div>

      <div className="navbar-center">
        <nav className="navbar-pills-container">
          {tabs.map((tab) => {
            const active = isTabActive(tab)
            return (
              <button
                key={tab.label}
                className={`navbar-pill ${active ? 'active' : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="navbar-right">
        <div className="user-profile-chip" title={`Usuario: ${userData?.nombre || ''}`}>
          <div className="avatar-mini">
            <User size={15} />
          </div>
          <div className="user-meta">
            <span className="user-name">{userData?.nombre?.split(' ')[0] || 'Usuario'}</span>
            <span className="user-role-badge">{userData?.rol || 'Personal'}</span>
          </div>
        </div>

        <button className="navbar-logout-btn" onClick={logout} title="Cerrar Sesión">
          <LogOut size={17} />
        </button>
      </div>
    </header>
  )
}
