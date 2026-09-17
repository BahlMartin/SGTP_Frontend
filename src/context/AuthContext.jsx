import { createContext, useState, useEffect, useCallback, useContext } from 'react'
import { jwtDecode } from 'jwt-decode'
import { loginApi, getDemoCredentials } from '../services/authService'

export const AuthContext = createContext({
  isLogged: false,
  userData: null,
  token: null,
  login: async () => {},
  logout: () => {},
  switchDemoRole: () => {},
  toggleShiftLockSimulation: () => {}
})

export const AUTH_TOKEN_KEY = 'sgtp_auth_token'
export const AUTH_USER_KEY = 'sgtp_auth_user'

export const AuthContextProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY))
  const [userData, setUserData] = useState(() => {
    const cached = localStorage.getItem(AUTH_USER_KEY)
    return cached ? JSON.parse(cached) : null
  })
  const [isLogged, setIsLogged] = useState(() => Boolean(localStorage.getItem(AUTH_TOKEN_KEY)))

  const login = useCallback(async (email, password) => {
    const res = await loginApi(email, password)
    localStorage.setItem(AUTH_TOKEN_KEY, res.token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user))
    setToken(res.token)
    setUserData(res.user)
    setIsLogged(true)
    return res.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    setToken(null)
    setUserData(null)
    setIsLogged(false)
  }, [])

  // Utilidad rápida para alternar entre roles (Admisión, Box, Jefa, Secretaria, Admin)
  const switchDemoRole = useCallback((roleName) => {
    const demos = getDemoCredentials()
    const target = demos.find((d) => d.rol.toLowerCase() === roleName.toLowerCase())
    if (target) {
      const fakeToken = btoa(JSON.stringify(target))
      localStorage.setItem(AUTH_TOKEN_KEY, fakeToken)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(target))
      setToken(fakeToken)
      setUserData(target)
      setIsLogged(true)
    }
  }, [])

  const toggleShiftLockSimulation = useCallback(() => {
    if (!userData) return
    const updated = { ...userData, dentro_horario: !userData.dentro_horario }
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated))
    setUserData(updated)
  }, [userData])

  useEffect(() => {
    if (token) {
      try {
        // En producción decodifica JWT, si falla usa el usuario guardado
        const parsed = JSON.parse(atob(token))
        if (!userData) {
          setUserData(parsed)
        }
      } catch (e) {
        console.warn('Fallback decodificación token:', e)
      }
    }
  }, [token, userData])

  return (
    <AuthContext.Provider
      value={{
        isLogged,
        userData,
        token,
        login,
        logout,
        switchDemoRole,
        toggleShiftLockSimulation
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
