import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getDemoCredentials } from '../../services/authService'
import { getHomePathByRole } from '../../utils/navigation'
import './LoginScreen.css'

// Extraído fuera del componente para evitar recalcular y procesar en cada re-renderizado
const DEMO_ACCOUNTS = getDemoCredentials().map((credentialItem) => ({
  ...credentialItem,
  primerNombre: credentialItem.nombre.split(' ')[0]
}))

export default function LoginScreen() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  const { login, switchDemoRole } = useAuth()
  const navigate = useNavigate()

  const handleInputChange = (event) => {
    const { name, value } = event.target
    if (errorMsg) {
      setErrorMsg(null)
    }
    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    const sanitizedEmail = formData.email.trim()
    const password = formData.password

    if (!sanitizedEmail || !password) {
      setErrorMsg('Por favor ingrese usuario y contraseña.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const authenticatedUser = await login(sanitizedEmail, password)
      navigate(getHomePathByRole(authenticatedUser.rol))
    } catch (error) {
      setErrorMsg(error.message || 'Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = (roleKey) => {
    if (loading) return
    switchDemoRole(roleKey)
    navigate(getHomePathByRole(roleKey))
  }

  return (
    <div className="login-screen">
      <div className="login-screen__card">
        {/* Avatar Circular Central */}
        <div className="login-screen__avatar">
          <User className="login-screen__avatar-svg" />
        </div>

        <h2 className="login-screen__title">Inicie Sesión</h2>

        {errorMsg && (
          <div className="login-screen__error-alert" role="alert" aria-live="polite">
            <AlertCircle className="login-screen__error-icon" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-screen__form" noValidate>
          <div className="login-screen__field">
            <label htmlFor="login-email" className="login-screen__label">
              Usuario
            </label>
            <input
              id="login-email"
              name="email"
              type="text"
              autoComplete="username"
              className="login-screen__input"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="ej: admision@sgtp.hospital.gob.ar"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="login-screen__field">
            <label htmlFor="login-password" className="login-screen__label">
              Contraseña
            </label>
            <div className="login-screen__password-wrapper">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="login-screen__input"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                className="login-screen__toggle-password"
                onClick={() => setShowPassword((prevShow) => !prevShow)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                disabled={loading}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="login-screen__toggle-icon" />
                ) : (
                  <Eye className="login-screen__toggle-icon" />
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="login-screen__submit-btn" disabled={loading}>
            {loading ? (
              <span className="login-screen__btn-loading">
                <Loader2 className="login-screen__spinner" />
                Validando credenciales...
              </span>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        {/* Acceso rápido para demostración y cambio de roles */}
        <div className="login-screen__demo">
          <div className="login-screen__demo-divider">
            <span>Acceso Rápido por Perfil (Demo)</span>
          </div>
          <div className="login-screen__demo-grid">
            {DEMO_ACCOUNTS.map((credentialItem) => (
              <button
                key={credentialItem.rol}
                type="button"
                className="login-screen__demo-pill"
                onClick={() => handleQuickLogin(credentialItem.rol)}
                disabled={loading}
              >
                <span className="login-screen__demo-role">{credentialItem.rol}</span>
                <span className="login-screen__demo-user">{credentialItem.primerNombre}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
