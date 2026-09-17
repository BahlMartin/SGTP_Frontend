import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getDemoCredentials } from '../../services/authService'
import './LoginScreen.css'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login, switchDemoRole } = useAuth()
  const navigate = useNavigate()

  const demoAccounts = getDemoCredentials()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!email || !password) {
      setErrorMsg('Por favor ingrese usuario y contraseña.')
      return
    }

    setLoading(true)
    try {
      const user = await login(email, password)
      // Redirigir según el rol del usuario
      switch (user.rol) {
        case 'Admision':
          navigate('/admision')
          break
        case 'Box':
          navigate('/box')
          break
        case 'Jefa':
        case 'Admin':
          navigate('/supervision')
          break
        case 'Secretaria':
          navigate('/reportes')
          break
        default:
          navigate('/admision')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = (roleKey) => {
    switchDemoRole(roleKey)
    if (roleKey === 'Admision') navigate('/admision')
    else if (roleKey === 'Box') navigate('/box')
    else if (roleKey === 'Secretaria') navigate('/reportes')
    else navigate('/supervision')
  }

  return (
    <div className="login-screen-container">
      <div className="login-card">
        {/* Avatar Circular Central según Imagen 5 */}
        <div className="login-avatar-circle">
          <svg
            className="login-avatar-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1e293b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h2 className="login-title">Inicie Sesión</h2>

        {errorMsg && (
          <div className="login-error-alert">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field-group">
            <label className="login-label">Usuario</label>
            <input
              type="text"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ej: admision@sgtp.hospital.gob.ar"
              autoFocus
            />
          </div>

          <div className="login-field-group">
            <label className="login-label">Contraseña</label>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? 'Validando credenciales...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Acceso rápido para demostración y cambio de roles */}
        <div className="login-demo-section">
          <div className="demo-divider">
            <span>Acceso Rápido por Perfil (Demo)</span>
          </div>
          <div className="demo-pills-grid">
            {demoAccounts.map((acc) => (
              <button
                key={acc.rol}
                type="button"
                className="btn-demo-pill"
                onClick={() => handleQuickLogin(acc.rol)}
              >
                <span className="demo-role-name">{acc.rol}</span>
                <span className="demo-role-user">{acc.nombre.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
