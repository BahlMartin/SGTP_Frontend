import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getHomePathByRole } from '../../utils/navigation'
import './LoginScreen.css'

export default function LoginScreen() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
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
              Correo Electrónico
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              className="login-screen__input"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="ej: usuario@sgtp.hospital.gob.ar"
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
      </div>
    </div>
  )
}
